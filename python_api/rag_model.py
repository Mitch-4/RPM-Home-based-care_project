# python_api/rag_model.py
import os
import json
from datetime import datetime
import pandas as pd
import numpy as np

import firebase_admin
from firebase_admin import credentials, db

import faiss
from sentence_transformers import SentenceTransformer

from mistralai import Mistral

# =========================================================
# CONFIG
# =========================================================
FIREBASE_CRED = "../backend/remotedoc-a8b6d-firebase-adminsdk-fbsvc-1609d9ba7a.json"
FIREBASE_DB_URL = "https://remotedoc-a8b6d-default-rtdb.firebaseio.com/"

EMBED_MODEL = "all-MiniLM-L6-v2"
EMB_DIM = 384

os.environ.setdefault("MISTRAL_API_KEY", "pxCDChSRqaTFDb1TG9J9wgeUYzTLBakE")

# =========================================================
# INIT FIREBASE
# =========================================================
cred = credentials.Certificate(FIREBASE_CRED)
try:
    firebase_admin.get_app()
except ValueError:
    firebase_admin.initialize_app(cred, {"databaseURL": FIREBASE_DB_URL})

# =========================================================
# MODELS
# =========================================================
embedder = SentenceTransformer(EMBED_MODEL)
mistral = Mistral(api_key=os.environ["MISTRAL_API_KEY"])

# =========================================================
# GLOBAL STATE (API-safe)
# =========================================================
df_all = pd.DataFrame()
text_store = []
index = faiss.IndexFlatL2(EMB_DIM)

# =========================================================
# DATA INGESTION
# =========================================================
def fetch_vitals(patient_path: str) -> pd.DataFrame:
    ref = db.reference(f"{patient_path}/logs")
    data = ref.get()

    if not data:
        return pd.DataFrame()

    rows = []
    for k, v in data.items():
        if "heartRate" not in v:
            continue
        try:
            rows.append({
                "key": k,
                "timeRecorded": v.get("timeRecorded"),
                "timestamp": pd.to_datetime(v.get("timeRecorded")),
                "heartRate": v.get("heartRate", 0),
                "respirationRate": v.get("respirationRate", 0),
                "movement": v.get("movement", v.get("presence", 0)),
            })
        except Exception:
            continue

    if not rows:
        return pd.DataFrame()

    return pd.DataFrame(rows).sort_values("timestamp")

# =========================================================
# RAG INDEXING
# =========================================================
def rebuild_rag(df: pd.DataFrame):
    global text_store, index

    text_store.clear()
    index.reset()

    for _, r in df.iterrows():
        text = (
            f"At {r['timeRecorded']}, "
            f"HR {r['heartRate']} bpm, "
            f"RR {r['respirationRate']}, "
            f"movement {r['movement']}"
        )
        text_store.append(text)

    if text_store:
        emb = embedder.encode(text_store).astype("float32")
        index.add(emb)

# =========================================================
# DETERMINISTIC CLINICAL ANSWERS (FROM NOTEBOOK)
# =========================================================
def rule_based_answer(df: pd.DataFrame, q: str):
    q = q.lower()

    if df.empty:
        return None

    if "last" in q or "latest" in q:
        r = df.iloc[-1]
        if "heart" in q:
            return f"The last recorded heart rate is {r['heartRate']} bpm at {r['timeRecorded']}."
        if "respiration" in q:
            return f"The last recorded respiration rate is {r['respirationRate']} at {r['timeRecorded']}."

    if "highest" in q:
        if "heart" in q:
            r = df.loc[df["heartRate"].idxmax()]
            return f"The highest heart rate recorded is {r['heartRate']} bpm at {r['timeRecorded']}."
        if "respiration" in q:
            r = df.loc[df["respirationRate"].idxmax()]
            return f"The highest respiration rate recorded is {r['respirationRate']} at {r['timeRecorded']}."

    if "lowest" in q:
        if "heart" in q:
            r = df.loc[df["heartRate"].idxmin()]
            return f"The lowest heart rate recorded is {r['heartRate']} bpm at {r['timeRecorded']}."
        if "respiration" in q:
            r = df.loc[df["respirationRate"].idxmin()]
            return f"The lowest respiration rate recorded is {r['respirationRate']} at {r['timeRecorded']}."

    if "movement range" in q:
        mn, mx = df["movement"].min(), df["movement"].max()
        return f"Movement ranged from {mn} to {mx}."

    return None

# =========================================================
# FULL RAG + LLM PIPELINE (OPTION A)
# =========================================================
def answer_question(patient_id: str, question: str):
    global df_all

    patient_path = f"patients/{patient_id}"

    # 1️⃣ Load data
    df_all = fetch_vitals(patient_path)

    # 2️⃣ Rebuild RAG index
    rebuild_rag(df_all)

    # 3️⃣ Try deterministic logic first
    rule_answer = rule_based_answer(df_all, question)
    if rule_answer:
        return {
            "answer": rule_answer,
            "confidence": 0.95,
            "severity": "informational",
            "sources": ["pandas"]
        }

    # 4️⃣ Semantic retrieval
    retrieved = []
    if index.ntotal > 0:
        q_emb = embedder.encode([question]).astype("float32")
        k = min(5, len(text_store))
        _, I = index.search(q_emb, k)
        retrieved = [text_store[i] for i in I[0]]

    context = "\n".join(retrieved) if retrieved else "No relevant vitals found."

    # 5️⃣ LLM reasoning (RESTORED ✨)
    prompt = f"""
Patient vitals (most relevant):
{context}

Doctor question:
{question}

Provide a medically clear, concise answer.
"""

    try:
        res = mistral.chat.complete(
            model="mistral-small-latest",
            messages=[
                {"role": "system", "content": "You are a clinical assistant."},
                {"role": "user", "content": prompt}
            ]
        )
        answer = res.choices[0].message.content
    except Exception as e:
        answer = f"Unable to generate LLM response. Retrieved context:\n{context}"

    return {
        "answer": answer,
        "confidence": 0.9,
        "severity": "monitor",
        "sources": ["faiss", "mistral"]
    }

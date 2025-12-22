# python_api/rag_model.py
import os
import json
import time
from datetime import datetime

import firebase_admin
from firebase_admin import credentials, db
import pandas as pd
import faiss
from sentence_transformers import SentenceTransformer
from mistralai import Mistral

# --------------------------
# CONFIG
# --------------------------
FIREBASE_CRED = "../backend/remotedoc-a8b6d-firebase-adminsdk-fbsvc-1609d9ba7a.json"
INDEX_PATH = "vitals_index.faiss"
TEXTS_PATH = "vitals_texts.json"
RECORDS_PATH = "vitals_records.json"
META_PATH = "vitals_meta.json"

EMBED_MODEL = "all-MiniLM-L6-v2"
EMB_DIM = 384  # embedding dimension

WINDOW_SIZE = 5
STRIDE = 1

os.environ.setdefault("MISTRAL_API_KEY", "pxCDChSRqaTFDb1TG9J9wgeUYzTLBakE")

# --------------------------
# Firebase init
# --------------------------
cred = credentials.Certificate(FIREBASE_CRED)
try:
    firebase_admin.get_app()
except ValueError:
    firebase_admin.initialize_app(cred, {
        "databaseURL": "https://remotedoc-a8b6d-default-rtdb.firebaseio.com/"
    })

# --------------------------
# Embeddings & model
# --------------------------
embedder = SentenceTransformer(EMBED_MODEL)
mistral = Mistral(api_key=os.environ["MISTRAL_API_KEY"])

# --------------------------
# Helpers: JSON & FAISS
# --------------------------
def load_json(path, default):
    try:
        with open(path, "r") as f:
            return json.load(f)
    except Exception:
        return default

def save_json(path, obj):
    with open(path, "w") as f:
        json.dump(obj, f, indent=2)

def load_or_create_index(dim=EMB_DIM, path=INDEX_PATH):
    if os.path.exists(path):
        try:
            return faiss.read_index(path)
        except Exception:
            pass
    return faiss.IndexFlatL2(dim)

def write_index(index, path=INDEX_PATH):
    faiss.write_index(index, path)

# --------------------------
# Fetch & clean Firebase vitals
# --------------------------
def fetch_vitals(patient_path):
    logs_ref = db.reference(f"{patient_path}/logs")
    data = logs_ref.get()
    if not data:
        return pd.DataFrame()

    out = []
    for key, v in data.items():
        if isinstance(v, dict) and ("heartRate" in v or "respirationRate" in v or "movement" in v):
            entry = v.copy()
            entry["key"] = key
            entry["timeRecorded"] = entry.get("timeRecorded", entry.get("timestamp", key))
            out.append(entry)

    if not out:
        return pd.DataFrame()

    df = pd.DataFrame(out)
    for col in ("heartRate", "respirationRate", "movement"):
        if col not in df.columns:
            df[col] = 0

    df = df[(df["heartRate"].fillna(0) > 0) |
            (df["respirationRate"].fillna(0) > 0) |
            (df["movement"].fillna(0) > 0)]

    try:
        df["timeRecorded"] = pd.to_datetime(df["timeRecorded"], errors="coerce")
    except Exception:
        df["timeRecorded"] = pd.NaT

    if df["timeRecorded"].isna().all():
        df = df.reset_index(drop=True)
    else:
        df = df.sort_values("timeRecorded").reset_index(drop=True)

    return df

# --------------------------
# Build sliding-window chunks
# --------------------------
def build_chunks(df, window=WINDOW_SIZE, stride=STRIDE):
    chunks = []
    if df.empty or len(df) < window:
        return chunks
    for start in range(0, len(df) - window + 1, stride):
        window_df = df.iloc[start:start + window]
        lines = []
        for _, r in window_df.iterrows():
            ts = r.get("timeRecorded")
            ts_s = ts.isoformat() if pd.notna(ts) else str(r.get("key"))
            hr = r.get("heartRate", 0)
            rr = r.get("respirationRate", 0)
            mv = r.get("movement", 0)
            lines.append(f"At {ts_s}, HR {hr} bpm, RR {rr} bpm, MV {mv}")
        joined = " | ".join(lines)
        chunks.append({
            "text": joined,
            "start": window_df.iloc[0]["timeRecorded"],
            "end": window_df.iloc[-1]["timeRecorded"],
            "rows": [row.to_dict() for _, row in window_df.iterrows()]
        })
    return chunks

# --------------------------
# Query RAG
# --------------------------
def query_rag(patient_path, question, k=5):
    text_store = load_json(TEXTS_PATH, [])
    records_store = load_json(RECORDS_PATH, [])
    meta = load_json(META_PATH, {"last_indexed_end": None, "initial_loaded": False})

    index = load_or_create_index()
    if index.ntotal == 0 and text_store:
        emb_all = embedder.encode(text_store).astype("float32")
        index.add(emb_all)

    # Incremental update before query
    df = fetch_vitals(patient_path)
    chunks = build_chunks(df)
    for ch in chunks:
        text_store.append(ch["text"])
        records_store.append(ch["rows"])
    if chunks:
        batch_texts = [ch["text"] for ch in chunks]
        emb_np = embedder.encode(batch_texts).astype("float32")
        index.add(emb_np)

    # Retrieval
    if index.ntotal == 0:
        retrieved_texts = []
    else:
        q_emb = embedder.encode([question]).astype("float32")
        D, I = index.search(q_emb, k)
        retrieved_texts = [text_store[idx] for idx in I[0] if 0 <= idx < len(text_store)]

    # Mistral call
    prompt = "Patient vitals history (most relevant chunks):\n"
    prompt += "\n".join(retrieved_texts)
    prompt += f"\n\nDoctor question: {question}\nProvide a medically clear answer."

    res = mistral.chat.complete(
        model="mistral-small-latest",
        messages=[
            {"role": "system", "content": "You are an AI medical assistant."},
            {"role": "user", "content": prompt}
        ]
    )
    answer = res.choices[0].message.content

    return {
        "answer": answer,
        "confidence": 0.9,
        "severity": "monitor",  # optionally compute from vitals
        "sources": ["faiss_index"]
    }

    # --------------------------
# Thin API wrapper (DO NOT TOUCH CORE LOGIC)
# --------------------------
def answer_question(patient_id: str, question: str):
    patient_path = f"patients/{patient_id}"
    return query_rag(patient_path, question)




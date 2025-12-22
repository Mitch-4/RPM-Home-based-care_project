from fastapi import FastAPI
from pydantic import BaseModel
from typing import List, Optional
from rag_model import answer_question

app = FastAPI(title="RAG Clinical API")

from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --------------------------
# Request model
# --------------------------
class QueryRequest(BaseModel):
    question: str
    role: str          # doctor or caregiver
    patientId: str

# --------------------------
# Response model
# --------------------------
class QueryResponse(BaseModel):
    answer: str
    confidence: Optional[float] = 0.0
    severity: Optional[str] = "unknown"
    sources: List[str]

# --------------------------
# Health check
# --------------------------
@app.get("/")
def health_check():
    return {"status": "FastAPI running"}

# --------------------------
# RAG query endpoint
# --------------------------
@app.post("/query", response_model=QueryResponse)
def query_rag_api(request: QueryRequest):
    # Call your RAG model
    result = answer_question(
        patient_id=request.patientId,
        question=request.question
    )
    
    # Ensure response always matches QueryResponse
    return QueryResponse(
        answer=result.get("answer", ""),
        confidence=result.get("confidence", 0.0),
        severity=result.get("severity", "unknown"),
        sources=result.get("sources", [])
    )

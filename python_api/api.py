from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from rag_model import answer_question
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="RAG Clinical API")

# CORS middleware - must be added BEFORE routes
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173", 
        "http://127.0.0.1:5173", 
        "http://localhost:3000",
        "http://127.0.0.1:3000"
    ],
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
    return {"status": "FastAPI running", "message": "RAG Clinical API is operational"}

# --------------------------
# RAG query endpoint
# --------------------------
@app.post("/query", response_model=QueryResponse)
def query_rag_api(request: QueryRequest):
    try:
        # Call your RAG model
        result = answer_question(
            patient_id=request.patientId,
            question=request.question
        )
        
        # Ensure sources is always a list
        sources = result.get("sources", [])
        if isinstance(sources, str):
            # If it's a string (error message), wrap it in a list
            sources = [sources] if sources else []
        
        # Ensure answer is always a string
        answer = result.get("answer", "")
        if not answer:
            answer = "No data available for this query."
        
        return QueryResponse(
            answer=answer,
            confidence=result.get("confidence", 0.0),
            severity=result.get("severity", "unknown"),
            sources=sources
        )
    except Exception as e:
        # Log the error and return a proper error response
        print(f"Error in query_rag_api: {str(e)}")
        raise HTTPException(
            status_code=500, 
            detail=f"Error processing query: {str(e)}"
        )
"""
AI API routes - Insights and chatbot
"""
from fastapi import APIRouter, HTTPException
from typing import Optional

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from models.schemas import (
    AIInsightRequest, AIInsightResponse,
    ChatRequest, ChatResponse
)
from services.ai_service import ai_service
from models.database import db

router = APIRouter()


@router.post("/insights", response_model=dict)
async def generate_insights(request: AIInsightRequest):
    """
    Generate AI insights for a scrape session
    """
    session_id = request.session_id
    
    # Get latest session if not specified
    if session_id is None:
        sessions = await db.execute_query(
            "SELECT id FROM scrape_sessions ORDER BY timestamp DESC LIMIT 1"
        )
        if not sessions:
            raise HTTPException(status_code=404, detail="No sessions found")
        session_id = sessions[0]['id']
    
    # Generate insights
    insights = await ai_service.generate_insights(session_id)
    
    return insights


@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """
    Chat with AI about fuel surcharge data
    """
    # Get latest session if not specified
    session_id = request.session_id
    if session_id is None:
        sessions = await db.execute_query(
            "SELECT id FROM scrape_sessions ORDER BY timestamp DESC LIMIT 1"
        )
        if sessions:
            session_id = sessions[0]['id']
    
    # Get AI response
    response = await ai_service.chat(
        message=request.message,
        context_session_id=session_id,
        history=[msg.dict() for msg in request.history]
    )
    
    return ChatResponse(
        message=response,
        context_used=session_id is not None
    )


@router.get("/insights/{session_id}")
async def get_session_insights(session_id: int):
    """
    Get cached insights for a session
    """
    insights = await db.execute_query(
        "SELECT * FROM ai_insights WHERE session_id = ?",
        (session_id,)
    )
    
    if not insights:
        raise HTTPException(status_code=404, detail="No insights found for this session")
    
    import json
    result = []
    for insight in insights:
        result.append({
            "id": insight['id'],
            "session_id": insight['session_id'],
            "insight_type": insight['insight_type'],
            "content": json.loads(insight['content']),
            "generated_at": insight['generated_at'],
            "model_used": insight['model_used']
        })
    
    return result


"""
AI API routes - Insights and chatbot
"""
from fastapi import APIRouter, HTTPException
from typing import Optional
from datetime import datetime

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

# In-memory conversation history storage (session_id -> messages)
chat_sessions = {}


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
    Chat with AI about fuel surcharge data (with conversation memory)
    """
    try:
        # Ensure token is valid before attempting chat
        if ai_service.token_manager:
            await ai_service.token_manager.get_token()
        
        # Get latest session if not specified
        session_id = request.session_id
        if session_id is None:
            sessions = await db.execute_query(
                "SELECT id FROM scrape_sessions ORDER BY timestamp DESC LIMIT 1"
            )
            if sessions:
                session_id = sessions[0]['id']
        
        # Create session key for conversation tracking
        session_key = f"{session_id}_{datetime.now().strftime('%Y%m%d')}"
        
        # Get or create conversation history
        if session_key not in chat_sessions:
            chat_sessions[session_key] = []
        
        history = chat_sessions[session_key]
        
        # Add user message to history
        history.append({"role": "user", "content": request.message})
        
        # Get AI response with full conversation context
        response = await ai_service.chat(
            message=request.message,
            context_session_id=session_id,
            history=history[:-1]  # Pass history without current message
        )
        
        # Add AI response to history
        history.append({"role": "assistant", "content": response})
        
        # Keep only last 20 messages (10 exchanges) to avoid token limits
        chat_sessions[session_key] = history[-20:]
        
        return ChatResponse(
            message=response,
            context_used=session_id is not None
        )
    except Exception as e:
        print(f"⚠️ Chat error: {e}")
        raise HTTPException(status_code=500, detail=f"Chat error: {str(e)}")


@router.post("/executive-analysis", response_model=dict)
async def generate_executive_analysis(request: AIInsightRequest):
    """
    Generate comprehensive executive-level analysis
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
    
    # Generate executive analysis
    analysis = await ai_service.generate_executive_analysis(session_id)
    
    return analysis


@router.post("/quick-insights", response_model=dict)
async def generate_quick_insights(request: AIInsightRequest):
    """
    Generate quick, punchy insights for rapid snapshot
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
    
    # Generate quick insights
    insights = await ai_service.generate_quick_insights(session_id)
    
    return insights


@router.post("/rate-recommendations", response_model=dict)
async def generate_rate_recommendations(request: AIInsightRequest):
    """
    Generate intelligent rate recommendations with competitive analysis
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
    
    # Generate recommendations
    recommendations = await ai_service.generate_rate_recommendations(session_id)
    
    return recommendations


@router.post("/all-insights", response_model=dict)
async def get_all_ai_insights(request: AIInsightRequest):
    """
    Fire all 3 AI calls in parallel: quick insights, executive analysis, and rate recommendations
    """
    import asyncio
    
    session_id = request.session_id
    
    # Get latest session if not specified
    if session_id is None:
        sessions = await db.execute_query(
            "SELECT id FROM scrape_sessions ORDER BY timestamp DESC LIMIT 1"
        )
        if not sessions:
            raise HTTPException(status_code=404, detail="No sessions found")
        session_id = sessions[0]['id']
    
    # Fire all three AI calls in parallel
    results = await asyncio.gather(
        ai_service.generate_quick_insights(session_id),
        ai_service.generate_executive_analysis(session_id),
        ai_service.generate_rate_recommendations(session_id),
        return_exceptions=True
    )
    
    return {
        "quick_insights": results[0] if not isinstance(results[0], Exception) else {"error": str(results[0])},
        "executive_analysis": results[1] if not isinstance(results[1], Exception) else {"error": str(results[1])},
        "recommendations": results[2] if not isinstance(results[2], Exception) else {"error": str(results[2])},
        "session_id": session_id
    }


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


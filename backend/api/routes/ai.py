"""
AI API routes - Insights and chatbot
Filter-based data: Uses market + fuel_category, ignores carrier filter (uses ALL carriers for that filter)
"""
from fastapi import APIRouter, HTTPException
from typing import Optional
from datetime import datetime
from pydantic import BaseModel

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


class FilteredAIRequest(BaseModel):
    """AI request with filter parameters"""
    session_id: Optional[int] = None
    market: Optional[str] = None
    fuel_category: Optional[str] = None
    # Note: carrier filter is intentionally excluded - we always use ALL carriers for the market/fuel_category
    force_refresh: bool = False  # Force regenerate instead of using cache


class FilteredChatRequest(BaseModel):
    """Chat request with filter parameters"""
    message: str
    history: list = []
    session_id: Optional[int] = None
    market: Optional[str] = None
    fuel_category: Optional[str] = None


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
async def chat(request: FilteredChatRequest):
    """
    Chat with AI about fuel surcharge data (with conversation memory)
    Uses market + fuel_category filters for context-aware responses.
    """
    try:
        # Ensure token is valid before attempting chat
        if ai_service.token_manager:
            await ai_service.token_manager.get_token()
        
        market = request.market or "US"
        fuel_category = request.fuel_category or "ground_domestic"
        
        # Create session key for conversation tracking (include filters in key)
        session_key = f"{market}_{fuel_category}_{datetime.now().strftime('%Y%m%d')}"
        
        # Get or create conversation history
        if session_key not in chat_sessions:
            chat_sessions[session_key] = []
        
        history = chat_sessions[session_key]
        
        # Add user message to history
        history.append({"role": "user", "content": request.message})
        
        # Get AI response with filter context
        response = await ai_service.chat_filtered(
            message=request.message,
            market=market,
            fuel_category=fuel_category,
            history=history[:-1]  # Pass history without current message
        )
        
        # Add AI response to history
        history.append({"role": "assistant", "content": response})
        
        # Keep only last 20 messages (10 exchanges) to avoid token limits
        chat_sessions[session_key] = history[-20:]
        
        return ChatResponse(
            message=response,
            context_used=True
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
async def get_all_ai_insights(request: FilteredAIRequest):
    """
    Fire all 3 AI calls in parallel: quick insights, executive analysis, and rate recommendations
    Uses market + fuel_category filters, always considers ALL carriers for that filter combination.
    """
    import asyncio
    
    market = request.market or "US"
    fuel_category = request.fuel_category or "ground_domestic"
    force_refresh = request.force_refresh
    
    # Check cache first (unless force_refresh)
    cache_key = f"{market}_{fuel_category}"
    
    if not force_refresh:
        cached = await ai_service.get_cached_insights(cache_key)
        if cached:
            print(f"✓ Returning cached AI insights for {cache_key}")
            return {
                **cached,
                "from_cache": True,
                "cache_key": cache_key
            }
    
    # Fire all three AI calls in parallel with filter context
    results = await asyncio.gather(
        ai_service.generate_quick_insights_filtered(market, fuel_category),
        ai_service.generate_executive_analysis_filtered(market, fuel_category),
        ai_service.generate_rate_recommendations_filtered(market, fuel_category),
        return_exceptions=True
    )
    
    response = {
        "quick_insights": results[0] if not isinstance(results[0], Exception) else {"error": str(results[0])},
        "executive_analysis": results[1] if not isinstance(results[1], Exception) else {"error": str(results[1])},
        "recommendations": results[2] if not isinstance(results[2], Exception) else {"error": str(results[2])},
        "market": market,
        "fuel_category": fuel_category,
        "from_cache": False,
        "cache_key": cache_key
    }
    
    # Cache the results (only if all succeeded)
    if not any(isinstance(r, Exception) or (isinstance(r, dict) and "error" in r) for r in results):
        await ai_service.cache_insights(cache_key, response)
    
    return response


# ==================== INDIVIDUAL INSIGHT ENDPOINTS ====================

@router.post("/quick-insights-filtered", response_model=dict)
async def generate_quick_insights_filtered(request: FilteredAIRequest):
    """Generate only Quick Insights for a market/fuel_category - uses cache"""
    market = request.market or "US"
    fuel_category = request.fuel_category or "ground_domestic"
    cache_key = f"{market}_{fuel_category}"
    
    # Check cache first (unless force refresh)
    if not request.force_refresh:
        cached = await ai_service.get_cached_insights(cache_key)
        if cached and "quick_insights" in cached:
            return {
                "quick_insights": cached["quick_insights"],
                "market": market,
                "fuel_category": fuel_category,
                "from_cache": True
            }
    
    # Generate fresh
    result = await ai_service.generate_quick_insights_filtered(market, fuel_category)
    
    # Update cache (merge with existing)
    await ai_service.update_cached_insight(cache_key, "quick_insights", result)
    
    return {
        "quick_insights": result,
        "market": market,
        "fuel_category": fuel_category,
        "from_cache": False
    }


@router.post("/executive-analysis-filtered", response_model=dict)
async def generate_executive_analysis_filtered(request: FilteredAIRequest):
    """Generate only Executive Analysis for a market/fuel_category - uses cache"""
    market = request.market or "US"
    fuel_category = request.fuel_category or "ground_domestic"
    cache_key = f"{market}_{fuel_category}"
    
    # Check cache first (unless force refresh)
    if not request.force_refresh:
        cached = await ai_service.get_cached_insights(cache_key)
        if cached and "executive_analysis" in cached:
            return {
                "executive_analysis": cached["executive_analysis"],
                "market": market,
                "fuel_category": fuel_category,
                "from_cache": True
            }
    
    # Generate fresh
    result = await ai_service.generate_executive_analysis_filtered(market, fuel_category)
    
    # Update cache (merge with existing)
    await ai_service.update_cached_insight(cache_key, "executive_analysis", result)
    
    return {
        "executive_analysis": result,
        "market": market,
        "fuel_category": fuel_category,
        "from_cache": False
    }


@router.post("/rate-recommendations-filtered", response_model=dict)
async def generate_rate_recommendations_filtered(request: FilteredAIRequest):
    """Generate only Rate Recommendations for a market/fuel_category - uses cache"""
    market = request.market or "US"
    fuel_category = request.fuel_category or "ground_domestic"
    cache_key = f"{market}_{fuel_category}"
    
    # Check cache first (unless force refresh)
    if not request.force_refresh:
        cached = await ai_service.get_cached_insights(cache_key)
        if cached and "recommendations" in cached:
            return {
                "recommendations": cached["recommendations"],
                "market": market,
                "fuel_category": fuel_category,
                "from_cache": True
            }
    
    # Generate fresh
    result = await ai_service.generate_rate_recommendations_filtered(market, fuel_category)
    
    # Update cache (merge with existing)
    await ai_service.update_cached_insight(cache_key, "recommendations", result)
    
    return {
        "recommendations": result,
        "market": market,
        "fuel_category": fuel_category,
        "from_cache": False
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


@router.post("/invalidate-cache", response_model=dict)
async def invalidate_ai_cache(cache_key: Optional[str] = None):
    """
    Invalidate AI cache.
    If cache_key is provided, invalidate only that key (e.g., "US_ground_domestic").
    If not provided, invalidate ALL cached insights.
    """
    if cache_key:
        await ai_service.invalidate_cache(cache_key)
        return {"status": "ok", "invalidated": cache_key}
    else:
        await ai_service.invalidate_all_cache()
        return {"status": "ok", "invalidated": "all"}


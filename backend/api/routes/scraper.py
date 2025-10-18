"""
Scraper API routes
"""
from fastapi import APIRouter, HTTPException, BackgroundTasks
from typing import List

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from models.schemas import (
    ScrapeRequest, ScrapeResult, ScrapeSessionResponse,
    FuelSurchargeResponse
)
from services.scraper_service import scraper_service
from models.database import db

router = APIRouter()


@router.post("/scrape", response_model=ScrapeResult)
async def trigger_scrape(request: ScrapeRequest, background_tasks: BackgroundTasks):
    """
    Trigger manual scrape of fuel surcharge data
    """
    result = await scraper_service.scrape_carriers(request.carriers)
    
    # If scrape was successful, check for duplicates
    if result.status == "success" and result.data:
        is_duplicate = await scraper_service.is_duplicate_data(result.data)
        
        if is_duplicate:
            # Data is identical to latest session, delete the new session we just created
            # and return a special response
            await db.execute_write(
                "DELETE FROM scrape_sessions WHERE id = ?",
                (result.session_id,)
            )
            
            # Return existing result with isDuplicate flag
            result.session_id = None
            result.error = "Data unchanged from last scrape. Skipped to prevent duplicates."
            # Keep status as success but set error message
            return result
    
    # Check for changes in background if not a duplicate
    if result.status == "success" and result.session_id:
        background_tasks.add_task(
            scraper_service.check_data_changes,
            result.session_id
        )
    
    return result


@router.get("/sessions", response_model=List[ScrapeSessionResponse])
async def get_sessions(limit: int = 10):
    """
    Get recent scrape sessions
    """
    query = """
        SELECT id, timestamp, status, carriers_scraped, total_rows, notes
        FROM scrape_sessions
        ORDER BY timestamp DESC
        LIMIT ?
    """
    sessions = await db.execute_query(query, (limit,))
    
    # Parse carriers_scraped JSON
    import json
    for session in sessions:
        session['carriers_scraped'] = json.loads(session['carriers_scraped'])
    
    return sessions


@router.get("/sessions/{session_id}", response_model=ScrapeSessionResponse)
async def get_session(session_id: int):
    """
    Get specific scrape session
    """
    query = """
        SELECT id, timestamp, status, carriers_scraped, total_rows, notes
        FROM scrape_sessions
        WHERE id = ?
    """
    sessions = await db.execute_query(query, (session_id,))
    
    if not sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    import json
    session = sessions[0]
    session['carriers_scraped'] = json.loads(session['carriers_scraped'])
    
    return session


@router.get("/sessions/{session_id}/data", response_model=List[FuelSurchargeResponse])
async def get_session_data(session_id: int):
    """
    Get fuel surcharge data for a session
    """
    data = await scraper_service.get_session_data(session_id)
    
    if not data:
        # Check if session exists
        session = await db.execute_query(
            "SELECT id FROM scrape_sessions WHERE id = ?",
            (session_id,)
        )
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
    
    return data


@router.get("/latest", response_model=ScrapeSessionResponse)
async def get_latest_session():
    """
    Get latest scrape session
    """
    session = await scraper_service.get_latest_session()
    
    if not session:
        raise HTTPException(status_code=404, detail="No sessions found")
    
    import json
    session['carriers_scraped'] = json.loads(session['carriers_scraped'])
    
    return session


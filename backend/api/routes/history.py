"""
Historical data API routes
"""
from fastapi import APIRouter, Query
from typing import Optional, List
from datetime import datetime, timedelta

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from models.database import db
from models.schemas import CarrierEnum, FuelSurchargeResponse

router = APIRouter()


@router.get("/sessions")
async def get_all_sessions():
    """
    Get all scrape sessions
    """
    query = """
        SELECT 
            id,
            timestamp,
            status,
            carriers_scraped,
            total_rows
        FROM scrape_sessions
        ORDER BY timestamp DESC
    """
    
    sessions = await db.execute_query(query)
    
    import json
    for session in sessions:
        session['carriers_scraped'] = json.loads(session['carriers_scraped'])
    
    return sessions


@router.get("/sessions/{session_id}/details")
async def get_session_details(session_id: int):
    """Get detailed carrier tables for a single session"""
    query = """
        SELECT id, carrier, at_least_usd, but_less_than_usd, surcharge_pct, service
        FROM fuel_surcharges
        WHERE session_id = ?
        ORDER BY carrier, at_least_usd
    """

    rows = await db.execute_query(query, (session_id,))

    grouped = {
        "UPS": [],
        "FedEx": [],
        "DHL": []
    }

    for row in rows:
        grouped[row["carrier"]].append({
            "id": row["id"],
            "at_least_usd": row["at_least_usd"],
            "but_less_than_usd": row["but_less_than_usd"],
            "surcharge_pct": row["surcharge_pct"],
            "service": row["service"],
        })

    return grouped


@router.get("/trends")
async def get_trends(
    carriers: Optional[List[CarrierEnum]] = Query(None),
    days: int = Query(30, description="Number of days to look back")
):
    """
    Get historical trends for carriers
    
    - **carriers**: List of carriers (None = all)
    - **days**: Number of days to look back
    """
    # Calculate date range
    end_date = datetime.now()
    start_date = end_date - timedelta(days=days)
    
    # Build query
    carriers_filter = ""
    params = [start_date.isoformat()]
    
    if carriers:
        carrier_names = [c.value for c in carriers]
        placeholders = ','.join('?' * len(carrier_names))
        carriers_filter = f"AND fs.carrier IN ({placeholders})"
        params.extend(carrier_names)
    
    query = f"""
        SELECT 
            fs.carrier,
            DATE(ss.timestamp) as date,
            AVG(fs.surcharge_pct) as avg_surcharge,
            MIN(fs.at_least_usd) as min_price,
            MAX(fs.but_less_than_usd) as max_price,
            COUNT(*) as data_points
        FROM fuel_surcharges fs
        JOIN scrape_sessions ss ON fs.session_id = ss.id
        WHERE ss.timestamp >= ? {carriers_filter}
        GROUP BY fs.carrier, DATE(ss.timestamp)
        ORDER BY date DESC, fs.carrier
    """
    
    trends = await db.execute_query(query, tuple(params))
    
    return {
        "period_start": start_date.isoformat(),
        "period_end": end_date.isoformat(),
        "trends": trends
    }


@router.get("/sessions/range")
async def get_sessions_in_range(
    start_date: str,
    end_date: str
):
    """
    Get all sessions within a date range
    """
    query = """
        SELECT 
            id,
            timestamp,
            status,
            carriers_scraped,
            total_rows
        FROM scrape_sessions
        WHERE timestamp BETWEEN ? AND ?
        ORDER BY timestamp DESC
    """
    
    sessions = await db.execute_query(query, (start_date, end_date))
    
    import json
    for session in sessions:
        session['carriers_scraped'] = json.loads(session['carriers_scraped'])
    
    return sessions


@router.get("/changes")
async def get_significant_changes(
    threshold_pct: float = Query(0.5, description="Minimum change percentage to report")
):
    """
    Detect significant changes in surcharge rates
    Compares latest session with previous one
    """
    # Get latest two sessions
    query = """
        SELECT id FROM scrape_sessions 
        WHERE status = 'success'
        ORDER BY timestamp DESC 
        LIMIT 2
    """
    sessions = await db.execute_query(query)
    
    if len(sessions) < 2:
        return {"changes": [], "message": "Not enough sessions to compare"}
    
    latest_id = sessions[0]['id']
    previous_id = sessions[1]['id']
    
    # Compare data
    compare_query = """
        SELECT 
            l.carrier,
            l.at_least_usd,
            l.but_less_than_usd,
            l.surcharge_pct as latest_pct,
            p.surcharge_pct as previous_pct,
            (l.surcharge_pct - p.surcharge_pct) as change_pct
        FROM fuel_surcharges l
        JOIN fuel_surcharges p ON 
            l.carrier = p.carrier AND
            l.at_least_usd = p.at_least_usd AND
            l.but_less_than_usd = p.but_less_than_usd
        WHERE 
            l.session_id = ? AND
            p.session_id = ? AND
            ABS(l.surcharge_pct - p.surcharge_pct) >= ?
        ORDER BY ABS(l.surcharge_pct - p.surcharge_pct) DESC
    """
    
    changes = await db.execute_query(compare_query, (latest_id, previous_id, threshold_pct))
    
    return {
        "latest_session_id": latest_id,
        "previous_session_id": previous_id,
        "changes": changes,
        "total_changes": len(changes)
    }


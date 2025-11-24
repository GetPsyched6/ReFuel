"""
Fuel Curve Versions API routes
"""
from fastapi import APIRouter, Query
from typing import Optional, List
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from models.database import Database

router = APIRouter()
db = Database()


@router.get("/versions")
async def get_fuel_curve_versions(
    market: Optional[str] = Query(None, description="Filter by market/country code"),
    fuel_category: Optional[str] = Query(None, description="Filter by fuel category"),
    carriers: Optional[str] = Query(None, description="Comma-separated list of carriers")
):
    """
    Get all available fuel curve versions, grouped by carrier
    
    Returns: {
        "UPS": [
            {"id": 1, "label": "Fuel curve (effective Nov 20, 2025)", "effective_date": "2025-11-20", ...},
            {"id": 2, "label": "pre Nov 20, 2025", "effective_date": "2025-06-15", ...}
        ],
        "FedEx": [...]
    }
    """
    query = """
        SELECT 
            id,
            carrier,
            service,
            market,
            fuel_category,
            fuel_type,
            effective_date,
            label,
            session_id,
            is_active
        FROM fuel_curve_versions
        WHERE 1=1
    """
    params = []
    
    if market:
        query += " AND market = ?"
        params.append(market)
    
    if fuel_category:
        query += " AND fuel_category = ?"
        params.append(fuel_category)
    
    if carriers:
        carrier_list = [c.strip() for c in carriers.split(",")]
        placeholders = ",".join(["?"] * len(carrier_list))
        query += f" AND carrier IN ({placeholders})"
        params.extend(carrier_list)
    
    query += " ORDER BY carrier, effective_date DESC"
    
    rows = await db.execute_query(query, tuple(params))
    
    # Group by carrier
    versions_by_carrier = {}
    for row in rows:
        carrier = row["carrier"]
        if carrier not in versions_by_carrier:
            versions_by_carrier[carrier] = []
        
        versions_by_carrier[carrier].append({
            "id": row["id"],
            "carrier": row["carrier"],
            "service": row["service"],
            "market": row["market"],
            "fuel_category": row["fuel_category"],
            "fuel_type": row["fuel_type"],
            "effective_date": row["effective_date"],
            "label": row["label"],
            "session_id": row["session_id"],
            "is_active": bool(row["is_active"])
        })
    
    # Also create a flat list for easier consumption
    versions_flat = []
    for row in rows:
        versions_flat.append({
            "id": row["id"],
            "carrier": row["carrier"],
            "service": row["service"],
            "market": row["market"],
            "fuel_category": row["fuel_category"],
            "fuel_type": row["fuel_type"],
            "effective_date": row["effective_date"],
            "label": row["label"],
            "session_id": row["session_id"],
            "is_active": bool(row["is_active"])
        })
    
    return {
        "versions_by_carrier": versions_by_carrier,
        "versions": versions_flat,
        "total_versions": len(rows)
    }


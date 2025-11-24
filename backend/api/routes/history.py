"""
Historical data API routes
"""
from fastapi import APIRouter, Query
from typing import Optional, List, Dict
from datetime import datetime, timedelta

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from models.database import db
from models.schemas import FuelSurchargeResponse

router = APIRouter()


def _normalize_list_param(values: Optional[List[str]]) -> List[str]:
    """Accept repeated or comma-separated query params."""
    if not values:
        return []
    normalized: List[str] = []
    for value in values:
        if not value:
            continue
        normalized.extend([part.strip() for part in value.split(",") if part.strip()])
    deduped: List[str] = []
    seen = set()
    for item in normalized:
        if item not in seen:
            deduped.append(item)
            seen.add(item)
    return deduped


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
        raw = session.get('carriers_scraped')
        if raw:
            try:
                session['carriers_scraped'] = json.loads(raw)
            except (json.JSONDecodeError, TypeError):
                # Handle non-JSON values (plain strings)
                session['carriers_scraped'] = [raw] if raw else []
        else:
            session['carriers_scraped'] = []
    
    return sessions


@router.get("/sessions/{session_id}/details")
async def get_session_details(session_id: int):
    """Get detailed carrier tables for a single session"""
    query = """
        SELECT id, carrier, at_least_usd, but_less_than_usd, surcharge_pct, service, fuel_type, fuel_category, market
        FROM fuel_surcharges
        WHERE session_id = ?
        ORDER BY carrier, at_least_usd
    """

    rows = await db.execute_query(query, (session_id,))

    grouped: dict[str, List[dict]] = {}

    for row in rows:
        grouped.setdefault(row["carrier"], []).append({
            "id": row["id"],
            "at_least_usd": row["at_least_usd"],
            "but_less_than_usd": row["but_less_than_usd"],
            "surcharge_pct": row["surcharge_pct"],
            "service": row["service"],
            "fuel_type": row.get("fuel_type"),
            "fuel_category": row.get("fuel_category"),
            "market": row.get("market"),
        })

    return grouped


@router.get("/trends")
async def get_trends(
    carriers: Optional[List[str]] = Query(None),
    days: Optional[int] = Query(None, description="Number of days to look back"),
    fuel_category: Optional[str] = Query(None, description="Canonical fuel category (e.g., ground_domestic)"),
    market: Optional[str] = Query(None, description="Market/country code"),
    start_date: Optional[str] = Query(None, description="Custom start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="Custom end date (YYYY-MM-DD)")
):
    """
    Get historical trends for carriers
    
    - **carriers**: List of carriers (None = all)
    - **days**: Number of days to look back (ignored if start_date/end_date provided)
    - **start_date**: Custom start date (YYYY-MM-DD)
    - **end_date**: Custom end date (YYYY-MM-DD)
    """
    carriers = _normalize_list_param(carriers)

    # Calculate date range
    if start_date and end_date:
        # Handle YYYY-MM-DD format
        if len(start_date) == 10:
            start_dt = datetime.fromisoformat(start_date + "T00:00:00")
        else:
            start_dt = datetime.fromisoformat(start_date)
        if len(end_date) == 10:
            end_dt = datetime.fromisoformat(end_date + "T23:59:59")
        else:
            end_dt = datetime.fromisoformat(end_date)
    else:
        # If no date range specified, get all available data
        # Query for the full range from the database
        if days:
            days_back = days
            end_dt = datetime.now()
            start_dt = end_dt - timedelta(days=days_back)
        else:
            # Get all available data - query min/max dates from DB
            min_max_query = """
                SELECT 
                    MIN(effective_start) as min_date,
                    MAX(effective_start) as max_date
                FROM fuel_surcharge_history
            """
            min_max_result = await db.execute_query(min_max_query)
            if min_max_result and min_max_result[0].get('min_date'):
                start_dt = datetime.fromisoformat(min_max_result[0]['min_date'])
                end_dt = datetime.fromisoformat(min_max_result[0]['max_date'])
            else:
                # Fallback to 30 days if no data
                end_dt = datetime.now()
                start_dt = end_dt - timedelta(days=30)
    
    # Use fuel_surcharge_history table for historical trends
    # Convert dates to datetime strings for comparison
    start_str = start_dt.isoformat()
    end_str = end_dt.isoformat()
    
    # Build WHERE clause and params
    where_clauses = ["fh.effective_start >= ?", "fh.effective_start <= ?"]
    query_params = [start_str, end_str]
    
    if carriers:
        placeholders = ','.join('?' * len(carriers))
        where_clauses.append(f"fh.carrier IN ({placeholders})")
        query_params.extend(carriers)

    if fuel_category and fuel_category != "all":
        where_clauses.append("fh.fuel_category = ?")
        query_params.append(fuel_category)
    
    if market:
        where_clauses.append("fh.market = ?")
        query_params.append(market)
    
    where_clause = " AND ".join(where_clauses)
    
    query = f"""
        SELECT 
            fh.carrier,
            fh.fuel_category,
            fh.value_numeric,
            fh.value_unit,
            DATE(fh.effective_start) as date
        FROM fuel_surcharge_history fh
        WHERE {where_clause}
        ORDER BY date DESC, fh.carrier, fh.fuel_category
    """
    
    raw_rows = await db.execute_query(query, tuple(query_params))

    trends = _build_trend_rows(
        raw_rows,
        carriers,
        fuel_category
    )
    
    return {
        "period_start": start_dt.isoformat(),
        "period_end": end_dt.isoformat(),
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
        raw = session.get('carriers_scraped')
        if raw:
            try:
                session['carriers_scraped'] = json.loads(raw)
            except (json.JSONDecodeError, TypeError):
                session['carriers_scraped'] = [raw] if raw else []
        else:
            session['carriers_scraped'] = []
    
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
    
    return {"changes": changes}


def _build_trend_rows(
    rows: List[Dict],
    selected_carriers: Optional[List[str]],
    fuel_category: Optional[str]
) -> List[Dict]:
    """
    Build per-date trend rows with fair averaging rules:
    - For specific categories: return the direct value per carrier/date.
    - For "all" categories: only average across categories present
      for every selected carrier on that date.
    """
    if not rows:
        return []

    data_by_date: Dict[str, Dict[str, Dict[str, float]]] = {}

    for row in rows:
        value = row.get("value_numeric")
        if value is None:
            continue
        unit = (row.get("value_unit") or "").lower()
        if unit and unit not in ("percent", "%"):
            # Skip non-percentage entries for surcharge trends
            continue

        carrier = row["carrier"]
        category = row["fuel_category"]
        date = row["date"]

        date_entry = data_by_date.setdefault(date, {})
        carrier_entry = date_entry.setdefault(carrier, {})
        carrier_entry[category] = value

    available_carriers = sorted({carrier for date_data in data_by_date.values() for carrier in date_data.keys()})
    if selected_carriers:
        carrier_scope = [carrier for carrier in selected_carriers if carrier in available_carriers]
    else:
        carrier_scope = available_carriers

    if not carrier_scope:
        return []

    trends: List[Dict] = []

    for date in sorted(data_by_date.keys(), reverse=True):
        date_data = data_by_date[date]

        if fuel_category and fuel_category != "all":
            for carrier in carrier_scope:
                value = date_data.get(carrier, {}).get(fuel_category)
                if value is not None:
                    trends.append({
                        "carrier": carrier,
                        "date": date,
                        "avg_surcharge": round(value, 4)
                    })
            continue

        # "All" services view: require every selected carrier to have data on this date
        if any(carrier not in date_data for carrier in carrier_scope):
            continue

        category_sets = [set(date_data[carrier].keys()) for carrier in carrier_scope]
        if not all(category_sets):
            continue

        common_categories = set.intersection(*category_sets) if category_sets else set()
        if not common_categories:
            continue

        for carrier in carrier_scope:
            values = [date_data[carrier][category] for category in common_categories]
            if not values:
                continue
            avg_value = sum(values) / len(values)
            trends.append({
                "carrier": carrier,
                "date": date,
                "avg_surcharge": round(avg_value, 4)
            })

    return trends

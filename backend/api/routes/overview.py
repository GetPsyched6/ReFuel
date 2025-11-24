"""
API routes for overview analytics
"""
from fastapi import APIRouter, Depends, Query
from typing import Optional
from models.database import get_db, Database
from services.overview_analytics import OverviewAnalytics, ComparisonContext

router = APIRouter()


@router.get("/analytics")
async def get_overview_analytics(
    market: str = Query(..., description="Market/country code (e.g., US, DE)"),
    fuel_category: str = Query(..., description="Fuel category for like-for-like comparison"),
    outlier_threshold: float = Query(2.0, description="Outlier threshold in percentage points"),
    db: Database = Depends(get_db)
):
    """
    Get overview analytics for a specific comparison context
    
    Returns time series, recent movements, outliers, and new visualizations
    """
    history_query = """
        SELECT 
            carrier,
            service,
            market,
            fuel_category,
            fuel_type,
            DATE(effective_start) as effective_start,
            value_numeric,
            value_text,
            value_unit
        FROM fuel_surcharge_history
        WHERE market = ? AND fuel_category = ?
        ORDER BY effective_start ASC, carrier
    """
    
    history_rows = await db.execute_query(history_query, (market, fuel_category))
    
    band_query = """
        SELECT 
            carrier,
            service,
            market,
            fuel_category,
            at_least_usd,
            but_less_than_usd,
            surcharge_pct
        FROM fuel_surcharges
        WHERE market = ? AND fuel_category = ?
        ORDER BY carrier, at_least_usd
    """
    
    band_rows = await db.execute_query(band_query, (market, fuel_category))
    
    context = ComparisonContext(market=market, fuel_category=fuel_category)
    analytics = OverviewAnalytics(outlier_threshold_pp=outlier_threshold)
    
    overview = analytics.generate_overview(history_rows, context, band_rows)
    
    return {
        "success": True,
        "data": overview
    }


@router.get("/available-contexts")
async def get_available_contexts(
    db: Database = Depends(get_db)
):
    """
    Get all available comparison contexts (market + fuel_category combinations)
    with carrier counts
    """
    query = """
        SELECT 
            market,
            fuel_category,
            COUNT(DISTINCT carrier) as carrier_count,
            GROUP_CONCAT(DISTINCT carrier) as carriers
        FROM fuel_surcharge_history
        GROUP BY market, fuel_category
        HAVING COUNT(DISTINCT carrier) > 0
        ORDER BY market, fuel_category
    """
    
    rows = await db.execute_query(query)
    
    contexts = []
    for row in rows:
        contexts.append({
            "market": row["market"],
            "fuel_category": row["fuel_category"],
            "carrier_count": row["carrier_count"],
            "carriers": row["carriers"].split(",") if row["carriers"] else [],
            "comparison_available": row["carrier_count"] >= 2
        })
    
    return {
        "success": True,
        "data": contexts
    }


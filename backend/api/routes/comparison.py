"""
Comparison API routes
"""
from fastapi import APIRouter, Query
from typing import Optional, List

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from models.schemas import ComparisonView, ComparisonResponse
from services.comparison_service import comparison_service

router = APIRouter()


def _normalize_list_param(values: Optional[List[str]]) -> List[str]:
    """Ensure query params support comma-separated or repeated values."""
    if not values:
        return []

    normalized: List[str] = []
    for value in values:
        if not value:
            continue
        parts = [part.strip() for part in value.split(",") if part.strip()]
        normalized.extend(parts)

    deduped: List[str] = []
    seen = set()
    for item in normalized:
        if item not in seen:
            deduped.append(item)
            seen.add(item)
    return deduped


@router.get("/compare", response_model=dict)
async def get_comparison(
    view: ComparisonView = Query(ComparisonView.NORMALIZED),
    session_id: Optional[int] = None,
    curve_version_ids: Optional[str] = Query(None, description="Comma-separated list of fuel curve version IDs to compare"),
    include_previous: bool = Query(False),
    fuel_type: Optional[str] = Query(None, description="Filter by raw fuel type label"),
    fuel_category: Optional[str] = Query(None, description="Canonical fuel category (e.g., ground_domestic)"),
    market: Optional[str] = Query(None, description="Market/country code"),
    service: Optional[str] = Query(None, description="Filter by service label"),
    carriers: Optional[List[str]] = Query(None, description="List of carriers to include")
):
    """
    Get comparison data for specified view type
    
    - **view**: normalized (default), normalized_fine, overlap, comparable, or complete
    - **session_id**: Specific session (None = latest) - LEGACY MODE
    - **curve_version_ids**: Comma-separated list of fuel curve version IDs (e.g., "23,10") - NEW MODE (overrides session_id)
    - **include_previous**: Include previous session data for change detection
    """
    normalized_carriers = _normalize_list_param(carriers)

    # NEW MODE: Multiple curve versions
    if curve_version_ids:
        # Parse comma-separated curve_version_ids
        parsed_ids = [int(id.strip()) for id in curve_version_ids.split(",") if id.strip().isdigit()]
        if not parsed_ids:
            return {"error": "Invalid curve_version_ids format", "curves": [], "view_type": view}
        
        return await comparison_service.get_comparison_multi_curves(
            parsed_ids,
            view,
            fuel_type=fuel_type,
            service_name=service,
            fuel_category=fuel_category,
            market=market,
            carriers=normalized_carriers
        )
    
    # LEGACY MODE: Single session
    return await comparison_service.get_comparison(
        session_id,
        view,
        include_previous,
        fuel_type=fuel_type,
        service_name=service,
        fuel_category=fuel_category,
        market=market,
        carriers=normalized_carriers
    )


@router.get("/carrier/{carrier_name}")
async def get_carrier_focus(
    carrier_name: str,
    session_id: Optional[int] = None,
    fuel_type: Optional[str] = Query(None),
    fuel_category: Optional[str] = Query(None),
    market: Optional[str] = Query(None),
    service: Optional[str] = Query(None)
):
    """
    Get focused comparison for a specific carrier
    Shows ranges where carrier is most competitive
    """
    carrier = carrier_name.strip()
    return await comparison_service.get_carrier_focus(
        carrier,
        session_id,
        fuel_type=fuel_type,
        service_name=service,
        fuel_category=fuel_category,
        market=market
    )


@router.get("/carrier-last-updates", response_model=dict)
async def get_carrier_last_updates(
    session_id: Optional[int] = None,
    fuel_type: Optional[str] = Query(None),
    fuel_category: Optional[str] = Query(None),
    market: Optional[str] = Query(None)
):
    """
    Get the last update date for each carrier
    Returns when each carrier's data last changed from the previous session
    
    - **session_id**: Current session (None = latest)
    """
    return await comparison_service.get_carrier_last_updates(
        session_id,
        fuel_type=fuel_type,
        fuel_category=fuel_category,
        market=market
    )


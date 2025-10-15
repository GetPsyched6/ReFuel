"""
Comparison API routes
"""
from fastapi import APIRouter, Query
from typing import Optional

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from models.schemas import ComparisonView, ComparisonResponse
from services.comparison_service import comparison_service

router = APIRouter()


@router.get("/compare", response_model=dict)
async def get_comparison(
    view: ComparisonView = Query(ComparisonView.NORMALIZED),
    session_id: Optional[int] = None
):
    """
    Get comparison data for specified view type
    
    - **view**: normalized (default), overlap, or complete
    - **session_id**: Specific session (None = latest)
    """
    return await comparison_service.get_comparison(session_id, view)


@router.get("/carrier/{carrier_name}")
async def get_carrier_focus(
    carrier_name: str,
    session_id: Optional[int] = None
):
    """
    Get focused comparison for a specific carrier
    Shows ranges where carrier is most competitive
    """
    # Validate carrier name
    valid_carriers = ['UPS', 'FedEx', 'DHL']
    carrier = carrier_name.upper()
    
    if carrier not in valid_carriers:
        return {"error": f"Invalid carrier. Must be one of: {', '.join(valid_carriers)}"}
    
    return await comparison_service.get_carrier_focus(carrier, session_id)


"""
DHL Germany Weekly Mapper

Maps DHL Germany monthly surcharge data to weekly dates using the official
DHL averaging window logic.

DHL Rule:
For a DHL surcharge month M (e.g. "December 2025"):
- The averaging window is: [thirdRelease(M-2), thirdRelease(M-1))
- Where thirdRelease(X) = the 3rd DOE weekly fuel price release in month X

We approximate thirdRelease using UPS weekly dates:
- Group UPS weekly dates by calendar month
- thirdRelease(month X) = the 3rd UPS weekly date in that month
"""

from datetime import datetime
from typing import List, Dict, Optional
from collections import defaultdict


# Source data: DHL Germany monthly surcharges
DHL_GERMANY_MONTHLY = {
    "ground_domestic": {
        "2025-10": {"surcharge": 18.75, "text": "18.75%"},
        "2025-11": {"surcharge": 18.50, "text": "18.50%"},
        "2025-12": {"surcharge": 19.50, "text": "19.50%"},
    },
    "international_air_export": {
        "2025-10": {"surcharge": 29.75, "text": "29.75%"},
        "2025-11": {"surcharge": 30.00, "text": "30.00%"},
        "2025-12": {"surcharge": 31.50, "text": "31.50%"},
    },
    "international_air_import": {
        "2025-10": {"surcharge": 29.75, "text": "29.75%"},
        "2025-11": {"surcharge": 30.00, "text": "30.00%"},
        "2025-12": {"surcharge": 31.50, "text": "31.50%"},
    },
}


def _parse_month_key(month_key: str) -> tuple:
    """Parse 'YYYY-MM' into (year, month)"""
    parts = month_key.split("-")
    return int(parts[0]), int(parts[1])


def _get_prev_month(year: int, month: int) -> tuple:
    """Get previous month as (year, month)"""
    if month == 1:
        return (year - 1, 12)
    return (year, month - 1)


def _get_third_release_date(weekly_dates_by_month: Dict[tuple, List[str]], year: int, month: int) -> Optional[str]:
    """
    Get the 3rd DOE weekly release date for a given month.
    Returns None if there are fewer than 3 weeks in that month.
    """
    key = (year, month)
    dates = weekly_dates_by_month.get(key, [])
    if len(dates) >= 3:
        return dates[2]  # 3rd week (0-indexed)
    return None


def compute_dhl_weekly_windows(weekly_dates: List[str], fuel_category: str) -> List[Dict]:
    """
    Compute DHL Germany weekly windows for a specific fuel category.
    
    Args:
        weekly_dates: List of weekly date strings (e.g. ['2025-09-01', '2025-09-08', ...])
                     These should be sorted chronologically
        fuel_category: One of 'ground_domestic', 'international_air_export', 'international_air_import'
    
    Returns:
        List of dicts with keys:
        - date: Weekly date string (YYYY-MM-DD)
        - dhl_month: DHL surcharge month label (e.g. "2025-10")
        - surcharge: Numeric surcharge value
        - value_text: Text representation (e.g. "29.75%")
    """
    if fuel_category not in DHL_GERMANY_MONTHLY:
        return []
    
    monthly_data = DHL_GERMANY_MONTHLY[fuel_category]
    
    # Group weekly dates by (year, month)
    weekly_dates_by_month = defaultdict(list)
    for date_str in weekly_dates:
        dt = datetime.fromisoformat(date_str)
        key = (dt.year, dt.month)
        weekly_dates_by_month[key].append(date_str)
    
    # Sort dates within each month
    for key in weekly_dates_by_month:
        weekly_dates_by_month[key].sort()
    
    # Build windows for each DHL month
    result = []
    
    for dhl_month_key, dhl_data in monthly_data.items():
        year, month = _parse_month_key(dhl_month_key)
        
        # Compute M-2 and M-1
        m_minus_1_year, m_minus_1_month = _get_prev_month(year, month)
        m_minus_2_year, m_minus_2_month = _get_prev_month(m_minus_1_year, m_minus_1_month)
        
        # Get third release dates
        start_date = _get_third_release_date(weekly_dates_by_month, m_minus_2_year, m_minus_2_month)
        end_date = _get_third_release_date(weekly_dates_by_month, m_minus_1_year, m_minus_1_month)
        
        # Fallback logic if we can't get third release
        if start_date is None:
            # If M-2 doesn't have 3 weeks, use the earliest available date in M-2
            m_minus_2_key = (m_minus_2_year, m_minus_2_month)
            if m_minus_2_key in weekly_dates_by_month and weekly_dates_by_month[m_minus_2_key]:
                start_date = weekly_dates_by_month[m_minus_2_key][0]  # Use first available
        
        if end_date is None:
            # If M-1 doesn't have 3 weeks, use the earliest available date in M-1
            m_minus_1_key = (m_minus_1_year, m_minus_1_month)
            if m_minus_1_key in weekly_dates_by_month and weekly_dates_by_month[m_minus_1_key]:
                end_date = weekly_dates_by_month[m_minus_1_key][0]  # Use first available
        
        if start_date is None or end_date is None:
            # Still can't compute window - skip this DHL month
            continue
        
        # Assign DHL surcharge to all weekly dates in [start_date, end_date)
        for date_str in weekly_dates:
            if start_date <= date_str < end_date:
                result.append({
                    "date": date_str,
                    "dhl_month": dhl_month_key,
                    "surcharge": dhl_data["surcharge"],
                    "value_text": dhl_data["text"],
                })
    
    return result


def generate_dhl_germany_weekly_rows(market: str = "DE") -> List[Dict]:
    """
    Generate DHL Germany weekly historical rows for insertion into fuel_surcharge_history.
    
    This function:
    1. Queries existing UPS weekly dates from the database (or uses provided list)
    2. Computes DHL windows for each fuel category
    3. Returns rows ready for database insertion
    
    For now, we'll return a list of dicts that can be inserted directly.
    The caller must provide the UPS weekly dates.
    """
    # This function will be called with UPS weekly dates as input
    # For now, return empty list - the actual integration will provide dates
    pass


def get_dhl_value_for_date(date_str: str, fuel_category: str, weekly_dates: List[str]) -> Optional[Dict]:
    """
    Get DHL surcharge for a specific date and fuel category.
    
    Args:
        date_str: Date string (YYYY-MM-DD)
        fuel_category: Fuel category
        weekly_dates: All available weekly dates for window computation
    
    Returns:
        Dict with 'surcharge' and 'value_text' keys, or None if no match
    """
    windows = compute_dhl_weekly_windows(weekly_dates, fuel_category)
    for window in windows:
        if window["date"] == date_str:
            return {
                "surcharge": window["surcharge"],
                "value_text": window["value_text"],
                "dhl_month": window["dhl_month"],
            }
    return None


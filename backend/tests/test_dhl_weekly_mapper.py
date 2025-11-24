"""
Unit tests for DHL Germany Weekly Mapper

Tests the window computation logic to ensure DHL monthly surcharges
are correctly mapped to weekly dates.
"""

import pytest
from backend.services.dhl_germany_weekly_mapper import (
    compute_dhl_weekly_windows,
    _get_prev_month,
    _get_third_release_date,
)


def test_get_prev_month():
    """Test month subtraction logic"""
    assert _get_prev_month(2025, 3) == (2025, 2)
    assert _get_prev_month(2025, 1) == (2024, 12)
    assert _get_prev_month(2024, 12) == (2024, 11)


def test_get_third_release_date():
    """Test extraction of 3rd weekly date from a month"""
    weekly_dates_by_month = {
        (2025, 9): ["2025-09-01", "2025-09-08", "2025-09-15", "2025-09-22", "2025-09-29"],
        (2025, 10): ["2025-10-06", "2025-10-13", "2025-10-20", "2025-10-27"],
    }
    
    # 3rd release in September is 2025-09-15 (index 2)
    assert _get_third_release_date(weekly_dates_by_month, 2025, 9) == "2025-09-15"
    
    # 3rd release in October is 2025-10-20
    assert _get_third_release_date(weekly_dates_by_month, 2025, 10) == "2025-10-20"
    
    # Non-existent month returns None
    assert _get_third_release_date(weekly_dates_by_month, 2025, 11) is None


def test_dhl_october_air_window():
    """
    Test DHL October 2025 air surcharge (29.75%)
    
    For October 2025:
    - M = 2025-10
    - M-2 = 2025-08, M-1 = 2025-09
    - Window: [thirdRelease(2025-08), thirdRelease(2025-09))
    
    With our sample data:
    - August 3rd release: 2025-08-18 (assuming)
    - September 3rd release: 2025-09-15
    - Window: [2025-08-18, 2025-09-15)
    
    So 29.75% should appear on dates: 2025-08-25, 2025-09-01, 2025-09-08
    """
    weekly_dates = [
        "2025-08-11",
        "2025-08-18",  # 3rd week of August
        "2025-08-25",
        "2025-09-01",
        "2025-09-08",
        "2025-09-15",  # 3rd week of September
        "2025-09-22",
        "2025-09-29",
        "2025-10-06",
        "2025-10-13",
        "2025-10-20",  # 3rd week of October
        "2025-10-27",
        "2025-11-03",
        "2025-11-10",
        "2025-11-17",  # 3rd week of November
        "2025-11-24",
    ]
    
    windows = compute_dhl_weekly_windows(weekly_dates, "international_air_export")
    
    # Extract dates for October DHL month (29.75%)
    october_dates = [w["date"] for w in windows if w["dhl_month"] == "2025-10"]
    
    # Should appear on multiple weeks, not just one
    assert len(october_dates) > 1, "October surcharge should appear on multiple weeks"
    
    # Should cover late August through mid-September
    assert "2025-08-25" in october_dates
    assert "2025-09-01" in october_dates
    assert "2025-09-08" in october_dates
    
    # Should NOT appear after 2025-09-15 (exclusive end)
    assert "2025-09-15" not in october_dates
    
    # Verify surcharge value
    for window in windows:
        if window["dhl_month"] == "2025-10":
            assert window["surcharge"] == 29.75
            assert window["value_text"] == "29.75%"


def test_dhl_november_air_window():
    """
    Test DHL November 2025 air surcharge (30.00%)
    
    For November 2025:
    - M = 2025-11
    - M-2 = 2025-09, M-1 = 2025-10
    - Window: [thirdRelease(2025-09), thirdRelease(2025-10))
    - Window: [2025-09-15, 2025-10-20)
    
    So 30.00% should appear on dates: 2025-09-15, 2025-09-22, 2025-09-29,
                                       2025-10-06, 2025-10-13
    """
    weekly_dates = [
        "2025-08-11",
        "2025-08-18",
        "2025-08-25",
        "2025-09-01",
        "2025-09-08",
        "2025-09-15",  # Start of November window
        "2025-09-22",
        "2025-09-29",
        "2025-10-06",
        "2025-10-13",
        "2025-10-20",  # End of November window (exclusive)
        "2025-10-27",
        "2025-11-03",
        "2025-11-10",
        "2025-11-17",
        "2025-11-24",
    ]
    
    windows = compute_dhl_weekly_windows(weekly_dates, "international_air_export")
    
    november_dates = [w["date"] for w in windows if w["dhl_month"] == "2025-11"]
    
    assert len(november_dates) > 1, "November surcharge should appear on multiple weeks"
    
    # Should start at 2025-09-15
    assert "2025-09-15" in november_dates
    assert "2025-09-22" in november_dates
    assert "2025-09-29" in november_dates
    assert "2025-10-06" in november_dates
    assert "2025-10-13" in november_dates
    
    # Should NOT appear at or after 2025-10-20 (exclusive end)
    assert "2025-10-20" not in november_dates
    
    for window in windows:
        if window["dhl_month"] == "2025-11":
            assert window["surcharge"] == 30.00
            assert window["value_text"] == "30.00%"


def test_dhl_december_air_window():
    """
    Test DHL December 2025 air surcharge (31.50%)
    
    For December 2025:
    - M = 2025-12
    - M-2 = 2025-10, M-1 = 2025-11
    - Window: [thirdRelease(2025-10), thirdRelease(2025-11))
    - Window: [2025-10-20, 2025-11-17)
    
    So 31.50% should appear on dates: 2025-10-20, 2025-10-27, 2025-11-03, 2025-11-10
    """
    weekly_dates = [
        "2025-08-11",
        "2025-08-18",
        "2025-08-25",
        "2025-09-01",
        "2025-09-08",
        "2025-09-15",
        "2025-09-22",
        "2025-09-29",
        "2025-10-06",
        "2025-10-13",
        "2025-10-20",  # Start of December window
        "2025-10-27",
        "2025-11-03",
        "2025-11-10",
        "2025-11-17",  # End of December window (exclusive)
        "2025-11-24",
    ]
    
    windows = compute_dhl_weekly_windows(weekly_dates, "international_air_export")
    
    december_dates = [w["date"] for w in windows if w["dhl_month"] == "2025-12"]
    
    assert len(december_dates) > 1, "December surcharge should appear on multiple weeks"
    
    assert "2025-10-20" in december_dates
    assert "2025-10-27" in december_dates
    assert "2025-11-03" in december_dates
    assert "2025-11-10" in december_dates
    
    # Should NOT appear at or after 2025-11-17
    assert "2025-11-17" not in december_dates
    
    for window in windows:
        if window["dhl_month"] == "2025-12":
            assert window["surcharge"] == 31.50
            assert window["value_text"] == "31.50%"


def test_dhl_ground_domestic():
    """
    Test DHL ground domestic surcharges use the same window logic
    but with different percentage values.
    """
    weekly_dates = [
        "2025-08-11",
        "2025-08-18",
        "2025-08-25",
        "2025-09-01",
        "2025-09-08",
        "2025-09-15",
        "2025-09-22",
        "2025-09-29",
        "2025-10-06",
        "2025-10-13",
        "2025-10-20",
        "2025-10-27",
        "2025-11-03",
        "2025-11-10",
        "2025-11-17",
        "2025-11-24",
    ]
    
    windows = compute_dhl_weekly_windows(weekly_dates, "ground_domestic")
    
    # Check October ground (18.75%)
    october_windows = [w for w in windows if w["dhl_month"] == "2025-10"]
    assert len(october_windows) > 0
    assert all(w["surcharge"] == 18.75 for w in october_windows)
    assert all(w["value_text"] == "18.75%" for w in october_windows)
    
    # Check November ground (18.50%)
    november_windows = [w for w in windows if w["dhl_month"] == "2025-11"]
    assert len(november_windows) > 0
    assert all(w["surcharge"] == 18.50 for w in november_windows)
    
    # Check December ground (19.50%)
    december_windows = [w for w in windows if w["dhl_month"] == "2025-12"]
    assert len(december_windows) > 0
    assert all(w["surcharge"] == 19.50 for w in december_windows)


def test_no_1st_of_month_dates():
    """
    Verify that DHL surcharges are assigned to actual weekly dates,
    not standalone 1st-of-month dates.
    """
    weekly_dates = [
        "2025-08-18",
        "2025-08-25",
        "2025-09-01",
        "2025-09-08",
        "2025-09-15",
        "2025-09-22",
        "2025-09-29",
        "2025-10-06",
        "2025-10-13",
        "2025-10-20",
        "2025-10-27",
        "2025-11-03",
        "2025-11-10",
        "2025-11-17",
        "2025-11-24",
    ]
    
    windows = compute_dhl_weekly_windows(weekly_dates, "international_air_export")
    
    # Get all dates that have DHL values
    dhl_dates = [w["date"] for w in windows]
    
    # None of these should be standalone 1st-of-month dates that aren't in weekly_dates
    for date in dhl_dates:
        assert date in weekly_dates, f"DHL date {date} should be an actual UPS weekly date"
    
    # Specifically check no YYYY-10-01, YYYY-11-01, YYYY-12-01 patterns
    # unless they happen to be actual UPS weeks
    assert "2025-10-01" not in dhl_dates  # This is not a UPS week in our sample
    assert "2025-11-01" not in dhl_dates  # This is not a UPS week in our sample
    assert "2025-12-01" not in dhl_dates  # This is not a UPS week in our sample


def test_all_categories_have_same_date_coverage():
    """
    All three DHL categories should cover the same set of dates
    (though with different surcharge values).
    """
    weekly_dates = [
        "2025-08-18",
        "2025-08-25",
        "2025-09-01",
        "2025-09-08",
        "2025-09-15",
        "2025-09-22",
        "2025-09-29",
        "2025-10-06",
        "2025-10-13",
        "2025-10-20",
        "2025-10-27",
        "2025-11-03",
        "2025-11-10",
        "2025-11-17",
        "2025-11-24",
    ]
    
    ground_windows = compute_dhl_weekly_windows(weekly_dates, "ground_domestic")
    air_export_windows = compute_dhl_weekly_windows(weekly_dates, "international_air_export")
    air_import_windows = compute_dhl_weekly_windows(weekly_dates, "international_air_import")
    
    ground_dates = sorted(set(w["date"] for w in ground_windows))
    air_export_dates = sorted(set(w["date"] for w in air_export_windows))
    air_import_dates = sorted(set(w["date"] for w in air_import_windows))
    
    # All should cover the same dates
    assert ground_dates == air_export_dates
    assert air_export_dates == air_import_dates
    
    # But surcharge values should differ between ground and air
    ground_surcharges = {w["surcharge"] for w in ground_windows}
    air_surcharges = {w["surcharge"] for w in air_export_windows}
    assert ground_surcharges != air_surcharges



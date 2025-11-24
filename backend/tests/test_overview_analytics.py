"""
Unit tests for overview analytics module
"""
import pytest
from services.overview_analytics import OverviewAnalytics, ComparisonContext


@pytest.fixture
def sample_data():
    """Sample historical data for testing"""
    return [
        # DE ground_domestic - 3 carriers
        {'carrier': 'UPS', 'service': 'Ground', 'market': 'DE', 'fuel_category': 'ground_domestic',
         'effective_start': '2025-11-17', 'value_numeric': 21.5},
        {'carrier': 'FedEx', 'service': 'Ground', 'market': 'DE', 'fuel_category': 'ground_domestic',
         'effective_start': '2025-11-17', 'value_numeric': 18.5},
        {'carrier': 'DHL', 'service': 'Ground', 'market': 'DE', 'fuel_category': 'ground_domestic',
         'effective_start': '2025-11-17', 'value_numeric': 19.5},
        {'carrier': 'UPS', 'service': 'Ground', 'market': 'DE', 'fuel_category': 'ground_domestic',
         'effective_start': '2025-11-10', 'value_numeric': 21.25},
        {'carrier': 'FedEx', 'service': 'Ground', 'market': 'DE', 'fuel_category': 'ground_domestic',
         'effective_start': '2025-11-10', 'value_numeric': 18.0},
        {'carrier': 'DHL', 'service': 'Ground', 'market': 'DE', 'fuel_category': 'ground_domestic',
         'effective_start': '2025-11-10', 'value_numeric': 19.5},
        # US ground_domestic - 2 carriers
        {'carrier': 'UPS', 'service': 'Ground', 'market': 'US', 'fuel_category': 'ground_domestic',
         'effective_start': '2025-11-17', 'value_numeric': 22.0},
        {'carrier': 'FedEx', 'service': 'Ground', 'market': 'US', 'fuel_category': 'ground_domestic',
         'effective_start': '2025-11-17', 'value_numeric': 20.5},
        # DE international_air_export - 1 carrier
        {'carrier': 'DHL', 'service': 'Air', 'market': 'DE', 'fuel_category': 'international_air_export',
         'effective_start': '2025-11-17', 'value_numeric': 30.0},
    ]


@pytest.fixture
def analytics():
    """Analytics instance with 2.0pp threshold"""
    return OverviewAnalytics(outlier_threshold_pp=2.0)


def test_context_matching(sample_data):
    """Test context filtering"""
    context = ComparisonContext('DE', 'ground_domestic')
    analytics = OverviewAnalytics()
    
    filtered = analytics.filter_by_context(sample_data, context)
    
    assert len(filtered) == 6
    assert all(row['market'] == 'DE' for row in filtered)
    assert all(row['fuel_category'] == 'ground_domestic' for row in filtered)


def test_carriers_extraction(sample_data, analytics):
    """Test carrier extraction from filtered data"""
    context = ComparisonContext('DE', 'ground_domestic')
    filtered = analytics.filter_by_context(sample_data, context)
    
    carriers = analytics.get_carriers_in_context(filtered)
    
    assert len(carriers) == 3
    assert 'UPS' in carriers
    assert 'FedEx' in carriers
    assert 'DHL' in carriers


def test_time_series_build(sample_data, analytics):
    """Test time series data construction"""
    context = ComparisonContext('DE', 'ground_domestic')
    filtered = analytics.filter_by_context(sample_data, context)
    
    time_series = analytics.build_time_series(filtered)
    
    assert 'UPS' in time_series
    assert 'FedEx' in time_series
    assert 'DHL' in time_series
    
    # Check UPS has 2 data points
    assert len(time_series['UPS']) == 2
    assert time_series['UPS'][0]['date'] == '2025-11-10'
    assert time_series['UPS'][1]['date'] == '2025-11-17'
    
    # Check values
    assert time_series['UPS'][0]['value'] == 21.25
    assert time_series['UPS'][1]['value'] == 21.5


def test_recent_movement(sample_data, analytics):
    """Test recent movement calculation"""
    context = ComparisonContext('DE', 'ground_domestic')
    filtered = analytics.filter_by_context(sample_data, context)
    
    movements = analytics.calculate_recent_movement(filtered)
    
    assert len(movements) == 3
    
    # Find FedEx movement (should have largest delta)
    fedex_movement = next(m for m in movements if m['carrier'] == 'FedEx')
    assert fedex_movement['delta_pp'] == 0.5
    assert fedex_movement['direction'] == 'Up'
    assert fedex_movement['latest_pct'] == 18.5
    
    # Find UPS movement
    ups_movement = next(m for m in movements if m['carrier'] == 'UPS')
    assert ups_movement['delta_pp'] == 0.25
    assert ups_movement['direction'] == 'Up'
    
    # Find DHL movement (flat)
    dhl_movement = next(m for m in movements if m['carrier'] == 'DHL')
    assert dhl_movement['delta_pp'] == 0.0
    assert dhl_movement['direction'] == 'Flat'


def test_outlier_detection(analytics):
    """Test outlier detection with known outliers"""
    # Create data with clear outliers
    data = [
        {'carrier': 'UPS', 'service': 'Ground', 'market': 'DE', 'fuel_category': 'ground_domestic',
         'effective_start': '2025-11-17', 'value_numeric': 25.0},  # Outlier: high
        {'carrier': 'FedEx', 'service': 'Ground', 'market': 'DE', 'fuel_category': 'ground_domestic',
         'effective_start': '2025-11-17', 'value_numeric': 18.5},
        {'carrier': 'DHL', 'service': 'Ground', 'market': 'DE', 'fuel_category': 'ground_domestic',
         'effective_start': '2025-11-17', 'value_numeric': 19.0},
    ]
    
    outliers = analytics.detect_outliers(data)
    
    # Median of 18.5, 19.0, 25.0 = 19.0
    # UPS delta = 25.0 - 19.0 = 6.0pp (outlier)
    # FedEx delta = 18.5 - 19.0 = -0.5pp (not outlier)
    # DHL delta = 19.0 - 19.0 = 0.0pp (not outlier)
    
    assert len(outliers) == 1
    assert outliers[0]['carrier'] == 'UPS'
    assert outliers[0]['delta_pp'] == 6.0
    assert outliers[0]['surcharge_pct'] == 25.0
    assert outliers[0]['median_pct'] == 19.0


def test_no_outliers_when_close(analytics):
    """Test no outliers detected when all values are close"""
    data = [
        {'carrier': 'UPS', 'service': 'Ground', 'market': 'DE', 'fuel_category': 'ground_domestic',
         'effective_start': '2025-11-17', 'value_numeric': 19.5},
        {'carrier': 'FedEx', 'service': 'Ground', 'market': 'DE', 'fuel_category': 'ground_domestic',
         'effective_start': '2025-11-17', 'value_numeric': 19.0},
        {'carrier': 'DHL', 'service': 'Ground', 'market': 'DE', 'fuel_category': 'ground_domestic',
         'effective_start': '2025-11-17', 'value_numeric': 18.8},
    ]
    
    outliers = analytics.detect_outliers(data)
    assert len(outliers) == 0


def test_single_carrier_context(sample_data, analytics):
    """Test behavior with single carrier context"""
    context = ComparisonContext('DE', 'international_air_export')
    
    overview = analytics.generate_overview(sample_data, context)
    
    assert overview['num_carriers'] == 1
    assert overview['comparison_available'] == False
    assert len(overview['outliers']) == 0  # No outliers with single carrier
    assert len(overview['recent_movement']) == 0  # Not enough data points


def test_multi_carrier_context(sample_data, analytics):
    """Test full overview with multi-carrier context"""
    context = ComparisonContext('DE', 'ground_domestic')
    
    overview = analytics.generate_overview(sample_data, context)
    
    assert overview['num_carriers'] == 3
    assert overview['comparison_available'] == True
    assert len(overview['carriers']) == 3
    assert len(overview['time_series']) == 3
    assert len(overview['recent_movement']) == 3
    assert overview['context']['market'] == 'DE'
    assert overview['context']['fuel_category'] == 'ground_domestic'


def test_empty_data(analytics):
    """Test handling of empty data"""
    context = ComparisonContext('XX', 'unknown')
    
    overview = analytics.generate_overview([], context)
    
    assert overview['num_carriers'] == 0
    assert overview['comparison_available'] == False
    assert len(overview['time_series']) == 0
    assert len(overview['recent_movement']) == 0
    assert len(overview['outliers']) == 0


def test_custom_outlier_threshold():
    """Test custom outlier threshold"""
    analytics_strict = OverviewAnalytics(outlier_threshold_pp=0.5)
    
    data = [
        {'carrier': 'UPS', 'service': 'Ground', 'market': 'DE', 'fuel_category': 'ground_domestic',
         'effective_start': '2025-11-17', 'value_numeric': 20.0},
        {'carrier': 'FedEx', 'service': 'Ground', 'market': 'DE', 'fuel_category': 'ground_domestic',
         'effective_start': '2025-11-17', 'value_numeric': 19.0},
        {'carrier': 'DHL', 'service': 'Ground', 'market': 'DE', 'fuel_category': 'ground_domestic',
         'effective_start': '2025-11-17', 'value_numeric': 19.0},
    ]
    
    # Median = 19.0, UPS delta = 1.0pp, which exceeds 0.5pp threshold
    outliers = analytics_strict.detect_outliers(data)
    
    assert len(outliers) == 1
    assert outliers[0]['carrier'] == 'UPS'


def test_no_comparison_with_single_carrier():
    """Test that comparison_available is False with single carrier"""
    analytics = OverviewAnalytics()
    
    data = [
        {'carrier': 'UPS', 'service': 'Ground', 'market': 'US', 'fuel_category': 'ground_domestic',
         'effective_start': '2025-11-17', 'value_numeric': 20.0},
        {'carrier': 'UPS', 'service': 'Ground', 'market': 'US', 'fuel_category': 'ground_domestic',
         'effective_start': '2025-11-10', 'value_numeric': 19.5},
    ]
    
    context = ComparisonContext('US', 'ground_domestic')
    overview = analytics.generate_overview(data, context)
    
    assert overview['num_carriers'] == 1
    assert overview['comparison_available'] == False
    assert len(overview['outliers']) == 0


if __name__ == '__main__':
    pytest.main([__file__, '-v'])



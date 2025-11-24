import pytest
from typing import List, Dict


def find_inflection(bands: List[Dict]) -> float | None:
    if len(bands) < 4:
        return None

    sorted_bands = sorted(bands, key=lambda b: b['at_least_usd'])
    
    step_widths = [
        band['but_less_than_usd'] - band['at_least_usd']
        for band in sorted_bands
    ]

    if len(step_widths) < 4:
        return None

    early_window_size = min(3, len(step_widths) * 3 // 10)
    early_widths = step_widths[:early_window_size]
    baseline_width = sum(early_widths) / len(early_widths)

    threshold = baseline_width * 0.7
    min_consecutive = 2

    for i in range(early_window_size, len(step_widths) - min_consecutive + 1):
        consecutive_count = 0
        for j in range(i, min(len(step_widths), i + 4)):
            if step_widths[j] < threshold:
                consecutive_count += 1
            else:
                break

        if consecutive_count >= min_consecutive:
            return sorted_bands[i]['at_least_usd']

    inverse_threshold = baseline_width * 1.3
    for i in range(early_window_size, len(step_widths) - min_consecutive + 1):
        consecutive_count = 0
        for j in range(i, min(len(step_widths), i + 4)):
            if step_widths[j] > inverse_threshold:
                consecutive_count += 1
            else:
                break

        if consecutive_count >= min_consecutive:
            return sorted_bands[i]['at_least_usd']

    return None


class TestInflectionDetection:
    def test_basic_inflection_wide_to_narrow(self):
        bands = [
            {'at_least_usd': 2.00, 'but_less_than_usd': 2.10, 'surcharge_pct': 18.00},
            {'at_least_usd': 2.10, 'but_less_than_usd': 2.20, 'surcharge_pct': 18.25},
            {'at_least_usd': 2.20, 'but_less_than_usd': 2.22, 'surcharge_pct': 18.50},
            {'at_least_usd': 2.22, 'but_less_than_usd': 2.24, 'surcharge_pct': 18.75},
        ]
        
        result = find_inflection(bands)
        assert result == 2.20, f"Expected inflection at 2.20, got {result}"

    def test_inflection_with_more_bands(self):
        bands = [
            {'at_least_usd': 2.00, 'but_less_than_usd': 2.27, 'surcharge_pct': 18.00},
            {'at_least_usd': 2.27, 'but_less_than_usd': 2.54, 'surcharge_pct': 18.25},
            {'at_least_usd': 2.54, 'but_less_than_usd': 2.81, 'surcharge_pct': 18.50},
            {'at_least_usd': 2.81, 'but_less_than_usd': 2.90, 'surcharge_pct': 18.75},
            {'at_least_usd': 2.90, 'but_less_than_usd': 2.99, 'surcharge_pct': 19.00},
            {'at_least_usd': 2.99, 'but_less_than_usd': 3.08, 'surcharge_pct': 19.25},
        ]
        
        result = find_inflection(bands)
        assert result == 2.81, f"Expected inflection at 2.81, got {result}"

    def test_no_inflection_uniform_steps(self):
        bands = [
            {'at_least_usd': 2.00, 'but_less_than_usd': 2.10, 'surcharge_pct': 18.00},
            {'at_least_usd': 2.10, 'but_less_than_usd': 2.20, 'surcharge_pct': 18.25},
            {'at_least_usd': 2.20, 'but_less_than_usd': 2.30, 'surcharge_pct': 18.50},
            {'at_least_usd': 2.30, 'but_less_than_usd': 2.40, 'surcharge_pct': 18.75},
        ]
        
        result = find_inflection(bands)
        assert result is None, f"Expected no inflection, got {result}"

    def test_too_few_bands(self):
        bands = [
            {'at_least_usd': 2.00, 'but_less_than_usd': 2.10, 'surcharge_pct': 18.00},
            {'at_least_usd': 2.10, 'but_less_than_usd': 2.20, 'surcharge_pct': 18.25},
        ]
        
        result = find_inflection(bands)
        assert result is None, f"Expected no inflection with too few bands, got {result}"

    def test_inflection_narrow_to_wide(self):
        bands = [
            {'at_least_usd': 2.00, 'but_less_than_usd': 2.02, 'surcharge_pct': 18.00},
            {'at_least_usd': 2.02, 'but_less_than_usd': 2.04, 'surcharge_pct': 18.25},
            {'at_least_usd': 2.04, 'but_less_than_usd': 2.06, 'surcharge_pct': 18.50},
            {'at_least_usd': 2.06, 'but_less_than_usd': 2.33, 'surcharge_pct': 18.75},
            {'at_least_usd': 2.33, 'but_less_than_usd': 2.60, 'surcharge_pct': 19.00},
        ]
        
        result = find_inflection(bands)
        assert result == 2.06, f"Expected inflection at 2.06, got {result}"

    def test_unsorted_bands(self):
        bands = [
            {'at_least_usd': 2.20, 'but_less_than_usd': 2.22, 'surcharge_pct': 18.50},
            {'at_least_usd': 2.00, 'but_less_than_usd': 2.10, 'surcharge_pct': 18.00},
            {'at_least_usd': 2.22, 'but_less_than_usd': 2.24, 'surcharge_pct': 18.75},
            {'at_least_usd': 2.10, 'but_less_than_usd': 2.20, 'surcharge_pct': 18.25},
        ]
        
        result = find_inflection(bands)
        assert result == 2.20, f"Expected inflection at 2.20 even with unsorted input, got {result}"

    def test_realistic_ups_data(self):
        bands = [
            {'at_least_usd': 1.79, 'but_less_than_usd': 2.06, 'surcharge_pct': 18.00},
            {'at_least_usd': 2.06, 'but_less_than_usd': 2.33, 'surcharge_pct': 18.25},
            {'at_least_usd': 2.33, 'but_less_than_usd': 2.38, 'surcharge_pct': 18.50},
            {'at_least_usd': 2.38, 'but_less_than_usd': 2.47, 'surcharge_pct': 18.75},
            {'at_least_usd': 2.47, 'but_less_than_usd': 2.56, 'surcharge_pct': 19.00},
            {'at_least_usd': 2.56, 'but_less_than_usd': 2.65, 'surcharge_pct': 19.25},
        ]
        
        result = find_inflection(bands)
        assert result == 2.33, f"Expected inflection around 2.33-2.38, got {result}"

    def test_single_narrow_step_not_enough(self):
        bands = [
            {'at_least_usd': 2.00, 'but_less_than_usd': 2.10, 'surcharge_pct': 18.00},
            {'at_least_usd': 2.10, 'but_less_than_usd': 2.20, 'surcharge_pct': 18.25},
            {'at_least_usd': 2.20, 'but_less_than_usd': 2.22, 'surcharge_pct': 18.50},
            {'at_least_usd': 2.22, 'but_less_than_usd': 2.32, 'surcharge_pct': 18.75},
        ]
        
        result = find_inflection(bands)
        assert result is None, f"Expected no inflection with only one narrow step, got {result}"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])



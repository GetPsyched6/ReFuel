"""
Comparison service - normalizes and compares carrier data
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from typing import List, Dict, Optional
from models.database import db
from models.schemas import ComparisonView, ComparisonRow
import json


class ComparisonService:
    """Service for comparing fuel surcharge data across carriers"""
    
    async def get_comparison(
        self,
        session_id: Optional[int] = None,
        view_type: ComparisonView = ComparisonView.NORMALIZED
    ) -> Dict:
        """
        Get comparison data for specified view type
        
        Args:
            session_id: Specific session ID (None = latest)
            view_type: Type of comparison view
            
        Returns:
            Comparison data with rows and metadata
        """
        # Get session data
        if session_id is None:
            session_query = "SELECT id FROM scrape_sessions ORDER BY timestamp DESC LIMIT 1"
            sessions = await db.execute_query(session_query)
            if not sessions:
                return {"view_type": view_type, "rows": [], "metadata": {"error": "No data"}}
            session_id = sessions[0]['id']
        
        # Get fuel surcharge data
        data_query = """
            SELECT carrier, service, at_least_usd, but_less_than_usd, surcharge_pct
            FROM fuel_surcharges
            WHERE session_id = ?
            ORDER BY at_least_usd, carrier
        """
        data = await db.execute_query(data_query, (session_id,))
        
        # Route to appropriate view handler
        if view_type == ComparisonView.NORMALIZED:
            rows = self._create_normalized_view(data)
        elif view_type == ComparisonView.OVERLAP:
            rows = self._create_overlap_view(data)
        elif view_type == ComparisonView.COMPARABLE:
            rows = self._create_comparable_ranges_view(data)
        else:  # COMPLETE
            rows = self._create_complete_view(data)
        
        return {
            "view_type": view_type.value,
            "rows": rows,
            "metadata": {
                "session_id": session_id,
                "total_rows": len(rows),
                "carriers": list(set(d['carrier'] for d in data))
            }
        }
    
    def _create_normalized_view(self, data: List[Dict]) -> List[Dict]:
        """
        Create normalized grid view with $0.25 intervals
        Interpolates missing values
        """
        # Group by carrier
        by_carrier = {}
        for item in data:
            carrier = item['carrier']
            if carrier not in by_carrier:
                by_carrier[carrier] = []
            by_carrier[carrier].append(item)
        
        # Find min/max range
        all_mins = [d['at_least_usd'] for d in data]
        all_maxs = [d['but_less_than_usd'] for d in data]
        global_min = min(all_mins) if all_mins else 0
        global_max = max(all_maxs) if all_maxs else 10
        
        # Round to $0.25 intervals
        interval = 0.25
        current = round(global_min / interval) * interval
        
        rows = []
        while current < global_max:
            next_val = current + interval
            
            row = {
                "price_range": f"${current:.2f}-${next_val:.2f}",
                "at_least_usd": current,
                "but_less_than_usd": next_val,
                "ups_pct": None,
                "fedex_pct": None,
                "dhl_pct": None
            }
            
            # Find matching values for each carrier (NO interpolation)
            for carrier, carrier_data in by_carrier.items():
                pct = self._find_exact_or_containing(current, next_val, carrier_data)
                carrier_key = carrier.lower().replace(' ', '_') + '_pct'
                if carrier_key in row:
                    row[carrier_key] = pct
            
            rows.append(row)
            current = next_val
        
        return rows
    
    def _create_overlap_view(self, data: List[Dict]) -> List[Dict]:
        """
        Show only ranges where all 3 carriers have data
        """
        # Group by carrier
        by_carrier = {}
        for item in data:
            carrier = item['carrier']
            if carrier not in by_carrier:
                by_carrier[carrier] = []
            by_carrier[carrier].append(item)
        
        # Find overlapping ranges
        rows = []
        
        # Get all unique price ranges
        all_ranges = set()
        for carrier_data in by_carrier.values():
            for item in carrier_data:
                all_ranges.add((item['at_least_usd'], item['but_less_than_usd']))
        
        # Check which ranges have data from all carriers
        for min_val, max_val in sorted(all_ranges):
            carrier_values = {}
            
            for carrier, carrier_data in by_carrier.items():
                # Find exact match or overlapping range
                for item in carrier_data:
                    if (item['at_least_usd'] <= min_val < item['but_less_than_usd'] or
                        item['at_least_usd'] < max_val <= item['but_less_than_usd']):
                        carrier_values[carrier] = item['surcharge_pct']
                        break
            
            # Only include if all carriers have data
            if len(carrier_values) == len(by_carrier):
                row = {
                    "price_range": f"${min_val:.2f}-${max_val:.2f}",
                    "at_least_usd": min_val,
                    "but_less_than_usd": max_val,
                    "ups_pct": carrier_values.get('UPS'),
                    "fedex_pct": carrier_values.get('FedEx'),
                    "dhl_pct": carrier_values.get('DHL')
                }
                rows.append(row)
        
        return rows
    
    def _create_complete_view(self, data: List[Dict]) -> List[Dict]:
        """
        Show all ranges from all carriers, fill gaps with None
        """
        # Get all unique price ranges
        all_ranges = set()
        for item in data:
            all_ranges.add((item['at_least_usd'], item['but_less_than_usd']))
        
        rows = []
        for min_val, max_val in sorted(all_ranges):
            row = {
                "price_range": f"${min_val:.2f}-${max_val:.2f}",
                "at_least_usd": min_val,
                "but_less_than_usd": max_val,
                "ups_pct": None,
                "fedex_pct": None,
                "dhl_pct": None
            }
            
            # Find values for each carrier
            for item in data:
                if item['at_least_usd'] == min_val and item['but_less_than_usd'] == max_val:
                    carrier_key = item['carrier'].lower().replace(' ', '_') + '_pct'
                    if carrier_key in row:
                        row[carrier_key] = item['surcharge_pct']
            
            rows.append(row)
        
        return rows
    
    def _create_comparable_ranges_view(self, data: List[Dict]) -> List[Dict]:
        """
        Create comparable ranges view by finding overlapping ranges
        where at least 2 carriers have data
        """
        # Group data by carrier
        ups_data = [d for d in data if d['carrier'] == 'UPS']
        fedex_data = [d for d in data if d['carrier'] == 'FedEx']
        dhl_data = [d for d in data if d['carrier'] == 'DHL']
        
        # Find all unique boundaries (start and end points)
        boundaries = set()
        for item in data:
            boundaries.add(item['at_least_usd'])
            boundaries.add(item['but_less_than_usd'])
        boundaries = sorted(boundaries)
        
        # For each potential range, check how many carriers have data
        comparable_rows = []
        for i in range(len(boundaries) - 1):
            min_val = boundaries[i]
            max_val = boundaries[i + 1]
            
            # Find carriers with data in this range
            carriers_with_data = []
            ups_pct = self._find_range_overlap(min_val, max_val, ups_data)
            fedex_pct = self._find_range_overlap(min_val, max_val, fedex_data)
            dhl_pct = self._find_range_overlap(min_val, max_val, dhl_data)
            
            if ups_pct is not None:
                carriers_with_data.append('UPS')
            if fedex_pct is not None:
                carriers_with_data.append('FedEx')
            if dhl_pct is not None:
                carriers_with_data.append('DHL')
            
            # Only include if at least 2 carriers have data
            if len(carriers_with_data) >= 2:
                comparable_rows.append({
                    "price_range": f"${min_val:.2f}-${max_val:.2f}",
                    "at_least_usd": min_val,
                    "but_less_than_usd": max_val,
                    "ups_pct": ups_pct,
                    "fedex_pct": fedex_pct,
                    "dhl_pct": dhl_pct
                })
        
        return comparable_rows
    
    def _find_range_overlap(self, min_val: float, max_val: float, 
                            carrier_data: List[Dict]) -> Optional[float]:
        """
        Check if carrier has data that overlaps with [min_val, max_val)
        Return surcharge % if overlap exists, None otherwise
        """
        for item in carrier_data:
            # Check if ranges overlap
            if item['at_least_usd'] < max_val and item['but_less_than_usd'] > min_val:
                return item['surcharge_pct']
        return None
    
    def _find_exact_or_containing(self, min_val: float, max_val: float, carrier_data: List[Dict]) -> Optional[float]:
        """
        Find exact match or overlapping range - NO interpolation
        Only returns actual scraped data where there's overlap
        """
        # Look for exact match first
        for item in carrier_data:
            if item['at_least_usd'] == min_val and item['but_less_than_usd'] == max_val:
                return item['surcharge_pct']
        
        # Look for overlapping ranges (where intervals overlap with actual data)
        # Return the surcharge if the normalized interval falls within or overlaps with actual range
        for item in carrier_data:
            # Check if there's any overlap between [min_val, max_val) and [item.at_least, item.but_less)
            if item['at_least_usd'] < max_val and item['but_less_than_usd'] > min_val:
                return item['surcharge_pct']
        
        # No actual data available for this range
        return None
    
    async def get_carrier_focus(self, carrier: str, session_id: Optional[int] = None) -> Dict:
        """
        Get focused comparison for a specific carrier
        Shows ranges where carrier is most competitive
        """
        comparison = await self.get_comparison(session_id, ComparisonView.COMPLETE)
        
        rows = comparison['rows']
        carrier_key = carrier.lower() + '_pct'
        
        # Find rows where this carrier is cheapest
        competitive_rows = []
        for row in rows:
            if row.get(carrier_key) is not None:
                other_vals = [
                    v for k, v in row.items() 
                    if k.endswith('_pct') and k != carrier_key and v is not None
                ]
                if other_vals and row[carrier_key] <= min(other_vals):
                    competitive_rows.append(row)
        
        return {
            "carrier": carrier,
            "competitive_ranges": competitive_rows,
            "total_competitive": len(competitive_rows)
        }


# Global service instance
comparison_service = ComparisonService()


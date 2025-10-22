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
    
    def calculate_ups_surcharge(self, price: float) -> float:
        """
        Calculate UPS fuel surcharge percentage using their published formula.
        
        Formula from UPS:
        - Above $3.55: range extends in $0.09 increments, surcharge adjusts in 0.25% increments
        - Below $3.55: range extends in $0.27 increments, surcharge adjusts in 0.25% increments
        - At $3.55: surcharge is 20.0%
        
        Args:
            price: Fuel price (at_least_usd value of the range)
            
        Returns:
            Calculated surcharge percentage
        """
        THRESHOLD = 3.55
        BASE_SURCHARGE = 20.0  # Surcharge at $3.55
        SURCHARGE_INCREMENT = 0.25  # 0.25% per step
        
        if price >= THRESHOLD:
            # Above threshold: $0.09 increments
            PRICE_INCREMENT = 0.09
            steps = round((price - THRESHOLD) / PRICE_INCREMENT)
            return BASE_SURCHARGE + (steps * SURCHARGE_INCREMENT)
        else:
            # Below threshold: $0.27 increments
            PRICE_INCREMENT = 0.27
            steps = round((THRESHOLD - price) / PRICE_INCREMENT)
            return BASE_SURCHARGE - (steps * SURCHARGE_INCREMENT)
    
    def get_ups_surcharge_for_range(self, at_least_usd: float, but_less_than_usd: float, 
                                     ups_data: List[Dict]) -> Optional[float]:
        """
        Get UPS surcharge for a specific range. Uses scraped data if available,
        otherwise calculates using UPS formula.
        
        Args:
            at_least_usd: Lower bound of price range
            but_less_than_usd: Upper bound of price range
            ups_data: List of scraped UPS data
            
        Returns:
            Surcharge percentage (scraped or calculated)
        """
        # First, try to find scraped data
        for item in ups_data:
            # Check for exact match
            if item['at_least_usd'] == at_least_usd and item['but_less_than_usd'] == but_less_than_usd:
                return item['surcharge_pct']
            # Check for overlap
            if item['at_least_usd'] < but_less_than_usd and item['but_less_than_usd'] > at_least_usd:
                return item['surcharge_pct']
        
        # No scraped data available, calculate using formula
        return self.calculate_ups_surcharge(at_least_usd)
    
    async def get_comparison(
        self,
        session_id: Optional[int] = None,
        view_type: ComparisonView = ComparisonView.NORMALIZED,
        include_previous: bool = False
    ) -> Dict:
        """
        Get comparison data for specified view type
        
        Args:
            session_id: Specific session ID (None = latest)
            view_type: Type of comparison view
            include_previous: Include previous session data for change detection
            
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
        
        # Get session timestamp
        session_query = "SELECT timestamp FROM scrape_sessions WHERE id = ?"
        session_info = await db.execute_query(session_query, (session_id,))
        current_timestamp = session_info[0]['timestamp'] if session_info else None
        
        # Get fuel surcharge data
        data_query = """
            SELECT carrier, service, at_least_usd, but_less_than_usd, surcharge_pct
            FROM fuel_surcharges
            WHERE session_id = ?
            ORDER BY at_least_usd, carrier
        """
        data = await db.execute_query(data_query, (session_id,))
        
        # Get previous session data if requested
        previous_data = None
        previous_timestamp = None
        if include_previous:
            # Get previous session
            prev_session_query = """
                SELECT id, timestamp FROM scrape_sessions 
                WHERE timestamp < (SELECT timestamp FROM scrape_sessions WHERE id = ?)
                ORDER BY timestamp DESC LIMIT 1
            """
            prev_sessions = await db.execute_query(prev_session_query, (session_id,))
            if prev_sessions:
                prev_session_id = prev_sessions[0]['id']
                previous_timestamp = prev_sessions[0]['timestamp']
                previous_data = await db.execute_query(data_query, (prev_session_id,))
        
        # Route to appropriate view handler
        if view_type == ComparisonView.NORMALIZED:
            rows = self._create_normalized_view(data)
        elif view_type == ComparisonView.OVERLAP:
            rows = self._create_overlap_view(data)
        elif view_type == ComparisonView.COMPARABLE:
            rows = self._create_comparable_ranges_view(data)
        else:  # COMPLETE
            rows = self._create_complete_view(data)
        
        # Add change detection if previous data available
        if include_previous and previous_data:
            rows = self._add_change_detection(rows, data, previous_data, current_timestamp, previous_timestamp)
        
        return {
            "view_type": view_type.value,
            "rows": rows,
            "metadata": {
                "session_id": session_id,
                "total_rows": len(rows),
                "carriers": list(set(d['carrier'] for d in data)),
                "current_timestamp": current_timestamp,
                "previous_timestamp": previous_timestamp
            }
        }
    
    def _create_normalized_view(self, data: List[Dict]) -> List[Dict]:
        """
        Create normalized grid view with $0.25 intervals
        Uses UPS formula to fill gaps for UPS data
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
            
            # Find matching values for each carrier
            for carrier, carrier_data in by_carrier.items():
                carrier_key = carrier.lower().replace(' ', '_') + '_pct'
                
                if carrier == 'UPS':
                    # Use UPS formula calculation for all ranges
                    pct = self.get_ups_surcharge_for_range(current, next_val, carrier_data)
                else:
                    # For other carriers, only use scraped data (no interpolation)
                    pct = self._find_exact_or_containing(current, next_val, carrier_data)
                
                if carrier_key in row:
                    row[carrier_key] = pct
            
            rows.append(row)
            current = next_val
        
        return rows
    
    def _create_overlap_view(self, data: List[Dict]) -> List[Dict]:
        """
        Show only ranges where all 3 carriers have data (uses UPS formula for UPS)
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
                if carrier == 'UPS':
                    # Use UPS formula for all ranges
                    ups_pct = self.get_ups_surcharge_for_range(min_val, max_val, carrier_data)
                    if ups_pct is not None:
                        carrier_values[carrier] = ups_pct
                else:
                    # Find exact match or overlapping range for other carriers
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
        Show all ranges from all carriers, fill gaps with UPS formula for UPS
        """
        # Group by carrier
        by_carrier = {}
        for item in data:
            carrier = item['carrier']
            if carrier not in by_carrier:
                by_carrier[carrier] = []
            by_carrier[carrier].append(item)
        
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
            
            # For UPS, use formula if no scraped data exists
            if row['ups_pct'] is None and 'UPS' in by_carrier:
                row['ups_pct'] = self.get_ups_surcharge_for_range(min_val, max_val, by_carrier['UPS'])
            
            rows.append(row)
        
        return rows
    
    def _create_comparable_ranges_view(self, data: List[Dict]) -> List[Dict]:
        """
        Create comparable ranges view by finding overlapping ranges
        where at least 2 carriers have data (uses UPS formula for UPS)
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
            
            # For UPS, use formula to always have data
            ups_pct = self.get_ups_surcharge_for_range(min_val, max_val, ups_data)
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
    
    def _add_change_detection(self, rows: List[Dict], current_data: List[Dict], 
                              previous_data: List[Dict], current_timestamp: str, 
                              previous_timestamp: str) -> List[Dict]:
        """
        Add change detection metadata to rows
        Marks cells that have different values from previous session
        """
        # Create lookup dict for previous data
        prev_lookup = {}
        for item in previous_data:
            key = (item['carrier'], item['at_least_usd'], item['but_less_than_usd'])
            prev_lookup[key] = item['surcharge_pct']
        
        # Add change metadata to each row
        for row in rows:
            changes = {}
            for carrier in ['UPS', 'FedEx', 'DHL']:
                carrier_key = carrier.lower().replace(' ', '_') + '_pct'
                current_value = row.get(carrier_key)
                
                if current_value is not None:
                    # Look for matching previous data
                    prev_key = (carrier, row['at_least_usd'], row['but_less_than_usd'])
                    prev_value = prev_lookup.get(prev_key)
                    
                    if prev_value is not None and abs(current_value - prev_value) > 0.001:
                        # Value changed!
                        changes[carrier_key + '_changed'] = True
                        changes[carrier_key + '_prev'] = prev_value
                    else:
                        changes[carrier_key + '_changed'] = False
                else:
                    changes[carrier_key + '_changed'] = False
            
            row.update(changes)
            row['current_timestamp'] = current_timestamp
            row['previous_timestamp'] = previous_timestamp
        
        return rows
    
    async def get_carrier_last_updates(self, session_id: Optional[int] = None) -> Dict:
        """
        Get the last update date for each carrier
        Finds when each carrier's data last changed from the previous session
        
        Args:
            session_id: Current session (None = latest)
            
        Returns:
            Dict with last update info for each carrier
        """
        # Get current session
        if session_id is None:
            session_query = "SELECT id FROM scrape_sessions ORDER BY timestamp DESC LIMIT 1"
            sessions = await db.execute_query(session_query)
            if not sessions:
                return {"error": "No data"}
            session_id = sessions[0]['id']
        
        # Get current session timestamp first
        current_session_query = "SELECT timestamp FROM scrape_sessions WHERE id = ?"
        current_session_data = await db.execute_query(current_session_query, (session_id,))
        if not current_session_data:
            return {"error": "Session not found"}
        current_timestamp = current_session_data[0]['timestamp']
        
        # Get all sessions up to and including current, ordered by timestamp DESC
        sessions_query = """
            SELECT id, timestamp 
            FROM scrape_sessions 
            WHERE timestamp <= ?
            ORDER BY timestamp DESC
        """
        all_sessions = await db.execute_query(sessions_query, (current_timestamp,))
        
        if len(all_sessions) < 2:
            # Not enough history
            return {
                "UPS": {"last_updated": all_sessions[0]['timestamp'], "sessions_ago": 0},
                "FedEx": {"last_updated": all_sessions[0]['timestamp'], "sessions_ago": 0},
                "DHL": {"last_updated": all_sessions[0]['timestamp'], "sessions_ago": 0}
            }
        
        carriers = ['UPS', 'FedEx', 'DHL']
        result = {}
        
        # For each carrier, find when their data last changed
        for carrier in carriers:
            last_updated = None
            sessions_ago = 0
            
            # Compare each session with the previous one, going backwards in time
            for i in range(len(all_sessions) - 1):
                current_sess_id = all_sessions[i]['id']
                prev_sess_id = all_sessions[i + 1]['id']
                
                # Get data for this carrier in both sessions
                query = """
                    SELECT at_least_usd, but_less_than_usd, surcharge_pct 
                    FROM fuel_surcharges 
                    WHERE session_id = ? AND carrier = ?
                    ORDER BY at_least_usd
                """
                current = await db.execute_query(query, (current_sess_id, carrier))
                previous = await db.execute_query(query, (prev_sess_id, carrier))
                
                # Check if data is different
                if self._data_differs(current, previous):
                    # Data changed in current session - this is when it was last updated
                    last_updated = all_sessions[i]['timestamp']
                    sessions_ago = i
                    break
            
            # If we never found a change, data hasn't changed since the oldest session we have
            if last_updated is None:
                # Data unchanged throughout all sessions we checked
                # Last update was in or before the oldest session
                last_updated = all_sessions[-1]['timestamp']
                sessions_ago = len(all_sessions) - 1
            
            result[carrier] = {
                "last_updated": last_updated,
                "sessions_ago": sessions_ago
            }
        
        return result
    
    def _data_differs(self, current: List[Dict], previous: List[Dict]) -> bool:
        """Check if two datasets differ"""
        if len(current) != len(previous):
            return True
        
        for i in range(len(current)):
            if (current[i]['at_least_usd'] != previous[i]['at_least_usd'] or
                current[i]['but_less_than_usd'] != previous[i]['but_less_than_usd'] or
                abs(current[i]['surcharge_pct'] - previous[i]['surcharge_pct']) > 0.001):
                return True
        
        return False


# Global service instance
comparison_service = ComparisonService()


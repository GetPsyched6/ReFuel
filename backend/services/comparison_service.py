"""
Comparison service - normalizes and compares carrier data
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from typing import List, Dict, Optional, Set, Tuple
from models.database import db
from models.schemas import ComparisonView, ComparisonRow
from config import UPS_FORMULAS
import json
import math


class ComparisonService:
    """Service for comparing fuel surcharge data across carriers"""
    
    def calculate_ups_surcharge(
        self, 
        price: float, 
        market: str = "US", 
        fuel_category: str = "ground_domestic"
    ) -> float:
        """
        Calculate UPS fuel surcharge percentage using their published formulas.
        
        Args:
            price: Fuel price (at_least_usd value of the range)
            market: Market code (e.g., "US", "DE")
            fuel_category: Fuel category (e.g., "ground_domestic", "domestic_air")
            
        Returns:
            Calculated surcharge percentage
        """
        formula_key = (market, "UPS", fuel_category)
        
        # Check if a formula exists for this combination
        if formula_key not in UPS_FORMULAS:
            # Default to US Ground Domestic formula
            formula_key = ("US", "UPS", "ground_domestic")
        
        formula = UPS_FORMULAS[formula_key]
        
        # Handle domestic air special case (pivot at $2.06)
        if fuel_category == "domestic_air" and "pivot_threshold" in formula:
            THRESHOLD = formula["pivot_threshold"]
            BASE_SURCHARGE = 19.0  # 19.0% at $2.06 (from published table)
            SURCHARGE_INCREMENT = formula["above_pct_increment"]
            
            if price >= THRESHOLD:
                PRICE_INCREMENT = formula["above_increment"]
                steps = round((price - THRESHOLD) / PRICE_INCREMENT)
                return BASE_SURCHARGE + (steps * SURCHARGE_INCREMENT)
            else:
                PRICE_INCREMENT = formula["below_increment"]
                steps = round((THRESHOLD - price) / PRICE_INCREMENT)
                return BASE_SURCHARGE - (steps * SURCHARGE_INCREMENT)
        
        # Handle international air (export/import) - simple increment-based
        elif fuel_category in ["international_air_export", "international_air_import"]:
            # Base reference from last published value
            # Export: 27.00% at $2.47, Import: 30.75% at $2.47
            BASE_PRICE = 2.47
            BASE_SURCHARGE = 27.0 if fuel_category == "international_air_export" else 30.75
            PRICE_INCREMENT = formula["increment"]
            SURCHARGE_INCREMENT = formula["pct_increment"]
            
            steps = round((price - BASE_PRICE) / PRICE_INCREMENT)
            return BASE_SURCHARGE + (steps * SURCHARGE_INCREMENT)
        
        # Default: Ground Domestic formula
        else:
            THRESHOLD = formula.get("above_threshold", 3.55)
            BASE_SURCHARGE = 20.0  # Surcharge at $3.55
            SURCHARGE_INCREMENT = formula.get("above_pct_increment", 0.25)
            
            if price >= THRESHOLD:
                PRICE_INCREMENT = formula.get("above_increment", 0.09)
                steps = round((price - THRESHOLD) / PRICE_INCREMENT)
                return BASE_SURCHARGE + (steps * SURCHARGE_INCREMENT)
            else:
                PRICE_INCREMENT = formula.get("below_increment", 0.27)
                steps = round((THRESHOLD - price) / PRICE_INCREMENT)
                return BASE_SURCHARGE - (steps * SURCHARGE_INCREMENT)
    
    def get_ups_surcharge_for_range(
        self,
        at_least_usd: float,
        but_less_than_usd: float,
        ups_data: List[Dict],
        allow_formula: bool = True,
        market: str = "US",
        fuel_category: str = "ground_domestic",
    ) -> Optional[float]:
        """
        Get UPS surcharge for a specific range. Uses scraped data if available,
        otherwise calculates using UPS formula.
        
        Args:
            at_least_usd: Lower bound of price range
            but_less_than_usd: Upper bound of price range
            ups_data: List of scraped UPS data
            allow_formula: Whether to use formula if no scraped data
            market: Market code (e.g., "US", "DE")
            fuel_category: Fuel category (e.g., "ground_domestic", "domestic_air")
            
        Returns:
            Surcharge percentage (scraped or calculated)
        """
        # First, try to find scraped data
        exact = self._find_exact_or_containing(at_least_usd, but_less_than_usd, ups_data)
        if exact is not None:
            return exact
        
        # No scraped data available, optionally calculate using formula
        if allow_formula:
            return self.calculate_ups_surcharge(at_least_usd, market, fuel_category)
        return None
    
    async def get_comparison(
        self,
        session_id: Optional[int] = None,
        view_type: ComparisonView = ComparisonView.NORMALIZED,
        include_previous: bool = False,
        fuel_type: Optional[str] = None,
        service_name: Optional[str] = None,
        fuel_category: Optional[str] = None,
        market: Optional[str] = None,
        carriers: Optional[List[str]] = None
    ) -> Dict:
        """
        Get comparison data for specified view type
        
        Args:
            session_id: Specific session ID (None = latest)
            view_type: Type of comparison view
            include_previous: Include previous session data for change detection
            carriers: List of carriers to include in the comparison
            
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
        
        requested_carriers = carriers or []
        allow_ups_formula = True
        if market:
            allow_ups_formula = market.upper() == 'US'
        active_carriers = requested_carriers.copy()

        common_categories: Optional[List[str]] = None
        force_empty_result = False
        if (fuel_category == "all" or fuel_category is None) and requested_carriers:
            intersection, carriers_with_data = await self._get_common_categories(session_id, requested_carriers, market)
            if carriers_with_data:
                active_carriers = carriers_with_data
                # Only enforce common categories when there is at least one shared category
                if len(active_carriers) > 1 and intersection:
                    common_categories = intersection
            else:
                force_empty_result = True
        
        # Get fuel surcharge data
        effective_category = fuel_category if fuel_category not in (None, "all") else None
        category_filter = common_categories if common_categories else None
        
        carrier_filter = None
        if requested_carriers:
            if active_carriers:
                carrier_filter = active_carriers
            else:
                force_empty_result = True

        if force_empty_result:
            data = []
        else:
            data = await self._fetch_rows(
                session_id, 
                fuel_type, 
                service_name, 
                effective_category, 
                market, 
                carriers=carrier_filter,
                categories=category_filter
            )
        
        if fuel_category is None or fuel_category == "all":
            data = self._aggregate_all_services(data)
        
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
                
                # Use same logic for previous data
                previous_categories = None
                if category_filter:
                    # Ideally we re-calculate intersection for previous session, 
                    # but using current intersection is a reasonable approximation for trend/change comparison
                    # or we could just fetch whatever matches.
                    previous_categories = category_filter

                if force_empty_result:
                    previous_data = []
                else:
                    previous_data = await self._fetch_rows(
                        prev_session_id, 
                        fuel_type, 
                        service_name, 
                        effective_category, 
                        market,
                        carriers=carrier_filter,
                        categories=previous_categories
                    )
                    if fuel_category is None or fuel_category == "all":
                        previous_data = self._aggregate_all_services(previous_data)
        
        # Route to appropriate view handler
        if view_type == ComparisonView.NORMALIZED:
            rows = self._create_normalized_view(
                data, 
                interval=0.10, 
                allow_ups_formula=allow_ups_formula,
                market=market,
                fuel_category=fuel_category
            )
        elif view_type == ComparisonView.NORMALIZED_FINE:
            rows = self._create_normalized_view(
                data, 
                interval=0.02, 
                allow_ups_formula=allow_ups_formula,
                market=market,
                fuel_category=fuel_category
            )
        elif view_type == ComparisonView.OVERLAP:
            rows = self._create_overlap_view(
                data, 
                allow_ups_formula=allow_ups_formula,
                market=market,
                fuel_category=fuel_category
            )
        elif view_type == ComparisonView.COMPARABLE:
            rows = self._create_comparable_ranges_view(
                data, 
                allow_ups_formula=allow_ups_formula,
                market=market,
                fuel_category=fuel_category
            )
        elif view_type == ComparisonView.RAW:
            rows = self._create_raw_data_view(data)
        else:  # COMPLETE
            rows = self._create_complete_view(
                data, 
                allow_ups_formula=allow_ups_formula,
                market=market,
                fuel_category=fuel_category
            )
        
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
                "selected_carriers": carrier_filter or requested_carriers,
                "current_timestamp": current_timestamp,
                "previous_timestamp": previous_timestamp,
                "fuel_type": fuel_type,
                "fuel_category": fuel_category,
                "service": service_name,
                "market": market,
                "common_categories": common_categories or []
            }
        }
    
    async def get_comparison_multi_curves(
        self,
        curve_version_ids: List[int],
        view_type: ComparisonView = ComparisonView.NORMALIZED,
        fuel_type: Optional[str] = None,
        service_name: Optional[str] = None,
        fuel_category: Optional[str] = None,
        market: Optional[str] = None,
        carriers: Optional[List[str]] = None
    ) -> Dict:
        """
        Get comparison data for multiple fuel curve versions
        
        Args:
            curve_version_ids: List of fuel curve version IDs to compare
            view_type: Type of comparison view
            fuel_type: Filter by fuel type
            service_name: Filter by service name
            fuel_category: Filter by fuel category
            market: Filter by market
            carriers: Filter by carriers
            
        Returns:
            {
                "curves": [
                    {
                        "curve_id": 10,
                        "carrier": "UPS",
                        "label": "Fuel curve (effective Nov 20, 2025)",
                        "effective_date": "2025-11-20T08:38:51",
                        "rows": [...],
                        "metadata": {...}
                    },
                    ...
                ],
                "view_type": "normalized"
            }
        """
        if not curve_version_ids:
            return {"curves": [], "view_type": view_type}
        
        # Fetch curve version metadata
        placeholders = ",".join(["?"] * len(curve_version_ids))
        version_query = f"""
            SELECT 
                id, carrier, service, market, fuel_category, fuel_type,
                effective_date, label, session_id, is_active
            FROM fuel_curve_versions
            WHERE id IN ({placeholders})
        """
        curve_versions = await db.execute_query(version_query, tuple(curve_version_ids))
        
        if not curve_versions:
            return {"curves": [], "view_type": view_type}
        
        # Fetch data for each curve version
        curves = []
        for version in curve_versions:
            session_id = version['session_id']
            curve_carrier = version['carrier']
            
            # Filter to specific carrier for this curve
            curve_carriers = [curve_carrier] if curve_carrier else carriers
            
            # Use existing get_comparison logic for each curve
            comparison_result = await self.get_comparison(
                session_id=session_id,
                view_type=view_type,
                include_previous=False,  # No change detection for multi-curve mode
                fuel_type=fuel_type,
                service_name=service_name,
                fuel_category=fuel_category or version['fuel_category'],
                market=market or version['market'],
                carriers=curve_carriers
            )
            
            # Transform rows to multi-curve format (surcharge_pct instead of carrier-specific columns)
            rows = comparison_result.get("rows", [])
            transformed_rows = []
            carrier_key = f"{curve_carrier.lower()}_pct"
            
            for row in rows:
                surcharge = row.get(carrier_key)
                if surcharge is not None:  # Only include rows where this carrier has data
                    transformed_rows.append({
                        "price_range": row.get("price_range"),
                        "at_least_usd": row.get("at_least_usd"),
                        "but_less_than_usd": row.get("but_less_than_usd"),
                        "surcharge_pct": surcharge
                    })
            
            curves.append({
                "curve_id": version['id'],
                "carrier": version['carrier'],
                "service": version['service'],
                "label": version['label'],
                "effective_date": version['effective_date'],
                "fuel_category": version['fuel_category'],
                "fuel_type": version['fuel_type'],
                "market": version['market'],
                "rows": transformed_rows,
                "metadata": comparison_result.get("metadata", {})
            })
        
        return {
            "curves": curves,
            "view_type": view_type
        }
    
    async def _get_common_categories(self, session_id: int, carriers: List[str], market: Optional[str]) -> Tuple[List[str], List[str]]:
        """Find fuel categories present for ALL selected carriers in the session."""
        if not carriers:
            return [], []
            
        query = f"""
            SELECT DISTINCT carrier, fuel_category 
            FROM fuel_surcharges 
            WHERE session_id = ? AND carrier IN ({','.join(['?']*len(carriers))})
        """
        params = [session_id] + carriers
        
        if market:
            query += " AND market = ?"
            params.append(market)
            
        rows = await db.execute_query(query, tuple(params))
        
        carrier_cats: Dict[str, Set[str]] = {c: set() for c in carriers}
        for row in rows:
            if row['carrier'] in carrier_cats:
                carrier_cats[row['carrier']].add(row['fuel_category'])
        
        carriers_with_data = [carrier for carrier, cats in carrier_cats.items() if cats]
        if not carriers_with_data:
            return [], []

        sets = [carrier_cats[carrier] for carrier in carriers_with_data]
        common = set.intersection(*sets) if sets else set()
        return list(common), carriers_with_data

    def _aggregate_all_services(self, data: List[Dict]) -> List[Dict]:
        """Average surcharge values across all services when no category filter is applied."""
        if not data:
            return data

        grouped: Dict[tuple, Dict] = {}
        for item in data:
            key = (item["carrier"], item["at_least_usd"], item["but_less_than_usd"])
            entry = grouped.setdefault(
                key,
                {
                    "carrier": item["carrier"],
                    "service": "All Services",
                    "fuel_type": "All",
                    "fuel_category": "all",
                    "market": item.get("market"),
                    "at_least_usd": item["at_least_usd"],
                    "but_less_than_usd": item["but_less_than_usd"],
                    "values": [],
                },
            )
            entry["values"].append(item["surcharge_pct"])

        aggregated = []
        for entry in grouped.values():
            avg_pct = sum(entry["values"]) / len(entry["values"])
            aggregated.append(
                {
                    "carrier": entry["carrier"],
                    "service": entry["service"],
                    "fuel_type": entry["fuel_type"],
                    "fuel_category": entry["fuel_category"],
                    "market": entry["market"],
                    "at_least_usd": entry["at_least_usd"],
                    "but_less_than_usd": entry["but_less_than_usd"],
                    "surcharge_pct": round(avg_pct, 4),
                }
            )

        return sorted(aggregated, key=lambda row: (row["at_least_usd"], row["carrier"]))
    
    def _create_normalized_view(
        self, 
        data: List[Dict], 
        interval: float = 0.10, 
        allow_ups_formula: bool = True,
        market: str = "US",
        fuel_category: str = "ground_domestic"
    ) -> List[Dict]:
        """
        Create normalized grid view with configurable intervals
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
        
        # Default safety
        if interval <= 0:
            interval = 0.10
        steps_per_dollar = int(round(1 / interval))
        if steps_per_dollar <= 0:
            steps_per_dollar = 10
        min_step = math.floor(global_min * steps_per_dollar)
        max_step = math.ceil(global_max * steps_per_dollar)
        
        rows = []
        for step in range(min_step, max_step):
            current = step / steps_per_dollar
            next_val = (step + 1) / steps_per_dollar
            
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
                    pct = self.get_ups_surcharge_for_range(
                        current,
                        next_val,
                        carrier_data,
                        allow_formula=allow_ups_formula,
                        market=market,
                        fuel_category=fuel_category
                    )
                else:
                    pct = self._find_exact_or_containing(current, next_val, carrier_data)
                
                if carrier_key in row:
                    row[carrier_key] = pct
            
            rows.append(row)
        
        return rows
    
    def _create_overlap_view(
        self, 
        data: List[Dict], 
        allow_ups_formula: bool = True,
        market: str = "US",
        fuel_category: str = "ground_domestic"
    ) -> List[Dict]:
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
                    ups_pct = self.get_ups_surcharge_for_range(
                        min_val,
                        max_val,
                        carrier_data,
                        allow_formula=allow_ups_formula,
                        market=market,
                        fuel_category=fuel_category
                    )
                    if ups_pct is not None:
                        carrier_values[carrier] = ups_pct
                else:
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
    
    def _create_raw_data_view(self, data: List[Dict]) -> List[Dict]:
        """
        Return actual raw database rows without any processing or formulas
        """
        rows_dict = {}
        for item in data:
            key = (item['at_least_usd'], item['but_less_than_usd'])
            if key not in rows_dict:
                rows_dict[key] = {
                    "price_range": f"${item['at_least_usd']:.2f}-${item['but_less_than_usd']:.2f}",
                    "at_least_usd": item['at_least_usd'],
                    "but_less_than_usd": item['but_less_than_usd'],
                    "ups_pct": None,
                    "fedex_pct": None,
                    "dhl_pct": None
                }
            
            carrier_key = item['carrier'].lower().replace(' ', '_') + '_pct'
            if carrier_key in rows_dict[key]:
                rows_dict[key][carrier_key] = item['surcharge_pct']
        
        return sorted(rows_dict.values(), key=lambda x: x['at_least_usd'])
    
    def _create_complete_view(
        self, 
        data: List[Dict], 
        allow_ups_formula: bool = True,
        market: str = "US",
        fuel_category: str = "ground_domestic"
    ) -> List[Dict]:
        """
        Show all ranges from all carriers with 0.01 granularity for smooth visualization
        """
        if not data:
            return []
        
        # Get min/max prices across all data
        min_price = min(item['at_least_usd'] for item in data)
        max_price = max(item['but_less_than_usd'] for item in data)
        
        # Group by carrier
        by_carrier = {}
        for item in data:
            carrier = item['carrier']
            if carrier not in by_carrier:
                by_carrier[carrier] = []
            by_carrier[carrier].append(item)
        
        # Create rows with 0.01 intervals
        rows = []
        current = round(min_price, 2)
        interval = 0.01
        
        while current < max_price:
            next_val = round(current + interval, 2)
            
            row = {
                "price_range": f"${current:.2f}-${next_val:.2f}",
                "at_least_usd": current,
                "but_less_than_usd": next_val,
                "ups_pct": None,
                "fedex_pct": None,
                "dhl_pct": None
            }
            
            # Find overlapping data for each carrier
            for carrier, carrier_data in by_carrier.items():
                carrier_key = carrier.lower().replace(' ', '_') + '_pct'
                if carrier_key in row:
                    # Find if any band contains this interval
                    for item in carrier_data:
                        if item['at_least_usd'] <= current and item['but_less_than_usd'] >= next_val:
                            row[carrier_key] = item['surcharge_pct']
                            break
            
            # For UPS, use formula if no scraped data
            if row['ups_pct'] is None and 'UPS' in by_carrier:
                row['ups_pct'] = self.get_ups_surcharge_for_range(
                    current,
                    next_val,
                    by_carrier['UPS'],
                    allow_formula=allow_ups_formula,
                    market=market,
                    fuel_category=fuel_category
                )
            
            rows.append(row)
            current = next_val
        
        return rows
    
    def _create_comparable_ranges_view(
        self, 
        data: List[Dict], 
        allow_ups_formula: bool = True,
        market: str = "US",
        fuel_category: str = "ground_domestic"
    ) -> List[Dict]:
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
            
            ups_pct = self.get_ups_surcharge_for_range(
                min_val,
                max_val,
                ups_data,
                allow_formula=allow_ups_formula,
                market=market,
                fuel_category=fuel_category
            )
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
        Ignores overly-wide catch-all bands (>$0.50 wide) unless they're the only option
        """
        # Look for exact match first
        for item in carrier_data:
            if item['at_least_usd'] == min_val and item['but_less_than_usd'] == max_val:
                return item['surcharge_pct']
        
        # Find all overlapping bands, separating fine-grained from catch-all bands
        fine_bands = []
        catch_all_bands = []
        CATCH_ALL_THRESHOLD = 0.50  # Bands wider than $0.50 are considered catch-all
        
        for item in carrier_data:
            # Check if there's any overlap between [min_val, max_val) and [item.at_least, item.but_less)
            if item['at_least_usd'] < max_val and item['but_less_than_usd'] > min_val:
                band_width = item['but_less_than_usd'] - item['at_least_usd']
                
                if band_width > CATCH_ALL_THRESHOLD:
                    catch_all_bands.append((band_width, item['surcharge_pct']))
                else:
                    fine_bands.append((band_width, item['surcharge_pct']))
        
        # Prefer fine-grained bands over catch-all bands
        if fine_bands:
            # Sort by band width (smallest first) and return the surcharge from the smallest band
            fine_bands.sort(key=lambda x: x[0])
            return fine_bands[0][1]
        
        # No fine-grained bands found - don't use catch-all bands as they're unreliable
        # Return None to show data correctly ends here
        return None
    
    async def get_carrier_focus(
        self,
        carrier: str,
        session_id: Optional[int] = None,
        fuel_type: Optional[str] = None,
        service_name: Optional[str] = None,
        fuel_category: Optional[str] = None,
        market: Optional[str] = None
    ) -> Dict:
        """
        Get focused comparison for a specific carrier
        Shows ranges where carrier is most competitive
        """
        comparison = await self.get_comparison(
            session_id,
            ComparisonView.COMPLETE,
            include_previous=False,
            fuel_type=fuel_type,
            service_name=service_name,
            fuel_category=fuel_category,
            market=market
        )
        
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
    
    async def get_carrier_last_updates(self, session_id: Optional[int] = None, fuel_type: str = None, fuel_category: str = None, market: str = None) -> Dict:
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
        
        # Get carriers present in current session to iterate over
        carriers = await self._get_distinct_carriers(session_id, fuel_type, fuel_category, market)
        
        if len(all_sessions) < 2:
            # Not enough history
            timestamp = all_sessions[0]['timestamp']
            return {carrier: {"last_updated": timestamp, "sessions_ago": 0} for carrier in carriers}
        
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
                current = await self._fetch_rows(
                    current_sess_id,
                    fuel_type,
                    None,
                    fuel_category,
                    market,
                    carrier=carrier
                )
                previous = await self._fetch_rows(
                    prev_sess_id,
                    fuel_type,
                    None,
                    fuel_category,
                    market,
                    carrier=carrier
                )
                
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

    async def _fetch_rows(
        self,
        session_id: int,
        fuel_type: Optional[str],
        service_name: Optional[str],
        fuel_category: Optional[str],
        market: Optional[str],
        carrier: Optional[str] = None,
        carriers: Optional[List[str]] = None,
        categories: Optional[List[str]] = None
    ) -> List[Dict]:
        """Fetch fuel surcharge rows with optional filtering"""
        query = """
            SELECT carrier, service, fuel_type, fuel_category, market, at_least_usd, but_less_than_usd, surcharge_pct
            FROM fuel_surcharges
            WHERE session_id = ?
        """
        params: List = [session_id]
        if fuel_type:
            query += " AND fuel_type = ?"
            params.append(fuel_type)
        if fuel_category:
            query += " AND fuel_category = ?"
            params.append(fuel_category)
        if service_name:
            query += " AND service = ?"
            params.append(service_name)
        if market:
            query += " AND market = ?"
            params.append(market)
        if carrier:
            query += " AND carrier = ?"
            params.append(carrier)
            
        if carriers:
            placeholders = ','.join('?' * len(carriers))
            query += f" AND carrier IN ({placeholders})"
            params.extend(carriers)
            
        if categories:
            placeholders = ','.join('?' * len(categories))
            query += f" AND fuel_category IN ({placeholders})"
            params.extend(categories)
            
        query += " ORDER BY at_least_usd, carrier"
        return await db.execute_query(query, tuple(params))

    async def _get_distinct_carriers(
        self,
        session_id: int,
        fuel_type: Optional[str],
        fuel_category: Optional[str],
        market: Optional[str]
    ) -> List[str]:
        """Return carriers present in a session"""
        query = "SELECT DISTINCT carrier FROM fuel_surcharges WHERE session_id = ?"
        params: List = [session_id]
        if fuel_type:
            query += " AND fuel_type = ?"
            params.append(fuel_type)
        if fuel_category:
            query += " AND fuel_category = ?"
            params.append(fuel_category)
        if market:
            query += " AND market = ?"
            params.append(market)
        rows = await db.execute_query(query, tuple(params))
        return [row['carrier'] for row in rows]


# Global service instance
comparison_service = ComparisonService()

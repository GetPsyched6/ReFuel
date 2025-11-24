"""
Overview analytics service for like-for-like cross-carrier comparisons
"""
from typing import List, Dict, Optional, Tuple
from datetime import datetime
from collections import defaultdict
import statistics


class ComparisonContext:
    """Defines a like-for-like comparison context"""
    
    def __init__(self, market: str, fuel_category: str):
        self.market = market
        self.fuel_category = fuel_category
    
    def matches(self, row: Dict) -> bool:
        """Check if a historical row matches this context"""
        return (
            row.get("market") == self.market and
            row.get("fuel_category") == self.fuel_category
        )
    
    def __repr__(self):
        return f"Context(market={self.market}, fuel_category={self.fuel_category})"


class OverviewAnalytics:
    """Analytics engine for overview dashboard"""
    
    def __init__(self, outlier_threshold_pp: float = 2.0):
        """
        Args:
            outlier_threshold_pp: Threshold in percentage points for outlier detection
        """
        self.outlier_threshold_pp = outlier_threshold_pp
    
    def filter_by_context(
        self, 
        historical_rows: List[Dict], 
        context: ComparisonContext
    ) -> List[Dict]:
        """Filter historical data to only rows matching the comparison context"""
        return [row for row in historical_rows if context.matches(row)]
    
    def get_carriers_in_context(
        self, 
        filtered_rows: List[Dict]
    ) -> List[str]:
        """Get unique carriers present in the filtered context"""
        carriers = set()
        for row in filtered_rows:
            carrier = row.get("carrier")
            if carrier:
                carriers.add(carrier)
        return sorted(list(carriers))
    
    def build_time_series(
        self, 
        filtered_rows: List[Dict]
    ) -> Dict[str, List[Dict]]:
        """
        Build time series data per carrier
        
        Returns:
            Dict mapping carrier name to list of {date, value} dicts
        """
        series_by_carrier = defaultdict(list)
        
        for row in filtered_rows:
            carrier = row.get("carrier")
            date_str = row.get("effective_start")
            value = row.get("value_numeric")
            
            if carrier and date_str and value is not None:
                # Parse date
                if isinstance(date_str, str):
                    try:
                        date_obj = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
                        date_display = date_obj.strftime('%Y-%m-%d')
                    except:
                        date_display = date_str[:10]  # Take first 10 chars
                else:
                    date_display = str(date_str)[:10]
                
                series_by_carrier[carrier].append({
                    "date": date_display,
                    "value": float(value)
                })
        
        # Sort each series by date
        for carrier in series_by_carrier:
            series_by_carrier[carrier].sort(key=lambda x: x["date"])
        
        return dict(series_by_carrier)
    
    def calculate_recent_movement(
        self, 
        filtered_rows: List[Dict],
        num_periods: int = 8
    ) -> List[Dict]:
        """
        Calculate recent movement (delta) for each carrier
        
        Args:
            filtered_rows: Historical rows filtered by context
            num_periods: Number of recent periods to analyze
        
        Returns:
            List of dicts with carrier, service, latest_pct, delta_pp, direction
        """
        series_by_carrier = self.build_time_series(filtered_rows)
        movements = []
        
        for carrier, series in series_by_carrier.items():
            if len(series) < 2:
                continue
            
            # Get last num_periods points
            recent = series[-num_periods:] if len(series) >= num_periods else series
            
            if len(recent) < 2:
                continue
            
            # Calculate delta between last two points
            current = recent[-1]["value"]
            previous = recent[-2]["value"]
            delta_pp = current - previous
            
            # Determine direction
            if abs(delta_pp) < 0.01:
                direction = "Flat"
            elif delta_pp > 0:
                direction = "Up"
            else:
                direction = "Down"
            
            # Get service name from filtered rows
            service = next(
                (row.get("service", "") for row in filtered_rows 
                 if row.get("carrier") == carrier),
                ""
            )
            
            movements.append({
                "carrier": carrier,
                "service": service,
                "latest_pct": round(current, 2),
                "delta_pp": round(delta_pp, 2),
                "direction": direction,
                "latest_date": recent[-1]["date"]
            })
        
        # Sort by absolute delta descending
        movements.sort(key=lambda x: abs(x["delta_pp"]), reverse=True)
        
        return movements
    
    def detect_outliers(
        self, 
        filtered_rows: List[Dict]
    ) -> List[Dict]:
        """
        Detect outliers where a carrier differs significantly from median
        
        Args:
            filtered_rows: Historical rows filtered by context
        
        Returns:
            List of outlier records with date, carrier, service, surcharge, median, delta
        """
        # Group by date
        data_by_date = defaultdict(list)
        
        for row in filtered_rows:
            date_str = row.get("effective_start")
            carrier = row.get("carrier")
            value = row.get("value_numeric")
            service = row.get("service", "")
            
            if date_str and carrier and value is not None:
                # Parse date
                if isinstance(date_str, str):
                    try:
                        date_obj = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
                        date_display = date_obj.strftime('%Y-%m-%d')
                    except:
                        date_display = date_str[:10]
                else:
                    date_display = str(date_str)[:10]
                
                data_by_date[date_display].append({
                    "carrier": carrier,
                    "service": service,
                    "value": float(value)
                })
        
        outliers = []
        
        for date, entries in data_by_date.items():
            # Need at least 2 carriers for comparison
            if len(entries) < 2:
                continue
            
            values = [e["value"] for e in entries]
            median = statistics.median(values)
            
            for entry in entries:
                delta = entry["value"] - median
                
                if abs(delta) > self.outlier_threshold_pp:
                    outliers.append({
                        "date": date,
                        "carrier": entry["carrier"],
                        "service": entry["service"],
                        "surcharge_pct": round(entry["value"], 2),
                        "median_pct": round(median, 2),
                        "delta_pp": round(delta, 2)
                    })
        
        # Sort by absolute delta descending
        outliers.sort(key=lambda x: abs(x["delta_pp"]), reverse=True)
        
        return outliers
    
    def generate_scatter_data(
        self,
        filtered_rows: List[Dict]
    ) -> List[Dict]:
        """
        Generate outlier scatter data: (date, carrier, delta_pp from median)
        
        Returns:
            List of dicts with date, carrier, service, surcharge_pct, median_pct, delta_pp
        """
        data_by_date = defaultdict(list)
        
        for row in filtered_rows:
            date_str = row.get("effective_start")
            carrier = row.get("carrier")
            value = row.get("value_numeric")
            service = row.get("service", "")
            
            if date_str and carrier and value is not None:
                if isinstance(date_str, str):
                    try:
                        date_obj = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
                        date_display = date_obj.strftime('%Y-%m-%d')
                    except:
                        date_display = date_str[:10]
                else:
                    date_display = str(date_str)[:10]
                
                data_by_date[date_display].append({
                    "carrier": carrier,
                    "service": service,
                    "value": float(value)
                })
        
        scatter_points = []
        
        for date, entries in data_by_date.items():
            if len(entries) < 2:
                continue
            
            values = [e["value"] for e in entries]
            median = statistics.median(values)
            
            for entry in entries:
                delta = entry["value"] - median
                scatter_points.append({
                    "date": date,
                    "carrier": entry["carrier"],
                    "service": entry["service"],
                    "surcharge_pct": round(entry["value"], 2),
                    "median_pct": round(median, 2),
                    "delta_pp": round(delta, 2)
                })
        
        scatter_points.sort(key=lambda x: x["date"])
        return scatter_points
    
    def generate_cadence_data(
        self,
        filtered_rows: List[Dict],
        months_back: int = 6,
        context: Optional[ComparisonContext] = None
    ) -> Dict:
        """
        Generate cadence heatmap data showing when carriers update surcharges.
        
        For DHL Germany: Uses actual monthly update dates (not weekly-mapped dates).
        For UPS/FedEx: Uses all weekly effective_start dates.
        
        Time window: Uses min(6 months, max available for each carrier).
        
        Returns:
            Dict with carrier_updates: {carrier: [{date, old_pct, new_pct, service}]}
        """
        from datetime import datetime, timedelta
        
        cadence_data = {}
        
        # Calculate oldest date per carrier to determine dynamic window
        carrier_oldest_dates: Dict[str, datetime] = {}
        now = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
        
        for row in filtered_rows:
            carrier = row.get("carrier")
            effective_start = row.get("effective_start")
            
            if not carrier or not effective_start:
                continue
            
            # Parse date
            if isinstance(effective_start, str):
                try:
                    if "T" in effective_start:
                        date_str_clean = effective_start.replace("Z", "").split("T")[0]
                        date_obj = datetime.strptime(date_str_clean, "%Y-%m-%d")
                    else:
                        date_obj = datetime.strptime(effective_start, "%Y-%m-%d")
                except:
                    continue
            elif isinstance(effective_start, datetime):
                date_obj = effective_start
            else:
                continue
            
            date_obj = date_obj.replace(hour=0, minute=0, second=0, microsecond=0)
            
            if carrier not in carrier_oldest_dates or date_obj < carrier_oldest_dates[carrier]:
                carrier_oldest_dates[carrier] = date_obj
        
        # Calculate dynamic cutoff per carrier: min(6 months, max available)
        carrier_cutoffs: Dict[str, datetime] = {}
        for carrier, oldest_date in carrier_oldest_dates.items():
            months_available = (now.year - oldest_date.year) * 12 + (now.month - oldest_date.month)
            months_to_use = min(months_back, max(1, months_available))
            carrier_cutoffs[carrier] = (now - timedelta(days=months_to_use * 30)).replace(hour=0, minute=0, second=0, microsecond=0)
        
        # Check if this is DHL Germany - use monthly update dates
        is_dhl_germany = (
            context and 
            context.market == "DE" and 
            any(row.get("carrier") == "DHL" for row in filtered_rows)
        )
        
        if is_dhl_germany:
            # For DHL Germany, use monthly update dates from the mapper
            from services.dhl_germany_weekly_mapper import DHL_GERMANY_MONTHLY
            
            fuel_category = context.fuel_category if context else None
            if fuel_category and fuel_category in DHL_GERMANY_MONTHLY:
                monthly_data = DHL_GERMANY_MONTHLY[fuel_category]
                dhl_updates = []
                prev_pct = None
                
                # Get DHL-specific cutoff
                dhl_cutoff = carrier_cutoffs.get("DHL", (now - timedelta(days=months_back * 30)).replace(hour=0, minute=0, second=0, microsecond=0))
                
                for month_key in sorted(monthly_data.keys()):
                    month_data = monthly_data[month_key]
                    year, month = map(int, month_key.split("-"))
                    
                    # Use the 1st of the month as the update date
                    update_date = datetime(year, month, 1)
                    
                    if update_date >= dhl_cutoff:
                        new_pct = month_data.get("surcharge")
                        dhl_updates.append({
                            "date": update_date.strftime("%Y-%m-%d"),
                            "old_pct": round(prev_pct, 2) if prev_pct is not None else None,
                            "new_pct": round(new_pct, 2) if new_pct is not None else None,
                            "service": next(
                                (row.get("service", "") for row in filtered_rows 
                                 if row.get("carrier") == "DHL"),
                                ""
                            )
                        })
                        if new_pct is not None:
                            prev_pct = new_pct
                
                if dhl_updates:
                    cadence_data["DHL"] = dhl_updates
        
        # For all other carriers (and non-DHL rows), use effective_start dates
        seen_dates: Dict[str, set] = {}
        by_carrier_date: Dict[str, Dict[str, Dict]] = {}
        
        for row in filtered_rows:
            carrier = row.get("carrier")
            effective_start = row.get("effective_start")
            
            # Skip DHL Germany - already handled above
            if is_dhl_germany and carrier == "DHL":
                continue
            
            if not carrier or not effective_start:
                continue
            
            # Parse date - handle SQLite DATE() format and ISO strings
            if isinstance(effective_start, str):
                try:
                    # SQLite DATE() returns "YYYY-MM-DD" format
                    # ISO format has "T" separator
                    if "T" in effective_start:
                        # Remove timezone if present
                        date_str_clean = effective_start.replace("Z", "").split("T")[0]
                        date_obj = datetime.strptime(date_str_clean, "%Y-%m-%d")
                    else:
                        # Already in YYYY-MM-DD format from SQLite DATE()
                        date_obj = datetime.strptime(effective_start, "%Y-%m-%d")
                except Exception as e:
                    continue
            elif isinstance(effective_start, datetime):
                date_obj = effective_start
            else:
                continue
            
            # Normalize to date only (midnight) for comparison
            date_obj = date_obj.replace(hour=0, minute=0, second=0, microsecond=0)
            
            # Filter to recent months using carrier-specific cutoff
            carrier_cutoff = carrier_cutoffs.get(carrier, (now - timedelta(days=months_back * 30)).replace(hour=0, minute=0, second=0, microsecond=0))
            if date_obj < carrier_cutoff:
                continue
            
            date_str = date_obj.strftime("%Y-%m-%d")
            
            if carrier not in seen_dates:
                seen_dates[carrier] = set()
                by_carrier_date[carrier] = {}
            
            # Only add if we haven't seen this (carrier, date) combination
            # If multiple rows have same date, use the first one
            if date_str not in seen_dates[carrier]:
                seen_dates[carrier].add(date_str)
                by_carrier_date[carrier][date_str] = {
                    "date": date_str,
                    "new_pct": row.get("value_numeric"),
                    "service": row.get("service", ""),
                    "value_text": row.get("value_text", "")
                }
        
        # Build updates list for each carrier, sorted by date
        for carrier, dates_dict in by_carrier_date.items():
            updates = []
            sorted_dates = sorted(dates_dict.keys())
            
            # Track previous value to show transitions
            prev_pct = None
            
            for date_str in sorted_dates:
                current = dates_dict[date_str]
                new_pct = current["new_pct"]
                
                updates.append({
                    "date": date_str,
                    "old_pct": round(prev_pct, 2) if prev_pct is not None else None,
                    "new_pct": round(new_pct, 2) if new_pct is not None else None,
                    "service": current["service"]
                })
                
                # Update prev_pct for next iteration
                if new_pct is not None:
                    prev_pct = new_pct
            
            if updates:
                cadence_data[carrier] = updates
        
        return {"carrier_updates": cadence_data}
    
    def calculate_relative_surcharge_index(
        self,
        filtered_rows: List[Dict],
        window_size: int = 8
    ) -> Dict:
        """
        Calculate relative surcharge index for each carrier in the context.
        
        Args:
            filtered_rows: Historical rows already filtered by context
            window_size: Number of recent dates to average (default 8)
        
        Returns:
            Dict with carrier_indices list and metadata
        """
        if not filtered_rows:
            return {
                "carrier_indices": [],
                "window_size": 0,
                "has_data": False,
                "message": "No data available"
            }
        
        by_date = defaultdict(lambda: defaultdict(list))
        for row in filtered_rows:
            date = row.get("effective_start")
            carrier = row.get("carrier")
            value_numeric = row.get("value_numeric")
            
            if date and carrier and value_numeric is not None:
                by_date[date][carrier].append(float(value_numeric))
        
        sorted_dates = sorted(by_date.keys(), reverse=True)
        
        if not sorted_dates:
            return {
                "carrier_indices": [],
                "window_size": 0,
                "has_data": False,
                "message": "No valid date data"
            }
        
        carriers_in_data = set()
        for date_data in by_date.values():
            carriers_in_data.update(date_data.keys())
        
        carriers_list = sorted(list(carriers_in_data))
        
        if len(carriers_list) == 0:
            return {
                "carrier_indices": [],
                "window_size": 0,
                "has_data": False,
                "message": "No carriers found"
            }
        
        recent_dates = []
        for date in sorted_dates:
            if len(recent_dates) >= window_size:
                break
            date_carriers = set(by_date[date].keys())
            if len(date_carriers) >= len(carriers_list):
                recent_dates.append(date)
        
        if len(recent_dates) < 3:
            recent_dates = sorted_dates[:max(window_size, 10)]
        
        if not recent_dates:
            return {
                "carrier_indices": [],
                "window_size": 0,
                "has_data": False,
                "message": "Insufficient recent data"
            }
        
        carrier_averages = {}
        for carrier in carriers_list:
            values = []
            for date in recent_dates:
                if carrier in by_date[date]:
                    values.extend(by_date[date][carrier])
            
            if values:
                carrier_averages[carrier] = statistics.mean(values)
        
        if not carrier_averages:
            return {
                "carrier_indices": [],
                "window_size": len(recent_dates),
                "has_data": False,
                "message": "Could not calculate averages"
            }
        
        min_avg = min(carrier_averages.values())
        
        carrier_indices = []
        for carrier in sorted(carrier_averages.keys()):
            avg_surcharge = carrier_averages[carrier]
            relative_index = avg_surcharge / min_avg if min_avg > 0 else 1.0
            delta_pp = avg_surcharge - min_avg
            
            intensity_level = "baseline"
            if relative_index > 1.10:
                intensity_level = "higher"
            elif relative_index > 1.05:
                intensity_level = "slightly_higher"
            elif relative_index > 1.0:
                intensity_level = "near_cheapest"
            
            carrier_indices.append({
                "carrier": carrier,
                "avg_surcharge": round(avg_surcharge, 2),
                "relative_index": round(relative_index, 3),
                "delta_pp": round(delta_pp, 2),
                "intensity_level": intensity_level,
                "is_cheapest": abs(delta_pp) < 0.01
            })
        
        carrier_indices.sort(key=lambda x: x["relative_index"])
        
        return {
            "carrier_indices": carrier_indices,
            "window_size": len(recent_dates),
            "has_data": True,
            "num_carriers": len(carrier_indices),
            "cheapest_carrier": carrier_indices[0]["carrier"] if carrier_indices else None,
            "min_surcharge": min_avg
        }
    
    def generate_overview(
        self, 
        historical_rows: List[Dict],
        context: ComparisonContext,
        band_rows: Optional[List[Dict]] = None
    ) -> Dict:
        """
        Generate complete overview analytics for a given context
        
        Returns:
            Dict with time_series, recent_movement, outliers, carriers, and new visualizations
        """
        filtered = self.filter_by_context(historical_rows, context)
        carriers = self.get_carriers_in_context(filtered)
        time_series = self.build_time_series(filtered)
        recent_movement = self.calculate_recent_movement(filtered)
        
        outliers = []
        scatter_data = []
        if len(carriers) >= 2:
            outliers = self.detect_outliers(filtered)
            scatter_data = self.generate_scatter_data(filtered)
        
        cadence_data = self.generate_cadence_data(filtered, context=context)
        relative_index_data = self.calculate_relative_surcharge_index(filtered)
        
        return {
            "context": {
                "market": context.market,
                "fuel_category": context.fuel_category
            },
            "carriers": carriers,
            "num_carriers": len(carriers),
            "time_series": time_series,
            "recent_movement": recent_movement,
            "outliers": outliers,
            "outlier_threshold_pp": self.outlier_threshold_pp,
            "comparison_available": len(carriers) >= 2,
            "scatter_data": scatter_data,
            "cadence_data": cadence_data,
            "relative_index_data": relative_index_data
        }


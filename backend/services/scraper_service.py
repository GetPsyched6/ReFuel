"""
Scraper service - orchestrates scraping and data storage
"""
import sys
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Optional
import json

# Add scraper to path
sys.path.insert(0, str(Path(__file__).parent.parent / "scraper"))

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from models.database import db
from models.schemas import (
    SessionStatus, ScrapeSessionCreate,
    FuelSurchargeData, CarrierHistoryData, ScrapeResult
)


DEFAULT_CARRIERS = ["UPS", "FedEx", "DHL"]
CARRIER_KEY_TO_LABEL = {
    'ups': "UPS",
    'fedex': "FedEx",
    'dhl': "DHL",
}

CATEGORY_MAP = {
    "ground domestic": "ground_domestic",
    "ground": "ground_domestic",
    "express road (germany)": "ground_domestic",
    "dhl express road (germany)": "ground_domestic",
    "fedex ground, fedex home delivery, and fedex international ground services, and pickup services": "ground_domestic",
    "fedex ground domestic": "ground_domestic",
    "ground regional": "ground_regional",
    "fedex ground regional": "ground_regional",
    "other package and express freight services": "ground_domestic",
    "domestic air surcharge": "domestic_air",
    "international air export surcharge": "international_air_export",
    "international air import surcharge": "international_air_import",
    "international ground export import surcharge": "international_ground_export_import",
}


class ScraperService:
    """Service for managing fuel surcharge scraping"""
    
    async def scrape_carriers(self, carriers: Optional[List[str]] = None) -> ScrapeResult:
        """
        Execute scraping for specified carriers
        
        Args:
            carriers: List of carriers to scrape (None = all)
            
        Returns:
            ScrapeResult with session data
        """
        from scraper.scraper_selenium import StealthFuelScraper
        
        # Default to all carriers
        if carriers is None:
            carriers = DEFAULT_CARRIERS.copy()
        requested = {c.lower(): c for c in carriers}
        
        # Execute scraping
        scraper = StealthFuelScraper()
        try:
            await self._run_scraper(scraper)
            
            # Extract results
            scraped_data = []
            history_data: List[CarrierHistoryData] = []
            carriers_scraped: List[str] = []
            total_rows = 0
            
            for carrier_key, carrier_label in CARRIER_KEY_TO_LABEL.items():
                result_data = scraper.results.get(carrier_key, [])
                if carrier_label.lower() not in requested or not result_data:
                    continue
                
                carriers_scraped.append(carrier_label)
                for item in result_data:
                        scraped_data.append(FuelSurchargeData(
                            carrier=carrier_label,
                            service=item['service'],
                            market=item.get('market', 'US'),
                            currency=item.get('currency', 'USD'),
                            fuel_type=item.get('fuel_type', item.get('service', 'Ground Domestic')),
                            fuel_category=item.get('fuel_category', self._normalize_category(item.get('service', ''))),
                            at_least_usd=float(item['at_least_usd']),
                            but_less_than_usd=float(item['but_less_than_usd']),
                            surcharge_pct=self._parse_surcharge(item['surcharge']),
                            scraped_at=datetime.fromisoformat(item['scraped_at'])
                        ))
                        total_rows += 1

            # Collect history data (UPS 90-day, FedEx historical, etc.)
            history_mappings = [
                ('ups_history', "UPS"),
                ('fedex_history', "FedEx")
            ]
            for key, carrier_enum in history_mappings:
                history_rows = scraper.results.get(key, [])
                if not history_rows:
                    continue
                if carrier_enum.lower() not in requested:
                    continue
                if carrier_enum not in carriers_scraped:
                    carriers_scraped.append(carrier_enum)
                for item in history_rows:
                    effective_end = (
                        datetime.fromisoformat(item['effective_end'])
                        if item.get('effective_end') else None
                    )
                    value_numeric = item.get('value_numeric')
                    if value_numeric is not None:
                        value_numeric = float(value_numeric)
                    history_entry = CarrierHistoryData(
                        carrier=carrier_enum,
                        service=item['service'],
                        market=item.get('market', 'US'),
                        currency=item.get('currency', 'USD'),
                        fuel_type=item.get('fuel_type', item['service']),
                        fuel_category=item.get('fuel_category', self._normalize_category(item['service'])),
                        effective_start=datetime.fromisoformat(item['effective_start']),
                        effective_end=effective_end,
                        value_text=item['value_text'],
                        value_numeric=value_numeric,
                        value_unit=item.get('value_unit'),
                        scraped_at=datetime.fromisoformat(item['scraped_at'])
                    )
                    history_data.append(history_entry)
                    total_rows += 1
            
            # Determine status
            if not carriers_scraped:
                status = SessionStatus.FAILED
            elif len(carriers_scraped) < len(requested):
                status = SessionStatus.PARTIAL
            else:
                status = SessionStatus.SUCCESS
            
            store_price_ranges = set(requested.values()) == set(DEFAULT_CARRIERS)
            session_id: Optional[int] = None
            
            is_duplicate = False
            if store_price_ranges:
                is_duplicate = await self.is_duplicate_data(scraped_data)
            
            if store_price_ranges and not is_duplicate:
                session_id = await self._save_session(
                    carriers_scraped=carriers_scraped,
                    status=status,
                    total_rows=total_rows,
                    data=scraped_data,
                    history_data=history_data
                )
            elif store_price_ranges and is_duplicate:
                 # If duplicate, we skip creating a new session for price ranges.
                 # But we still ensure history data is updated/inserted if needed.
                 if history_data:
                     await self._save_history_entries(history_data, None)
            else:
                # Only persist history rows when we're not scraping every carrier.
                if history_data:
                    await self._save_history_entries(history_data, None)
                # Drop price-range data to avoid partial sessions in the DB
                scraped_data = []
            
            return ScrapeResult(
                session_id=session_id,
                status=status,
                carriers_scraped=carriers_scraped,
                total_rows=total_rows,
                data=scraped_data,
                history=history_data,
                error=None
            )
            
        except Exception as e:
            # Save failed session
            session_id = await self._save_session(
                carriers_scraped=[],
                status=SessionStatus.FAILED,
                total_rows=0,
                data=[],
                history_data=[],
                notes=str(e)
            )
            
            return ScrapeResult(
                session_id=session_id,
                status=SessionStatus.FAILED,
                carriers_scraped=[],
                total_rows=0,
                data=[],
                history=[],
                error=str(e)
            )
    
    async def _run_scraper(self, scraper):
        """Run scraper synchronously in async context"""
        import asyncio
        from concurrent.futures import ThreadPoolExecutor
        
        loop = asyncio.get_event_loop()
        with ThreadPoolExecutor() as executor:
            await loop.run_in_executor(executor, scraper.scrape_all)
    
    async def _save_session(
        self,
        carriers_scraped: List[str],
        status: SessionStatus,
        total_rows: int,
        data: List[FuelSurchargeData],
        history_data: Optional[List[CarrierHistoryData]] = None,
        notes: Optional[str] = None
    ) -> int:
        """Save scrape session and data to database"""
        
        # Create session
        session_query = """
            INSERT INTO scrape_sessions (status, carriers_scraped, total_rows, notes)
            VALUES (?, ?, ?, ?)
        """
        session_id = await db.execute_write(
            session_query,
            (
                status.value,
                json.dumps(carriers_scraped),
                total_rows,
                notes
            )
        )
        
        # Insert fuel surcharge data
        if data:
            data_query = """
                INSERT INTO fuel_surcharges 
                (session_id, carrier, service, market, currency, fuel_type, fuel_category, at_least_usd, but_less_than_usd, surcharge_pct, scraped_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """
            params = [
                (
                    session_id,
                    item.carrier,
                    item.service,
                    item.market,
                    item.currency,
                    item.fuel_type,
                    item.fuel_category,
                    item.at_least_usd,
                    item.but_less_than_usd,
                    item.surcharge_pct,
                    item.scraped_at.isoformat()
                )
                for item in data
            ]
            await db.execute_many(data_query, params)

        await self._save_history_entries(history_data, session_id)
        
        return session_id
    
    async def get_latest_session(self) -> Optional[Dict]:
        """Get latest scrape session"""
        query = """
            SELECT * FROM scrape_sessions 
            ORDER BY timestamp DESC 
            LIMIT 1
        """
        results = await db.execute_query(query)
        return results[0] if results else None
    
    async def get_session_data(self, session_id: int) -> List[Dict]:
        """Get fuel surcharge data for a session"""
        query = """
            SELECT * FROM fuel_surcharges 
            WHERE session_id = ?
            ORDER BY carrier, at_least_usd
        """
        return await db.execute_query(query, (session_id,))
    
    async def is_duplicate_data(self, new_data: List[FuelSurchargeData]) -> bool:
        """
        Check if new data is identical to the latest session data.
        Returns True if duplicate, False if different or first session.
        """
        # Get latest session
        latest = await self.get_latest_session()
        if not latest:
            return False  # First session, not a duplicate
        
        # Get latest session data
        latest_data = await self.get_session_data(latest['id'])
        
        # Check if row counts match
        if len(new_data) != len(latest_data):
            return False  # Different count = different data
        
        # Sort both datasets for comparison
        new_sorted = sorted([
            (d.carrier, d.at_least_usd, d.but_less_than_usd, d.surcharge_pct)
            for d in new_data
        ])
        
        latest_sorted = sorted([
            (d['carrier'], d['at_least_usd'], d['but_less_than_usd'], d['surcharge_pct'])
            for d in latest_data
        ])
        
        # Compare each row
        for new_row, latest_row in zip(new_sorted, latest_sorted):
            new_carrier, new_min, new_max, new_pct = new_row
            latest_carrier, latest_min, latest_max, latest_pct = latest_row
            
            # Check all fields match
            if (new_carrier != latest_carrier or 
                abs(new_min - latest_min) > 0.01 or 
                abs(new_max - latest_max) > 0.01 or 
                abs(new_pct - latest_pct) > 0.01):
                return False  # Found a difference
        
        return True  # All rows match = duplicate
    
    async def _save_history_entries(
        self,
        history_data: Optional[List[CarrierHistoryData]],
        session_id: Optional[int],
    ):
        """Insert or update historical surcharge rows."""
        if not history_data:
            return
        for item in history_data:
            effective_end = item.effective_end.isoformat() if item.effective_end else None
            select_query = """
                SELECT id, value_text, value_numeric, value_unit
                FROM fuel_surcharge_history
                WHERE carrier = ? AND service = ? AND market = ? AND currency = ?
                  AND fuel_type = ? AND fuel_category = ? AND effective_start = ?
                  AND (
                    (effective_end IS NULL AND ? IS NULL) OR
                    (effective_end = ?)
                  )
            """
            params = (
                item.carrier,
                item.service,
                item.market,
                item.currency,
                item.fuel_type,
                item.fuel_category,
                item.effective_start.isoformat(),
                effective_end,
                effective_end,
            )
            existing = await db.execute_query(select_query, params)
            if existing:
                row = existing[0]
                if (
                    row["value_text"] != item.value_text
                    or (row["value_numeric"] or 0) != (item.value_numeric or 0)
                    or row["value_unit"] != item.value_unit
                ):
                    await db.execute_write(
                        """
                        UPDATE fuel_surcharge_history
                        SET session_id = ?, value_text = ?, value_numeric = ?, value_unit = ?, scraped_at = ?
                        WHERE id = ?
                        """,
                        (
                            session_id,
                            item.value_text,
                            item.value_numeric,
                            item.value_unit,
                            item.scraped_at.isoformat(),
                            row["id"],
                        ),
                    )
                continue

            await db.execute_write(
                """
                INSERT INTO fuel_surcharge_history
                (session_id, carrier, service, market, currency, fuel_type, fuel_category, effective_start, effective_end, value_text, value_numeric, value_unit, scraped_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    session_id,
                    item.carrier,
                    item.service,
                    item.market,
                    item.currency,
                    item.fuel_type,
                    item.fuel_category,
                    item.effective_start.isoformat(),
                    effective_end,
                    item.value_text,
                    item.value_numeric,
                    item.value_unit,
                    item.scraped_at.isoformat(),
                ),
            )
    
    async def cleanup_old_sessions(self, keep_count: int = 1) -> int:
        """
        Delete all but the most recent N sessions.
        
        Args:
            keep_count: Number of most recent sessions to keep (default 1)
            
        Returns:
            Number of sessions deleted
        """
        # Get sessions to keep
        query = """
            SELECT id FROM scrape_sessions 
            ORDER BY timestamp DESC 
            LIMIT ?
        """
        keep_sessions = await db.execute_query(query, (keep_count,))
        keep_ids = [s['id'] for s in keep_sessions]
        
        if not keep_ids:
            return 0
        
        # Delete older sessions
        placeholders = ','.join('?' * len(keep_ids))
        delete_query = f"""
            DELETE FROM scrape_sessions 
            WHERE id NOT IN ({placeholders})
        """
        
        # Get count before delete
        count_query = f"""
            SELECT COUNT(*) as count FROM scrape_sessions 
            WHERE id NOT IN ({placeholders})
        """
        count_result = await db.execute_query(count_query, tuple(keep_ids))
        deleted_count = count_result[0]['count'] if count_result else 0
        
        # Execute delete
        if deleted_count > 0:
            await db.execute_write(delete_query, tuple(keep_ids))
        
        return deleted_count
    
    async def check_data_changes(self, new_session_id: int) -> Dict:
        """Compare new session data with previous session"""
        # Get previous session
        query = """
            SELECT id FROM scrape_sessions 
            WHERE id < ? AND status = 'success'
            ORDER BY timestamp DESC 
            LIMIT 1
        """
        prev_sessions = await db.execute_query(query, (new_session_id,))
        
        if not prev_sessions:
            return {"has_changes": True, "is_first": True}
        
        prev_session_id = prev_sessions[0]['id']
        
        # Compare data counts
        new_data = await self.get_session_data(new_session_id)
        old_data = await self.get_session_data(prev_session_id)
        
        if len(new_data) != len(old_data):
            return {"has_changes": True, "is_first": False}
        
        # Compare actual values (simple check)
        new_hash = hash(json.dumps(new_data, sort_keys=True))
        old_hash = hash(json.dumps(old_data, sort_keys=True))
        
        return {
            "has_changes": new_hash != old_hash,
            "is_first": False
        }
    
    def _normalize_category(self, service: str) -> str:
        """Normalize service labels to canonical categories"""
        if not service:
            return "ground_domestic"
        normalized = service.strip().lower()
        return CATEGORY_MAP.get(normalized, normalized.replace(" ", "_"))
    
    def _parse_surcharge(self, surcharge_str: str) -> float:
        """Parse surcharge percentage string to float"""
        # Remove % and any spaces
        cleaned = surcharge_str.replace('%', '').strip()
        return float(cleaned)


# Global service instance
scraper_service = ScraperService()

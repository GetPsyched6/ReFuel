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
    CarrierEnum, SessionStatus, ScrapeSessionCreate,
    FuelSurchargeData, ScrapeResult
)


class ScraperService:
    """Service for managing fuel surcharge scraping"""
    
    async def scrape_carriers(self, carriers: Optional[List[CarrierEnum]] = None) -> ScrapeResult:
        """
        Execute scraping for specified carriers
        
        Args:
            carriers: List of carriers to scrape (None = all)
            
        Returns:
            ScrapeResult with session data
        """
        from scraper_selenium import StealthFuelScraper
        
        # Default to all carriers
        if carriers is None:
            carriers = [CarrierEnum.UPS, CarrierEnum.FEDEX, CarrierEnum.DHL]
        
        # Execute scraping
        scraper = StealthFuelScraper()
        try:
            await self._run_scraper(scraper)
            
            # Extract results
            scraped_data = []
            carriers_scraped = []
            total_rows = 0
            
            for carrier_name in ['ups', 'fedex', 'dhl']:
                carrier_enum = self._map_carrier_name(carrier_name)
                if carrier_enum in carriers and scraper.results[carrier_name]:
                    carriers_scraped.append(carrier_enum)
                    for item in scraper.results[carrier_name]:
                        scraped_data.append(FuelSurchargeData(
                            carrier=carrier_enum,
                            service=item['service'],
                            at_least_usd=float(item['at_least_usd']),
                            but_less_than_usd=float(item['but_less_than_usd']),
                            surcharge_pct=self._parse_surcharge(item['surcharge']),
                            scraped_at=datetime.fromisoformat(item['scraped_at'])
                        ))
                        total_rows += 1
            
            # Determine status
            if not carriers_scraped:
                status = SessionStatus.FAILED
            elif len(carriers_scraped) < len(carriers):
                status = SessionStatus.PARTIAL
            else:
                status = SessionStatus.SUCCESS
            
            # Save to database
            session_id = await self._save_session(
                carriers_scraped=carriers_scraped,
                status=status,
                total_rows=total_rows,
                data=scraped_data
            )
            
            return ScrapeResult(
                session_id=session_id,
                status=status,
                carriers_scraped=carriers_scraped,
                total_rows=total_rows,
                data=scraped_data,
                error=None
            )
            
        except Exception as e:
            # Save failed session
            session_id = await self._save_session(
                carriers_scraped=[],
                status=SessionStatus.FAILED,
                total_rows=0,
                data=[],
                notes=str(e)
            )
            
            return ScrapeResult(
                session_id=session_id,
                status=SessionStatus.FAILED,
                carriers_scraped=[],
                total_rows=0,
                data=[],
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
        carriers_scraped: List[CarrierEnum],
        status: SessionStatus,
        total_rows: int,
        data: List[FuelSurchargeData],
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
                json.dumps([c.value for c in carriers_scraped]),
                total_rows,
                notes
            )
        )
        
        # Insert fuel surcharge data
        if data:
            data_query = """
                INSERT INTO fuel_surcharges 
                (session_id, carrier, service, at_least_usd, but_less_than_usd, surcharge_pct, scraped_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """
            params = [
                (
                    session_id,
                    item.carrier.value,
                    item.service,
                    item.at_least_usd,
                    item.but_less_than_usd,
                    item.surcharge_pct,
                    item.scraped_at.isoformat()
                )
                for item in data
            ]
            await db.execute_many(data_query, params)
        
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
    
    def _map_carrier_name(self, name: str) -> CarrierEnum:
        """Map internal carrier name to enum"""
        mapping = {
            'ups': CarrierEnum.UPS,
            'fedex': CarrierEnum.FEDEX,
            'dhl': CarrierEnum.DHL
        }
        return mapping[name.lower()]
    
    def _parse_surcharge(self, surcharge_str: str) -> float:
        """Parse surcharge percentage string to float"""
        # Remove % and any spaces
        cleaned = surcharge_str.replace('%', '').strip()
        return float(cleaned)


# Global service instance
scraper_service = ScraperService()


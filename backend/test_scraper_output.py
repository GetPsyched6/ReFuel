"""
Test script to run scrapers and output to temp file, then compare with DB
"""
import asyncio
import json
import sys
from pathlib import Path
from datetime import datetime
from typing import Dict, List

sys.path.insert(0, str(Path(__file__).parent))

from scraper.scraper_selenium import StealthFuelScraper
from models.database import db


async def get_db_data():
    """Get current data from database"""
    print("\n" + "=" * 70)
    print("📊 FETCHING DATA FROM DATABASE")
    print("=" * 70)
    
    # Get price range data (fuel_surcharges)
    price_ranges_query = """
        SELECT 
            carrier, service, market, currency, fuel_type, fuel_category,
            at_least_usd, but_less_than_usd, surcharge_pct,
            scraped_at
        FROM fuel_surcharges
        ORDER BY carrier, market, fuel_category, at_least_usd
        LIMIT 100
    """
    
    # Get historical data (fuel_surcharge_history)
    history_query = """
        SELECT 
            carrier, service, market, currency, fuel_type, fuel_category,
            effective_start, effective_end, value_text, value_numeric, value_unit,
            scraped_at
        FROM fuel_surcharge_history
        ORDER BY carrier, market, fuel_category, effective_start DESC
        LIMIT 100
    """
    
    price_ranges = await db.execute_query(price_ranges_query)
    history = await db.execute_query(history_query)
    
    return {
        "price_ranges": price_ranges,
        "history": history
    }


def run_scraper_to_file():
    """Run scraper and output to temp file"""
    print("\n" + "=" * 70)
    print("🕷️  RUNNING SCRAPER (NO DB WRITES)")
    print("=" * 70)
    
    scraper = StealthFuelScraper()
    
    try:
        scraper.initialize_driver()
        scraper._ensure_market_scrapers()
        
        us_scraper = scraper._market_scrapers["us"]
        de_scraper = scraper._market_scrapers["de"]
        
        # Scrape US
        print("\n[US Market]")
        ups_data, ups_history = us_scraper.scrape_ups()
        fedex_data = us_scraper.scrape_fedex()
        fedex_history = us_scraper.scrape_fedex_history()
        
        # Scrape Germany
        print("\n[Germany Market]")
        dhl_data = de_scraper.scrape_dhl()
        ups_de_data, ups_de_history = de_scraper.scrape_ups()
        
        # Combine results
        scraped_results = {
            "timestamp": datetime.now().isoformat(),
            "ups_us": {
                "price_ranges": ups_data or [],
                "history": ups_history or []
            },
            "fedex_us": {
                "price_ranges": fedex_data or [],
                "history": fedex_history or []
            },
            "dhl_de": {
                "price_ranges": dhl_data or [],
                "history": []
            },
            "ups_de": {
                "price_ranges": ups_de_data or [],
                "history": ups_de_history or []
            }
        }
        
        # Write to temp file
        temp_file = Path(__file__).parent / "temp_scraper_output.json"
        with open(temp_file, "w") as f:
            json.dump(scraped_results, f, indent=2, default=str)
        
        print(f"\n✅ Scraper results written to: {temp_file}")
        print(f"   - UPS US: {len(scraped_results['ups_us']['price_ranges'])} price ranges, {len(scraped_results['ups_us']['history'])} history rows")
        print(f"   - FedEx US: {len(scraped_results['fedex_us']['price_ranges'])} price ranges, {len(scraped_results['fedex_us']['history'])} history rows")
        print(f"   - DHL DE: {len(scraped_results['dhl_de']['price_ranges'])} price ranges, {len(scraped_results['dhl_de']['history'])} history rows")
        print(f"   - UPS DE: {len(scraped_results['ups_de']['price_ranges'])} price ranges, {len(scraped_results['ups_de']['history'])} history rows")
        
        return scraped_results
        
    except Exception as e:
        print(f"\n❌ Scraper error: {e}")
        import traceback
        traceback.print_exc()
        return None
    finally:
        scraper._teardown()


def compare_data(scraped: Dict, db_data: Dict):
    """Compare scraped data with DB data"""
    print("\n" + "=" * 70)
    print("🔍 COMPARING SCRAPED vs DATABASE")
    print("=" * 70)
    
    # Compare price ranges
    print("\n[Price Ranges Comparison]")
    db_price_ranges = {f"{r['carrier']}_{r['market']}": r for r in db_data['price_ranges']}
    
    for key, scraped_group in scraped.items():
        if key == "timestamp":
            continue
        
        carrier_market = key.replace("_", " ").upper()
        print(f"\n  {carrier_market}:")
        
        scraped_ranges = scraped_group.get("price_ranges", [])
        print(f"    Scraped: {len(scraped_ranges)} price ranges")
        
        # Count DB ranges for this carrier/market
        db_count = sum(1 for r in db_data['price_ranges'] 
                      if r['carrier'].lower() in key.lower() 
                      and r['market'].lower() in key.lower())
        print(f"    Database: {db_count} price ranges")
        
        if scraped_ranges:
            print(f"    Sample scraped range: {scraped_ranges[0].get('at_least_usd', 'N/A')} - {scraped_ranges[0].get('but_less_than_usd', 'N/A')} @ {scraped_ranges[0].get('surcharge_pct', 'N/A')}%")
    
    # Compare history
    print("\n[History Comparison]")
    for key, scraped_group in scraped.items():
        if key == "timestamp":
            continue
        
        carrier_market = key.replace("_", " ").upper()
        print(f"\n  {carrier_market}:")
        
        scraped_history = scraped_group.get("history", [])
        print(f"    Scraped: {len(scraped_history)} history rows")
        
        # Count DB history for this carrier/market
        db_count = sum(1 for r in db_data['history'] 
                      if r['carrier'].lower() in key.lower() 
                      and r['market'].lower() in key.lower())
        print(f"    Database: {db_count} history rows")
        
        if scraped_history:
            latest = scraped_history[0] if scraped_history else {}
            print(f"    Latest scraped: {latest.get('effective_start', 'N/A')} = {latest.get('value_numeric', 'N/A')}%")
    
    print("\n" + "=" * 70)
    print("✅ Comparison complete. Check temp_scraper_output.json for full scraped data.")
    print("=" * 70)


async def main():
    """Main test function"""
    print("\n" + "=" * 70)
    print("🧪 SCRAPER TEST - OUTPUT TO FILE & COMPARE WITH DB")
    print("=" * 70)
    
    try:
        # Get DB data
        db_data = await get_db_data()
        
        # Run scraper (no DB writes)
        scraped_data = run_scraper_to_file()
        
        if scraped_data:
            # Compare
            compare_data(scraped_data, db_data)
        else:
            print("\n❌ Scraper failed - cannot compare")
            
    except Exception as e:
        print(f"\n❌ Test error: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(main())


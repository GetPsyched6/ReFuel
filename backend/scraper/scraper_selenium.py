"""
STEALTH Fuel Surcharge Scraper using Selenium
Direct Selenium approach with proper stealth configuration.
"""

import json
import time
from datetime import datetime
from typing import Dict, List

from selenium import webdriver
from selenium.webdriver.chrome.options import Options

from .markets.de import GermanyMarketScraper
from .markets.us import USMarketScraper


class StealthFuelScraper:
    """Scraper using Selenium with maximum stealth configuration."""
    
    def __init__(self):
        self.driver = None
        self.results: Dict[str, List[Dict]] = {
            "ups": [],
            "ups_history": [],
            "fedex": [],
            "fedex_history": [],
            "dhl": [],
        }
        self._market_scrapers = {}

    # ------------------------------------------------------------------ #
    # Driver lifecycle
    # ------------------------------------------------------------------ #
    def initialize_driver(self):
        """Initialize Chrome with stealth settings."""
        if self.driver:
            return

        print("Initializing stealth Chrome driver...")
        options = Options()
        options.add_argument("--disable-blink-features=AutomationControlled")
        options.add_argument(
            "--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        )
        options.add_argument("--no-sandbox")
        options.add_argument("--disable-dev-shm-usage")
        options.add_argument("--disable-web-security")
        options.add_argument("--disable-features=IsolateOrigins,site-per-process")
        options.add_argument("--window-size=1920,1080")
        options.add_argument("--start-maximized")
        options.add_argument("--headless=new")
        options.add_experimental_option("excludeSwitches", ["enable-automation"])
        options.add_experimental_option("useAutomationExtension", False)
        
        self.driver = webdriver.Chrome(options=options)
        self.driver.execute_cdp_cmd(
            "Network.setUserAgentOverride",
            {
                "userAgent": (
                    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                )
            },
        )
        self.driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
        self.driver.set_page_load_timeout(60)
        self.driver.implicitly_wait(10)
        print("Driver initialized successfully")
    
    def _ensure_market_scrapers(self):
        if not self._market_scrapers:
            self._market_scrapers = {
                "us": USMarketScraper(self.driver),
                "de": GermanyMarketScraper(self.driver),
            }

    def _teardown(self):
        if self.driver:
            print("\n🧹 Cleaning up...")
            self.driver.quit()
            self.driver = None
        self._market_scrapers = {}

    # ------------------------------------------------------------------ #
    # High-level orchestration
    # ------------------------------------------------------------------ #
    def scrape_all(self):
        """Scrape all carriers by delegating to market-specific scrapers."""
        print("\n" + "=" * 70)
        print("🔥 STEALTH FUEL SURCHARGE SCRAPER - Let's Beat Bot Detection!")
        print("=" * 70)

        try:
            self.initialize_driver()
            self._ensure_market_scrapers()

            us_scraper: USMarketScraper = self._market_scrapers["us"]
            de_scraper: GermanyMarketScraper = self._market_scrapers["de"]

            self.results["dhl"] = de_scraper.scrape_dhl()
            time.sleep(2)
            
            ups_de_data, ups_de_history = de_scraper.scrape_ups()
            if ups_de_data:
                self.results["ups"].extend(ups_de_data)
            if ups_de_history:
                self.results["ups_history"].extend(ups_de_history)
            time.sleep(2)
            
            ups_data, ups_history = us_scraper.scrape_ups()
            self.results["ups"].extend(ups_data)
            self.results["ups_history"].extend(ups_history)
            time.sleep(2)
            
            self.results["fedex"] = us_scraper.scrape_fedex()
            time.sleep(2)
            
            self.results["fedex_history"] = us_scraper.scrape_fedex_history()
            
        finally:
            self._teardown()

    # ------------------------------------------------------------------ #
    # Compatibility helper methods (used by tests and other call-sites)
    # ------------------------------------------------------------------ #
    def _us_parser(self) -> USMarketScraper:
        return USMarketScraper(self.driver)

    def _extract_ups_history(self, soup, scraped_at: str):
        return self._us_parser()._extract_ups_history(soup, scraped_at)

    def _find_fedex_history_table(self, soup):
        return self._us_parser()._find_fedex_history_table(soup)

    def _extract_fedex_history_rows(self, table, scraped_at: str):
        return self._us_parser()._extract_fedex_history_rows(table, scraped_at)

    # ------------------------------------------------------------------ #
    # Utilities
    # ------------------------------------------------------------------ #
    def export_to_csv(self):
        """Export scraped data to JSON files."""
        print("\n" + "=" * 70)
        print("💾 EXPORTING DATA TO JSON")
        print("=" * 70 + "\n")
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        total_rows = 0
        
        for carrier, data in self.results.items():
            if data:
                filename = f"fuel_surcharge_{carrier}_{timestamp}.json"
                with open(filename, "w") as file:
                    json.dump(data, file, indent=2)
                print(f"{carrier.upper():6s}: {filename:50s} ({len(data):3d} rows)")
                total_rows += len(data)
            else:
                print(f"{carrier.upper():6s}: No data scraped")
        
        all_data: List[Dict] = []
        for carrier_data in self.results.values():
            all_data.extend(carrier_data)
        
        if all_data:
            combined_filename = f"fuel_surcharge_combined_{timestamp}.json"
            with open(combined_filename, "w") as file:
                json.dump(all_data, file, indent=2)
            print(f"\nCOMBINED: {combined_filename:50s} ({total_rows:3d} rows)")
        
        print("\n" + "=" * 70)
        print("Scraping complete.")
        print("=" * 70)
        
        print("\nDetailed summary:")
        print("-" * 70)
        for carrier, data in self.results.items():
            status = "SUCCESS" if data else "FAILED"
            count = len(data) if data else 0
            print(f"  {carrier.upper():8s} | {status:12s} | {count:3d} rows")
        print("-" * 70)
        print(f"  TOTAL    |              | {total_rows:3d} rows")
        print("=" * 70)


def main():
    """Main execution function."""
    scraper = StealthFuelScraper()
    
    try:
        scraper.scrape_all()
        scraper.export_to_csv()
        
        total = sum(len(data) for data in scraper.results.values())
        if total > 0:
            print(f"\nSuccess: Scraped {total} total rows of real data.")
            print("📁 Check the CSV files in the current directory.")
        else:
            print("\n⚠️  No data was scraped. Check error screenshots for debugging.")
            
    except KeyboardInterrupt:
        print("\n\n⚠️  Scraping interrupted by user")
    except Exception as exc:
        print(f"\n\nFatal error: {exc}")
        import traceback

        traceback.print_exc()
    finally:
        print("\n👋 Done!")


if __name__ == "__main__":
    main()


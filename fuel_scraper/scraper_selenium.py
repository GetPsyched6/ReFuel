"""
STEALTH Fuel Surcharge Scraper using Selenium
Direct Selenium approach with proper stealth configuration.
"""

import time
import re
from typing import List, Dict
from datetime import datetime
import pandas as pd
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException
from bs4 import BeautifulSoup


class StealthFuelScraper:
    """Scraper using Selenium with maximum stealth configuration."""
    
    def __init__(self):
        self.driver = None
        self.results = {
            'ups': [],
            'fedex': [],
            'dhl': []
        }
    
    def initialize_driver(self):
        """Initialize Chrome with stealth settings."""
        print("🚀 Initializing stealth Chrome driver...")
        
        options = Options()
        
        # Stealth arguments
        options.add_argument('--disable-blink-features=AutomationControlled')
        options.add_argument('--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
        options.add_argument('--no-sandbox')
        options.add_argument('--disable-dev-shm-usage')
        options.add_argument('--disable-web-security')
        options.add_argument('--disable-features=IsolateOrigins,site-per-process')
        options.add_argument('--window-size=1920,1080')
        options.add_argument('--start-maximized')
        
        # Run in headless mode
        options.add_argument('--headless=new')
        
        # Exclude automation switches
        options.add_experimental_option("excludeSwitches", ["enable-automation"])
        options.add_experimental_option('useAutomationExtension', False)
        
        # Initialize driver
        self.driver = webdriver.Chrome(options=options)
        
        # Execute CDP commands to hide webdriver
        self.driver.execute_cdp_cmd('Network.setUserAgentOverride', {
            "userAgent": 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        })
        
        # Hide webdriver property
        self.driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
        
        # Set timeouts
        self.driver.set_page_load_timeout(60)
        self.driver.implicitly_wait(10)
        
        print("✅ Driver initialized successfully")
    
    def scrape_ups(self) -> List[Dict]:
        """Scrape UPS Ground Domestic fuel surcharge table."""
        print("\n🚀 Scraping UPS Ground Domestic...")
        
        try:
            # Navigate to UPS page
            print("   Loading page...")
            self.driver.get('https://www.ups.com/us/en/support/shipping-support/shipping-costs-rates/fuel-surcharges')
            
            # Wait for page to load
            time.sleep(6)
            
            # Scroll to trigger any lazy loading
            self.driver.execute_script("window.scrollTo(0, 600)")
            time.sleep(2)
            self.driver.execute_script("window.scrollTo(0, 1200)")
            time.sleep(2)
            
            # Wait for tables to be present
            print("   Looking for tables...")
            wait = WebDriverWait(self.driver, 20)
            wait.until(EC.presence_of_element_located((By.TAG_NAME, "table")))
            
            # Get page source and parse with BeautifulSoup
            soup = BeautifulSoup(self.driver.page_source, 'html.parser')
            tables = soup.find_all('table')
            
            print(f"   Found {len(tables)} tables on page")
            
            data = []
            for idx, table in enumerate(tables):
                table_text = table.get_text()
                
                # Look for the ground surcharge table
                if 'At Least' in table_text and 'But Less Than' in table_text and 'Surcharge' in table_text:
                    print(f"   ✓ Found fuel surcharge table (table #{idx+1})")
                    
                    rows = table.find_all('tr')
                    
                    for row in rows[1:]:  # Skip header
                        cells = row.find_all(['td', 'th'])
                        if len(cells) >= 3:
                            cell_texts = [cell.get_text().strip() for cell in cells]
                            
                            # Extract and clean data
                            at_least = cell_texts[0].replace('USD', '').replace('$', '').strip()
                            but_less_than = cell_texts[1].replace('USD', '').replace('$', '').strip()
                            surcharge = cell_texts[2].strip()
                            
                            # Validate data
                            if at_least and but_less_than and '%' in surcharge:
                                try:
                                    float(at_least)
                                    float(but_less_than)
                                    
                                    data.append({
                                        'carrier': 'UPS',
                                        'service': 'Ground Domestic',
                                        'at_least_usd': at_least,
                                        'but_less_than_usd': but_less_than,
                                        'surcharge': surcharge,
                                        'scraped_at': datetime.now().isoformat()
                                    })
                                except ValueError:
                                    continue
            
            if data:
                print(f"✅ UPS: Successfully scraped {len(data)} rows")
            else:
                print("⚠️  UPS: No data found - saving screenshot")
                self.driver.save_screenshot('ups_debug.png')
            
            return data
            
        except Exception as e:
            print(f"❌ UPS scraping failed: {str(e)}")
            try:
                self.driver.save_screenshot('ups_error.png')
            except:
                pass
            return []
    
    def scrape_fedex(self) -> List[Dict]:
        """Scrape FedEx Ground fuel surcharge table."""
        print("\n🚀 Scraping FedEx Ground...")
        
        try:
            # Navigate to FedEx page
            print("   Loading page...")
            self.driver.get('https://www.fedex.com/en-us/shipping/fuel-surcharge.html')
            
            # Handle cookie popup
            time.sleep(3)
            try:
                accept_button = self.driver.find_element(By.XPATH, "//button[contains(text(), 'ACCEPT ALL COOKIES')]")
                accept_button.click()
                print("   Accepted cookies")
                time.sleep(2)
            except:
                print("   No cookie popup (or already accepted)")
            
            # Wait for page to fully load
            time.sleep(5)
            
            # Scroll to find accordion
            print("   Scrolling to find Ground surcharge table...")
            self.driver.execute_script("window.scrollTo(0, 1000)")
            time.sleep(2)
            
            # Click accordion to expand Ground table
            try:
                print("   Expanding FedEx Ground accordion...")
                accordion = wait = WebDriverWait(self.driver, 10)
                accordion_button = accordion.until(
                    EC.element_to_be_clickable((By.XPATH, "//button[contains(@data-title, 'FedEx Ground')]"))
                )
                accordion_button.click()
                print("   ✓ Accordion expanded")
                time.sleep(3)
            except Exception as e:
                print(f"   Could not click accordion: {str(e)[:50]}")
            
            # Scroll more to ensure table loads
            self.driver.execute_script("window.scrollTo(0, 1500)")
            time.sleep(2)
            
            # Get page source
            soup = BeautifulSoup(self.driver.page_source, 'html.parser')
            tables = soup.find_all('table')
            
            print(f"   Found {len(tables)} tables on page")
            
            data = []
            
            # Try all tables - FedEx uses different structures
            for idx, table in enumerate(tables):
                table_text = table.get_text()
                rows = table.find_all('tr')
                
                # Look for "At least" pattern (FedEx Ground table)
                if 'At least' in table_text or 'At Least' in table_text:
                    print(f"   ✓ Found FedEx Ground table (table #{idx+1})")
                    
                    for row in rows:
                        cells = row.find_all(['td', 'th'])
                        if len(cells) >= 2:
                            cell_texts = [cell.get_text().strip() for cell in cells]
                            
                            # Skip header row
                            if 'At least' in cell_texts[0] or 'At Least' in cell_texts[0]:
                                continue
                            
                            # Extract from 2 or 3 column format
                            if len(cell_texts) >= 2:
                                col1 = cell_texts[0]
                                col2 = cell_texts[1]
                                col3 = cell_texts[2] if len(cell_texts) > 2 else ""
                                
                                # Try extracting prices from first column (range format)
                                prices = re.findall(r'\$?(\d+\.\d+)', col1)
                                
                                if len(prices) >= 2:
                                    # Range in column 1, surcharge in column 2
                                    if '%' in col2:
                                        data.append({
                                            'carrier': 'FedEx',
                                            'service': 'Ground',
                                            'at_least_usd': prices[0],
                                            'but_less_than_usd': prices[1],
                                            'surcharge': col2.strip(),
                                            'scraped_at': datetime.now().isoformat()
                                        })
                                elif len(prices) == 1:
                                    # Separate columns: col1=min, col2=max, col3=surcharge
                                    prices2 = re.findall(r'\$?(\d+\.\d+)', col2)
                                    if prices2 and '%' in col3:
                                        data.append({
                                            'carrier': 'FedEx',
                                            'service': 'Ground',
                                            'at_least_usd': prices[0],
                                            'but_less_than_usd': prices2[0],
                                            'surcharge': col3.strip(),
                                            'scraped_at': datetime.now().isoformat()
                                        })
            
            if data:
                print(f"✅ FedEx: Successfully scraped {len(data)} rows")
            else:
                print("⚠️  FedEx: No data found - saving debug info")
                self.driver.save_screenshot('fedex_debug.png')
                
                # Save page source for debugging
                with open('fedex_page_source.html', 'w', encoding='utf-8') as f:
                    f.write(self.driver.page_source)
                print("   Saved: fedex_page_source.html")
                
                # Print table previews
                for idx, table in enumerate(tables[:3]):  # First 3 tables
                    preview = str(table)[:200].replace('\n', ' ')
                    print(f"   Table {idx+1} preview: {preview}...")
            
            return data
            
        except Exception as e:
            print(f"❌ FedEx scraping failed: {str(e)}")
            try:
                self.driver.save_screenshot('fedex_error.png')
            except:
                pass
            return []
    
    def scrape_dhl(self) -> List[Dict]:
        """Scrape DHL Express Road fuel surcharge table."""
        print("\n🚀 Scraping DHL Express Road...")
        
        try:
            # Navigate to DHL page
            print("   Loading page...")
            self.driver.get('https://www.dhl.de/en/geschaeftskunden/express/produkte-und-services/zuschlaege/treibstoffzuschlag-road.html')
            
            # Wait for page to load
            time.sleep(5)
            
            # Scroll
            self.driver.execute_script("window.scrollTo(0, 1000)")
            time.sleep(2)
            
            # Wait for tables
            print("   Looking for tables...")
            wait = WebDriverWait(self.driver, 20)
            wait.until(EC.presence_of_element_located((By.TAG_NAME, "table")))
            
            # Get page source
            soup = BeautifulSoup(self.driver.page_source, 'html.parser')
            tables = soup.find_all('table')
            
            print(f"   Found {len(tables)} tables on page")
            
            data = []
            for idx, table in enumerate(tables):
                table_text = table.get_text()
                
                if ('FUEL SURCHARGE' in table_text or 'Fuel Surcharge' in table_text) or \
                   ('Minimum' in table_text and 'Surcharge' in table_text):
                    
                    print(f"   ✓ Found fuel surcharge table (table #{idx+1})")
                    
                    rows = table.find_all('tr')
                    
                    for row in rows[1:]:  # Skip header
                        cells = row.find_all(['td', 'th'])
                        if len(cells) >= 3:
                            cell_texts = [cell.get_text().strip() for cell in cells]
                            
                            at_least = cell_texts[0].replace('USD', '').replace('$', '').strip()
                            but_less_than = cell_texts[1].replace('USD', '').replace('$', '').strip()
                            surcharge = cell_texts[2].strip()
                            
                            if at_least and but_less_than and '%' in surcharge:
                                try:
                                    float(at_least)
                                    float(but_less_than)
                                    
                                    data.append({
                                        'carrier': 'DHL',
                                        'service': 'Express Road',
                                        'at_least_usd': at_least,
                                        'but_less_than_usd': but_less_than,
                                        'surcharge': surcharge,
                                        'scraped_at': datetime.now().isoformat()
                                    })
                                except ValueError:
                                    continue
            
            if data:
                print(f"✅ DHL: Successfully scraped {len(data)} rows")
            
            return data
            
        except Exception as e:
            print(f"❌ DHL scraping failed: {str(e)}")
            return []
    
    def scrape_all(self):
        """Scrape all carriers."""
        print("\n" + "="*70)
        print("🔥 STEALTH FUEL SURCHARGE SCRAPER - Let's Beat Bot Detection!")
        print("="*70)
        
        try:
            self.initialize_driver()
            time.sleep(2)
            
            # Scrape each carrier
            self.results['dhl'] = self.scrape_dhl()
            time.sleep(4)
            
            self.results['ups'] = self.scrape_ups()
            time.sleep(4)
            
            self.results['fedex'] = self.scrape_fedex()
            
        finally:
            if self.driver:
                print("\n🧹 Cleaning up...")
                self.driver.quit()
    
    def export_to_csv(self):
        """Export scraped data to CSV files."""
        print("\n" + "="*70)
        print("💾 EXPORTING DATA TO CSV")
        print("="*70 + "\n")
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        total_rows = 0
        
        # Export individual carrier files
        for carrier, data in self.results.items():
            if data:
                filename = f"fuel_surcharge_{carrier}_{timestamp}.csv"
                df = pd.DataFrame(data)
                df.to_csv(filename, index=False)
                print(f"✅ {carrier.upper():6s}: {filename:50s} ({len(data):3d} rows)")
                total_rows += len(data)
            else:
                print(f"❌ {carrier.upper():6s}: No data scraped")
        
        # Export combined file
        all_data = []
        for carrier_data in self.results.values():
            all_data.extend(carrier_data)
        
        if all_data:
            combined_filename = f"fuel_surcharge_combined_{timestamp}.csv"
            df = pd.DataFrame(all_data)
            df.to_csv(combined_filename, index=False)
            print(f"\n✅ COMBINED: {combined_filename:50s} ({total_rows:3d} rows)")
        
        print("\n" + "="*70)
        print("✨ SCRAPING COMPLETE!")
        print("="*70)
        
        # Print detailed summary
        print("\n📊 DETAILED SUMMARY:")
        print("-" * 70)
        for carrier, data in self.results.items():
            status = "✅ SUCCESS" if data else "❌ FAILED"
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
        
        # Check success
        total = sum(len(data) for data in scraper.results.values())
        if total > 0:
            print(f"\n🎉 SUCCESS! Scraped {total} total rows of real data!")
            print("📁 Check the CSV files in the current directory.")
        else:
            print("\n⚠️  No data was scraped. Check error screenshots for debugging.")
            
    except KeyboardInterrupt:
        print("\n\n⚠️  Scraping interrupted by user")
    except Exception as e:
        print(f"\n\n❌ Fatal error: {str(e)}")
        import traceback
        traceback.print_exc()
    finally:
        print("\n👋 Done!")


if __name__ == "__main__":
    main()


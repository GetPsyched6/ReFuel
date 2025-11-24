from __future__ import annotations

import re
import time
from datetime import datetime
from typing import Dict, List, Optional, Tuple

from bs4 import BeautifulSoup
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

from ..core.base import BaseMarketScraper, _normalize_service_key


class USMarketScraper(BaseMarketScraper):
    """Scraping routines for US-based carriers (UPS, FedEx)."""

    UPS_URL = "https://www.ups.com/us/en/support/shipping-support/shipping-costs-rates/fuel-surcharges"
    FEDEX_GROUND_URL = "https://www.fedex.com/en-us/shipping/fuel-surcharge.html"
    FEDEX_HISTORY_URL = "https://www.fedex.com/en-us/shipping/historical-fuel-surcharge.html#previous-fedex-fuel-surcharge-rates"
    FEDEX_HISTORY_META = {
        _normalize_service_key(
            "FedEx Ground, FedEx Home Delivery, and FedEx International Ground Services, and pickup services"
        ): {
            "service": "FedEx Ground, FedEx Home Delivery, and FedEx International Ground Services",
            "category": "ground_domestic",
        },
        _normalize_service_key("Domestic and U.S. to Puerto Rico - package services"): {
            "service": "Domestic & Puerto Rico Package Services",
            "category": "domestic_air",
        },
        _normalize_service_key("Domestic and U.S. to Puerto Rico – package services"): {
            "service": "Domestic & Puerto Rico Package Services",
            "category": "domestic_air",
        },
        _normalize_service_key("Domestic and U.S. to Puerto Rico - express freight services"): {
            "service": "Domestic & Puerto Rico Express Freight Services",
            "category": "domestic_air_freight",
        },
        _normalize_service_key("Domestic and U.S. to Puerto Rico – express freight services"): {
            "service": "Domestic & Puerto Rico Express Freight Services",
            "category": "domestic_air_freight",
        },
        _normalize_service_key("Export"): {
            "service": "Export",
            "category": "international_air_export",
        },
        _normalize_service_key("Import"): {
            "service": "Import",
            "category": "international_air_import",
        },
    }

    def scrape_ups(self) -> Tuple[List[Dict], List[Dict]]:
        """Scrape UPS current surcharge and history tables."""
        print("\nScraping UPS Ground Domestic...")
        data: List[Dict] = []
        history_rows: List[Dict] = []

        try:
            self.driver.get(self.UPS_URL)
            time.sleep(6)
            self.scroll_to(600)
            self.scroll_to(1200)
            self.wait_for_tables()

            soup = BeautifulSoup(self.driver.page_source, "html.parser")
            tables = soup.find_all("table")
            print(f"   Found {len(tables)} tables on page")

            history_rows = self._extract_ups_history(soup, datetime.now().isoformat())
            if history_rows:
                print(f"   ✓ Captured {len(history_rows)} UPS 90-day history rows")
            else:
                raise RuntimeError("UPS 90-day history table not found on page")

            table_found = False
            for idx, table in enumerate(tables):
                if table_found:
                    break
                table_text = table.get_text()

                if (
                    "At Least" in table_text
                    and "But Less Than" in table_text
                    and "Surcharge" in table_text
                ):
                    prev_element = table.find_previous(["h1", "h2", "h3", "h4", "p", "div"])
                    prev_text = prev_element.get_text().lower() if prev_element else ""
                    if any(token in prev_text for token in ("history", "historical", "archive")):
                        print(f"   ⏭️  Skipping historical table #{idx+1}")
                        continue

                    print(f"   ✓ Found current fuel surcharge table (table #{idx+1})")
                    rows = table.find_all("tr")
                    rows_added = 0
                    for row in rows[1:]:
                        cells = row.find_all(["td", "th"])
                        if len(cells) < 3:
                            continue
                        cell_texts = [cell.get_text().strip() for cell in cells]
                        at_least = cell_texts[0].replace("USD", "").replace("$", "").strip()
                        but_less_than = cell_texts[1].replace("USD", "").replace("$", "").strip()
                        surcharge = cell_texts[2].strip()
                        if at_least and but_less_than and "%" in surcharge:
                            try:
                                float(at_least)
                                float(but_less_than)
                                data.append(
                                    {
                                        "carrier": "UPS",
                                        "service": "Ground Domestic",
                                        "market": "US",
                                        "currency": "USD",
                                        "fuel_type": "Ground Domestic",
                                        "fuel_category": self.category_for("Ground Domestic"),
                                        "at_least_usd": at_least,
                                        "but_less_than_usd": but_less_than,
                                        "surcharge": surcharge,
                                        "scraped_at": datetime.now().isoformat(),
                                    }
                                )
                                rows_added += 1
                            except ValueError:
                                continue
                    if rows_added > 0:
                        table_found = True
                        print(f"   Extracted {rows_added} rows from this table")

            if not data:
                print("⚠️  UPS: No data found - saving screenshot")
                self.driver.save_screenshot("ups_debug.png")

        except Exception as exc:
            print(f"UPS scraping failed: {exc}")
            try:
                self.driver.save_screenshot("ups_error.png")
            except Exception:
                pass

        return data, history_rows

    def scrape_fedex(self) -> List[Dict]:
        """Scrape FedEx Ground surcharge table."""
        print("\nScraping FedEx Ground...")
        data: List[Dict] = []

        try:
            self.driver.get(self.FEDEX_GROUND_URL)
            self.accept_fedex_cookies()
            time.sleep(5)

            self.scroll_to(1000)
            try:
                print("   Expanding FedEx Ground accordion...")
                accordion = WebDriverWait(self.driver, 10).until(
                    EC.element_to_be_clickable((By.XPATH, "//button[contains(@data-title, 'FedEx Ground')]"))
                )
                accordion.click()
                time.sleep(3)
            except Exception as exc:
                print(f"   Could not click accordion: {str(exc)[:50]}")

            self.scroll_to(1500)
            soup = BeautifulSoup(self.driver.page_source, "html.parser")
            tables = soup.find_all("table")
            print(f"   Found {len(tables)} tables on page")

            table_found = False
            for idx, table in enumerate(tables):
                if table_found:
                    break
                table_text = table.get_text()
                rows = table.find_all("tr")
                if "At least" in table_text or "At Least" in table_text:
                    print(f"   ✓ Found FedEx Ground table (table #{idx+1})")
                    rows_added = 0
                    for row in rows:
                        cells = row.find_all(["td", "th"])
                        if len(cells) < 2:
                            continue
                        cell_texts = [cell.get_text().strip() for cell in cells]
                        if "At least" in cell_texts[0] or "At Least" in cell_texts[0]:
                            continue
                        col1 = cell_texts[0]
                        col2 = cell_texts[1]
                        col3 = cell_texts[2] if len(cell_texts) > 2 else ""
                        prices = re.findall(r"\$?(\d+\.\d+)", col1)
                        if len(prices) >= 2 and "%" in col2:
                            data.append(
                                {
                                    "carrier": "FedEx",
                                    "service": "Ground",
                                    "market": "US",
                                    "currency": "USD",
                                    "fuel_type": "Ground",
                                    "fuel_category": self.category_for("Ground"),
                                    "at_least_usd": prices[0],
                                    "but_less_than_usd": prices[1],
                                    "surcharge": col2.strip(),
                                    "scraped_at": datetime.now().isoformat(),
                                }
                            )
                            rows_added += 1
                        elif len(prices) == 1:
                            prices2 = re.findall(r"\$?(\d+\.\d+)", col2)
                            if prices2 and "%" in col3:
                                data.append(
                                    {
                                        "carrier": "FedEx",
                                        "service": "Ground",
                                        "market": "US",
                                        "currency": "USD",
                                        "fuel_type": "Ground",
                                        "fuel_category": self.category_for("Ground"),
                                        "at_least_usd": prices[0],
                                        "but_less_than_usd": prices2[0],
                                        "surcharge": col3.strip(),
                                        "scraped_at": datetime.now().isoformat(),
                                    }
                                )
                                rows_added += 1
                    if rows_added > 0:
                        table_found = True
                        print(f"   Extracted {rows_added} rows from this table")

            if not data:
                print("⚠️  FedEx: No data found - saving debug info")
                self.driver.save_screenshot("fedex_debug.png")
                with open("fedex_page_source.html", "w", encoding="utf-8") as file:
                    file.write(self.driver.page_source)

        except Exception as exc:
            print(f"FedEx scraping failed: {exc}")
            try:
                self.driver.save_screenshot("fedex_error.png")
            except Exception:
                pass

        return data

    def scrape_fedex_history(self) -> List[Dict]:
        """Scrape FedEx historical surcharge table."""
        print("\nScraping FedEx historical surcharge table...")
        data: List[Dict] = []

        try:
            self.driver.get(self.FEDEX_HISTORY_URL)
            self.accept_fedex_cookies()
            time.sleep(4)
            # ensure entire table loads by scrolling to the bottom
            try:
                last_height = 0
                while True:
                    current_height = self.driver.execute_script("return document.body.scrollHeight")
                    if current_height == last_height:
                        break
                    self.driver.execute_script("window.scrollTo(0, arguments[0]);", current_height)
                    last_height = current_height
                    time.sleep(1.5)
            except Exception as scroll_exc:
                print(f"   ⚠️  Unable to fully scroll FedEx history page: {scroll_exc}")

            wait = WebDriverWait(self.driver, 20)
            try:
                accordion_button = wait.until(
                    EC.element_to_be_clickable(
                        (By.CSS_SELECTOR, "button[aria-controls='previous-fedex-fuel-surcharge-rates']")
                    )
                )
                self.driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", accordion_button)
                time.sleep(1)
                if accordion_button.get_attribute("aria-expanded") != "true":
                    accordion_button.click()
                    print("   ✓ History accordion expanded")
                    time.sleep(2)
            except Exception as exc:
                print(f"   ⚠️  Could not expand history accordion: {str(exc)[:60]}")

            def table_has_rows(driver):
                rows = driver.find_elements(By.CSS_SELECTOR, "#previous-fedex-fuel-surcharge-rates table tr")
                return len(rows) > 1

            wait.until(table_has_rows)
            soup = BeautifulSoup(self.driver.page_source, "html.parser")
            history_table = self._find_fedex_history_table(soup)
            if not history_table:
                print("   ⚠️  FedEx history table not found")
                return data

            data = self._extract_fedex_history_rows(history_table, datetime.now().isoformat())
            print(f"   ✓ Captured {len(data)} FedEx historical rows")

        except Exception as exc:
            print(f"FedEx historical scraping failed: {exc}")

        return data

    # ----- Helpers --------------------------------------------------------
    def _extract_ups_history(self, soup: BeautifulSoup, scraped_at: str) -> List[Dict]:
        tables = soup.find_all("table")
        dataset: List[Dict] = []

        for table in tables:
            rows = table.find_all("tr")
            if len(rows) <= 1:
                continue

            header_cells_raw = rows[0].find_all(["td", "th"])
            header_cells = [col.get_text(strip=True) for col in header_cells_raw]
            header_lower = [text.lower() for text in header_cells]

            if not any("effective" in text for text in header_lower):
                continue

            service_cols = [
                (idx, header_cells[idx])
                for idx, text in enumerate(header_lower)
                if idx != 0 and ("surcharge" in text or "%" in text)
            ]
            if not service_cols:
                continue

            for row in rows[1:]:
                cells = row.find_all(["td", "th"])
                if len(cells) <= 1:
                    continue

                date_text = cells[0].get_text(strip=True)
                if not date_text:
                    continue

                date_parts = [part.strip() for part in date_text.replace("–", "-").replace("\n", " ").split("-")]
                start = self._parse_history_date(date_parts[0], default_year=datetime.now().year)
                end = (
                    self._parse_history_date(date_parts[1], default_year=datetime.now().year)
                    if len(date_parts) > 1
                    else None
                )

                for col_idx, service in service_cols:
                    if len(cells) <= col_idx:
                        continue
                    value_text = cells[col_idx].get_text(strip=True)
                    if not value_text:
                        continue
                    numeric = re.search(r"(\d+(\.\d+)?)%", value_text)
                    dataset.append(
                        {
                            "carrier": "UPS",
                            "service": service,
                            "market": "US",
                            "currency": "USD",
                            "fuel_type": service,
                            "fuel_category": self.category_for(service),
                            "effective_start": start.isoformat() if start else None,
                            "effective_end": end.isoformat() if end else None,
                            "value_text": value_text,
                            "value_numeric": float(numeric.group(1)) if numeric else None,
                            "value_unit": "percent" if numeric else "text",
                            "scraped_at": scraped_at,
                        }
                    )

            if dataset:
                break

        return [row for row in dataset if row["effective_start"]]

    def _parse_history_date(self, value: str, default_year: Optional[int] = None) -> Optional[datetime]:
        cleaned = value.replace("–", "-").replace("—", "-").replace("  ", " ").replace(".", "").strip()
        cleaned = cleaned.replace("Sept ", "Sep ")
        if not cleaned:
            return None
        formats = ["%b %d, %Y", "%b %d %Y", "%B %d, %Y", "%B %d %Y", "%m/%d/%Y", "%m/%d/%y"]
        for fmt in formats:
            try:
                return datetime.strptime(cleaned, fmt)
            except ValueError:
                continue
        if default_year:
            for fmt in ("%b %d %Y", "%B %d %Y"):
                try:
                    return datetime.strptime(f"{cleaned} {default_year}", fmt)
                except ValueError:
                    continue
        return None

    def _find_fedex_history_table(self, soup: BeautifulSoup):
        return soup.select_one("#previous-fedex-fuel-surcharge-rates table") or soup.find("table")

    def _extract_fedex_history_rows(self, table, scraped_at: str) -> List[Dict]:
        rows = table.find_all("tr")
        if not rows:
            return []

        header_rows = []
        data_start_idx = 0
        if rows:
            first_cells = [cell.get_text(strip=True) for cell in rows[0].find_all(["td", "th"])]
            header_rows.append(first_cells)
            data_start_idx = 1
            if len(rows) > 1:
                second_cells = [cell.get_text(strip=True) for cell in rows[1].find_all(["td", "th"])]
                second_text = " ".join(second_cells).lower()
                if any(keyword in second_text for keyword in ["domestic", "export", "import"]):
                    header_rows.append(second_cells)
                    data_start_idx = 2

        if not header_rows or len(header_rows[0]) < 2:
            return []

        if len(header_rows) > 1:
            services = [header_rows[0][1]] + header_rows[1]
        else:
            services = header_rows[0][1:]
        dataset: List[Dict] = []
        column_meta = {idx + 1: self._fedex_column_meta(header) for idx, header in enumerate(services)}
        for row in rows[data_start_idx:]:
            cells = row.find_all(["td", "th"])
            if len(cells) < len(services) + 1:
                continue
            date_raw = cells[0].get_text(strip=True)
            if not date_raw:
                continue
            normalized_date = date_raw.replace("–", "-").replace("—", "-")
            date_range = [part.strip() for part in normalized_date.replace("\n", " ").split("-")]
            start = self._parse_history_date(date_range[0])
            end = self._parse_history_date(date_range[1]) if len(date_range) > 1 else None
            for idx, service in enumerate(services, start=1):
                value_text = cells[idx].get_text(strip=True)
                if not value_text:
                    continue
                value_unit, value_numeric = self._parse_value_cell(value_text)
                meta = column_meta.get(idx, self._fedex_column_meta(service))
                dataset.append(
                    {
                        "carrier": "FedEx",
                        "service": meta["service"],
                        "market": "US",
                        "currency": "USD",
                        "fuel_type": meta["service"],
                        "fuel_category": meta["category"],
                        "effective_start": start.isoformat() if start else None,
                        "effective_end": end.isoformat() if end else None,
                        "value_text": value_text,
                        "value_numeric": value_numeric,
                        "value_unit": value_unit,
                        "scraped_at": scraped_at,
                    }
                )
        return [row for row in dataset if row["effective_start"]]

    def _fedex_column_meta(self, header: str) -> Dict[str, str]:
        key = _normalize_service_key(header)
        meta = self.FEDEX_HISTORY_META.get(key)
        if meta:
            return meta
        return {
            "service": header.strip(),
            "category": self.category_for(header),
        }

    def _parse_value_cell(self, text: str) -> Tuple[str, Optional[float]]:
        text = text.strip()
        percent_match = re.search(r"(\d+(\.\d+)?)%", text)
        if percent_match:
            return "percent", float(percent_match.group(1))
        per_lb_match = re.search(r"\$?(\d+(\.\d+)?).*per\s*lb", text.lower())
        if per_lb_match:
            value = float(per_lb_match.group(1))
            return "per_lb", value
        currency_match = re.search(r"\$?(\d+(\.\d+)?)", text)
        if currency_match:
            return "currency", float(currency_match.group(1))
        return "text", None


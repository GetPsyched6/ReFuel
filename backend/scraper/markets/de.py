from __future__ import annotations

import time
from datetime import datetime
from typing import Dict, List, Optional

from bs4 import BeautifulSoup
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.common.by import By

from ..core.base import BaseMarketScraper
from ..core.utils import (
    convert_eur_1000l_to_l,
    usd_per_gallon_to_eur_per_liter,
)


class GermanyMarketScraper(BaseMarketScraper):
    """Scraping routines for German carriers (currently DHL)."""

    DHL_URL = "https://www.dhl.de/en/geschaeftskunden/express/produkte-und-services/zuschlaege/treibstoffzuschlag-road.html"
    UPS_URL = "https://www.ups.com/de/en/support/shipping-support/shipping-costs-rates/fuel-surcharges"

    def scrape_dhl(self) -> List[Dict]:
        print("\nScraping DHL Express Road...")
        data: List[Dict] = []

        try:
            self.driver.get(self.DHL_URL)
            time.sleep(5)
            self.scroll_to(1000)

            print("   Looking for tables...")
            WebDriverWait(self.driver, 20).until(EC.presence_of_element_located((By.TAG_NAME, "table")))

            soup = BeautifulSoup(self.driver.page_source, "html.parser")
            tables = soup.find_all("table")
            print(f"   Found {len(tables)} tables on page")

            for idx, table in enumerate(tables):
                table_text = table.get_text()
                if ("FUEL SURCHARGE" in table_text or "Fuel Surcharge" in table_text) or (
                    "Minimum" in table_text and "Surcharge" in table_text
                ):
                    print(f"   ✓ Found fuel surcharge table (table #{idx+1})")
                    rows = table.find_all("tr")
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
                                at_least_float = float(at_least)
                                but_less_than_float = float(but_less_than)
                                converted_min = usd_per_gallon_to_eur_per_liter(at_least_float)
                                converted_max = usd_per_gallon_to_eur_per_liter(but_less_than_float)
                                data.append(
                                    {
                                        "carrier": "DHL",
                                        "service": "Express Road (Germany)",
                                        "market": "DE",
                                        "currency": "EUR",
                                        "fuel_type": "Road",
                                        "fuel_category": self.category_for("Express Road (Germany)"),
                                        "at_least_usd": converted_min,
                                        "but_less_than_usd": converted_max,
                                        "surcharge": surcharge,
                                        "scraped_at": datetime.now().isoformat(),
                                    }
                                )
                            except ValueError:
                                continue
            if data:
                print(f"DHL: Successfully scraped {len(data)} rows")

        except Exception as exc:
            print(f"DHL scraping failed: {exc}")

        return data

    def scrape_ups(self) -> tuple[List[Dict], List[Dict]]:
        print("\nScraping UPS Germany...")
        data: List[Dict] = []
        history: List[Dict] = []

        try:
            self.driver.get(self.UPS_URL)
            time.sleep(5)
            self.accept_button_by_xpath(
                "//button[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'accept')]"
            )
            self.wait_for_tables()

            soup = BeautifulSoup(self.driver.page_source, "html.parser")

            standard_rows = self._parse_ups_standard_table(soup)
            express_rows = self._parse_ups_express_table(soup)
            history_rows = self._parse_ups_history_table(soup)

            data.extend(standard_rows)
            data.extend(express_rows)
            history.extend(history_rows)

            print(
                f"UPS Germany: scraped {len(standard_rows)} standard rows,"
                f" {len(express_rows)} express rows, {len(history_rows)} history rows"
            )
        except Exception as exc:
            print(f"UPS Germany scraping failed: {exc}")

        return data, history

    # ----------------------------- UPS parsers -----------------------------
    def _parse_number(self, text: str) -> Optional[float]:
        if not text:
            return None
        normalized = (
            text.replace("\xa0", "")
            .replace("USD", "")
            .replace("EUR", "")
            .replace("$", "")
            .replace("€", "")
            .replace("%", "")
            .replace("*", "")
            .strip()
        )
        if not normalized:
            return None

        import re

        cleaned = re.sub(r"[^0-9,.\-]", "", normalized)
        if not cleaned:
            return None

        if "," in cleaned and "." in cleaned:
            cleaned = cleaned.replace(",", "")
        elif "," in cleaned:
            integer_part, decimal_part = cleaned.rsplit(",", 1)
            if len(decimal_part) <= 2:
                cleaned = f"{integer_part}.{decimal_part}"
            else:
                cleaned = cleaned.replace(",", "")

        try:
            return float(cleaned)
        except ValueError:
            return None

    def _parse_ups_standard_table(self, soup: BeautifulSoup) -> List[Dict]:
        scraped_at = datetime.now().isoformat()
        for table in soup.find_all("table"):
            caption = self._get_table_caption(table)
            if not caption or "diesel fuel price" not in caption:
                continue

            entries: List[Dict] = []
            for row in table.find_all("tr")[1:]:
                cells = row.find_all(["td", "th"])
                if len(cells) < 3:
                    continue
                min_value = self._parse_number(cells[0].get_text())
                max_value = self._parse_number(cells[1].get_text())
                surcharge = cells[2].get_text(strip=True)
                if min_value is None or max_value is None or not surcharge:
                    continue
                entries.append(
                    {
                        "carrier": "UPS",
                        "service": "Standard Service (Germany)",
                        "market": "DE",
                        "currency": "EUR",
                        "fuel_type": "Diesel Fuel Price",
                        "fuel_category": "ground_domestic",
                        "at_least_usd": convert_eur_1000l_to_l(min_value),
                        "but_less_than_usd": convert_eur_1000l_to_l(max_value),
                        "surcharge": surcharge,
                        "scraped_at": scraped_at,
                    }
                )
            if entries:
                return entries
        return []

    def _parse_ups_express_table(self, soup: BeautifulSoup) -> List[Dict]:
        scraped_at = datetime.now().isoformat()
        for table in soup.find_all("table"):
            caption = self._get_table_caption(table)
            header_cells = table.find_all("th")
            headers = [cell.get_text(strip=True) for cell in header_cells]
            header_blob = " ".join(headers)
            if caption:
                if "express services" not in caption and "jet fuel" not in caption:
                    continue
            elif "Shipments within the EU" not in header_blob:
                continue

            entries: List[Dict] = []
            for row in table.find_all("tr")[1:]:
                cells = row.find_all(["td", "th"])
                if len(cells) < 4:
                    continue
                min_value = self._parse_number(cells[0].get_text())
                max_value = self._parse_number(cells[1].get_text())
                eu_value = cells[2].get_text(strip=True)
                non_eu_value = cells[3].get_text(strip=True)
                if min_value is None or max_value is None:
                    continue

                base_record = {
                    "carrier": "UPS",
                    "market": "DE",
                    "currency": "USD",
                    "fuel_type": "USGC Jet Fuel Price (USD/Gallon)",
                    "at_least_usd": min_value,
                    "but_less_than_usd": max_value,
                    "scraped_at": scraped_at,
                }

                if eu_value:
                    entries.append(
                        {
                            **base_record,
                            "service": "Shipments within the EU",
                            "fuel_category": "domestic_air",
                            "surcharge": eu_value,
                        }
                    )

                if non_eu_value:
                    entries.extend(
                        [
                            {
                                **base_record,
                                "service": "Shipments outside the EU (Export)",
                                "fuel_category": "international_air_export",
                                "surcharge": non_eu_value,
                            },
                            {
                                **base_record,
                                "service": "Shipments outside the EU (Import)",
                                "fuel_category": "international_air_import",
                                "surcharge": non_eu_value,
                            },
                        ]
                    )

            return entries
        return []

    def _parse_date(self, value: str) -> Optional[datetime]:
        value = value.replace("\xa0", " ").strip()
        for fmt in ("%d %B %Y", "%B %d, %Y", "%d/%m/%Y"):
            try:
                return datetime.strptime(value, fmt)
            except ValueError:
                continue
        return None

    def _parse_ups_history_table(self, soup: BeautifulSoup) -> List[Dict]:
        scraped_at = datetime.now().isoformat()
        for table in soup.find_all("table"):
            caption = self._get_table_caption(table)
            if not caption or "90-day" not in caption:
                continue

            rows = table.find_all("tr")
            if not rows or len(rows[0].find_all("th")) < 4:
                continue

            history_entries: List[Dict] = []
            for row in rows[1:]:
                cells = row.find_all("td")
                if len(cells) < 4:
                    continue

                date_value = self._parse_date(cells[0].get_text())
                if not date_value:
                    continue

                standard = cells[1].get_text(strip=True)
                eu_value = cells[2].get_text(strip=True)
                non_eu_value = cells[3].get_text(strip=True)

                history_entries.extend(
                    self._build_history_records(
                        date_value=date_value,
                        standard=standard,
                        eu_value=eu_value,
                        non_eu_value=non_eu_value,
                        scraped_at=scraped_at,
                    )
                )

            if history_entries:
                return history_entries

        return []

    def _build_history_records(
        self,
        date_value: datetime,
        standard: str,
        eu_value: str,
        non_eu_value: str,
        scraped_at: str,
    ) -> List[Dict]:
        entries: List[Dict] = []

        def history_entry(service: str, category: str, value_text: str, currency: str):
            numeric = self._parse_number(value_text) if value_text else None
            if not value_text:
                return None
            return {
                "carrier": "UPS",
                "service": service,
                "market": "DE",
                "currency": currency,
                "fuel_type": "Fuel Surcharge",
                "fuel_category": category,
                "effective_start": date_value.isoformat(),
                "effective_end": None,
                "value_text": value_text,
                "value_numeric": numeric,
                "value_unit": "percent",
                "scraped_at": scraped_at,
            }

        if standard:
            record = history_entry(
                "Standard Service (Germany)",
                "ground_domestic",
                standard,
                "EUR",
            )
            if record:
                entries.append(record)

        if eu_value:
            record = history_entry(
                "Shipments within the EU",
                "domestic_air",
                eu_value,
                "USD",
            )
            if record:
                entries.append(record)

        if non_eu_value:
            for service, category in [
                ("Shipments outside the EU (Export)", "international_air_export"),
                ("Shipments outside the EU (Import)", "international_air_import"),
            ]:
                record = history_entry(service, category, non_eu_value, "USD")
                if record:
                    entries.append(record)

        return entries

    def _get_table_caption(self, table: BeautifulSoup) -> Optional[str]:
        if not table:
            return None
        parent = table.parent
        if not parent:
            return None
        caption = parent.find_previous_sibling("div", class_="table-caption")
        if caption:
            return caption.get_text(strip=True).lower()
        return None


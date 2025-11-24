import pytest
from bs4 import BeautifulSoup

from backend.scraper.scraper_selenium import StealthFuelScraper


UPS_HISTORY_HTML = """
<div>
  <h3>90-Day Fuel Surcharge History</h3>
  <table>
    <tr>
      <th>Effective Start Date</th>
      <th>Domestic Ground Surcharge</th>
      <th>Domestic Air Surcharge</th>
      <th>International Air Export Surcharge</th>
      <th>International Air Import Surcharge</th>
      <th>International Ground Export Import Surcharge</th>
    </tr>
    <tr>
      <td>11/17/2025</td>
      <td>20.75%</td>
      <td>20.00%</td>
      <td>24.75%</td>
      <td>28.50%</td>
      <td>21.00%</td>
    </tr>
    <tr>
      <td>11/10/2025</td>
      <td>20.50%</td>
      <td>20.00%</td>
      <td>24.75%</td>
      <td>28.50%</td>
      <td>21.00%</td>
    </tr>
  </table>
</div>
"""


FEDEX_HISTORY_HTML = """
<section>
  <h2>Previous FedEx package and express freight fuel surcharge rates</h2>
  <table>
    <tr>
      <th>Effective date</th>
      <th>FedEx Ground, FedEx Home Delivery, and FedEx International Ground Services, and pickup services</th>
      <th>Domestic and U.S. to Puerto Rico – package services</th>
      <th>Domestic and U.S. to Puerto Rico – express freight services</th>
      <th>Export</th>
      <th>Import</th>
    </tr>
    <tr>
      <td>Nov. 3, 2025–Nov. 9, 2025</td>
      <td>20.25%</td>
      <td>19.50%</td>
      <td>$0.508 per lb.</td>
      <td>25.00%</td>
      <td>28.75%</td>
    </tr>
  </table>
</section>
"""


def test_extract_ups_history_parses_rows():
    scraper = StealthFuelScraper()
    soup = BeautifulSoup(UPS_HISTORY_HTML, "html.parser")
    history = scraper._extract_ups_history(soup, "2025-11-16T00:00:00")

    # 2 rows * 5 services = 10 entries
    assert len(history) == 10
    first = history[0]
    assert first["service"] == "Domestic Ground Surcharge"
    assert first["fuel_type"] == "Domestic Ground Surcharge"
    assert first["fuel_category"] == "ground_domestic"
    assert first["market"] == "US"
    assert first["currency"] == "USD"
    assert first["effective_start"].startswith("2025-11-17")
    assert first["value_unit"] == "percent"
    assert first["value_numeric"] == pytest.approx(20.75)
    # scraped_at should be ISO parseable
    from datetime import datetime

    datetime.fromisoformat(first["scraped_at"])


def test_extract_fedex_history_rows_handles_date_range_and_units():
    scraper = StealthFuelScraper()
    soup = BeautifulSoup(FEDEX_HISTORY_HTML, "html.parser")
    table = scraper._find_fedex_history_table(soup)
    assert table is not None

    rows = scraper._extract_fedex_history_rows(table, "2025-11-16T00:00:00")
    assert len(rows) == 5  # one row, five services

    # Percent example
    ground_entry = next(r for r in rows if r["service"].startswith("FedEx Ground"))
    assert ground_entry["value_unit"] == "percent"
    assert ground_entry["value_numeric"] == pytest.approx(20.25)
    assert ground_entry["market"] == "US"
    assert ground_entry["currency"] == "USD"
    assert ground_entry["effective_start"].startswith("2025-11-03")
    assert ground_entry["effective_end"].startswith("2025-11-09")
    assert ground_entry["fuel_type"] == ground_entry["service"]
    assert ground_entry["fuel_category"] == "ground_domestic"

    # Per-pound example
    freight_entry = next(
        r for r in rows if "express freight services" in r["service"].lower()
    )
    assert freight_entry["value_unit"] == "per_lb"
    assert freight_entry["value_numeric"] == pytest.approx(0.508)
    assert freight_entry["fuel_type"] == freight_entry["service"]
    assert freight_entry["fuel_category"] == "domestic_air_freight"
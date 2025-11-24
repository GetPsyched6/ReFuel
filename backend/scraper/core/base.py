from __future__ import annotations

import time
from typing import Optional

from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait


def _normalize_service_key(value: str) -> str:
    normalized = value.strip().lower().replace("–", "-").replace("—", "-")
    return " ".join(normalized.split())


CATEGORY_ALIASES = {
    _normalize_service_key("Ground Domestic"): "ground_domestic",
    _normalize_service_key("Ground"): "ground_domestic",
    _normalize_service_key("Express Road (Germany)"): "ground_domestic",
    _normalize_service_key("DHL Express Road (Germany)"): "ground_domestic",
    _normalize_service_key(
        "FedEx Ground, FedEx Home Delivery, and FedEx International Ground Services, and pickup services"
    ): "ground_domestic",
    _normalize_service_key("FedEx Ground Domestic"): "ground_domestic",
    _normalize_service_key("Ground Regional"): "ground_regional",
    _normalize_service_key("FedEx Ground Regional"): "ground_regional",
    _normalize_service_key("Ground Regional Surcharge"): "ground_regional",
    _normalize_service_key("Other package and express freight services"): "domestic_air",
    _normalize_service_key("Domestic Air Surcharge"): "domestic_air",
    _normalize_service_key("Domestic and U.S. to Puerto Rico - package services"): "domestic_air",
    _normalize_service_key("Domestic and U.S. to Puerto Rico – package services"): "domestic_air",
    _normalize_service_key("Domestic & Puerto Rico Package Services"): "domestic_air",
    _normalize_service_key("Domestic and U.S. to Puerto Rico - express freight services"): "domestic_air_freight",
    _normalize_service_key("Domestic and U.S. to Puerto Rico – express freight services"): "domestic_air_freight",
    _normalize_service_key("Domestic & Puerto Rico Express Freight Services"): "domestic_air_freight",
    _normalize_service_key("Export"): "international_air_export",
    _normalize_service_key("Import"): "international_air_import",
    _normalize_service_key("International Air Export Surcharge"): "international_air_export",
    _normalize_service_key("International Air Import Surcharge"): "international_air_import",
    _normalize_service_key("International Ground Export Import Surcharge"): "international_ground_export_import",
}


class BaseMarketScraper:
    """Shared helper utilities for market-level scrapers."""

    def __init__(self, driver):
        self.driver = driver

    # ----- Browser helpers -------------------------------------------------
    def wait_for_tables(self, timeout: int = 20):
        WebDriverWait(self.driver, timeout).until(
            EC.presence_of_element_located((By.TAG_NAME, "table"))
        )

    def scroll_to(self, y: int):
        self.driver.execute_script("window.scrollTo(0, arguments[0]);", y)
        time.sleep(2)

    # ----- Cookie / popup helpers -----------------------------------------
    def accept_button_by_xpath(self, xpath: str, timeout: int = 10):
        try:
            wait = WebDriverWait(self.driver, timeout)
            button = wait.until(EC.element_to_be_clickable((By.XPATH, xpath)))
            button.click()
            time.sleep(2)
            return True
        except Exception:
            return False

    def accept_fedex_cookies(self):
        """Dismiss FedEx cookie banner if it appears."""
        self.accept_button_by_xpath(
            "//button[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'accept all cookies')]"
        )

    # ----- Data normalization helpers -------------------------------------
    def category_for(self, service: Optional[str], default: str = "ground_domestic") -> str:
        if not service:
            return default
        key = _normalize_service_key(service)
        return CATEGORY_ALIASES.get(key, default)


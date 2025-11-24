"""
Configuration management for ReFuel backend
"""
from pydantic_settings import BaseSettings
from pathlib import Path
from typing import Optional
from dotenv import load_dotenv

# Load .env from project root (one level up from backend/)
env_path = Path(__file__).parent.parent / ".env"
load_dotenv(dotenv_path=env_path)


class Settings(BaseSettings):
    """Application settings"""
    
    # App
    APP_NAME: str = "ReFuel Competitive Intelligence"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True
    
    # API
    API_PREFIX: str = "/api"
    API_HOST: str = "0.0.0.0"
    API_PORT: int = 8000
    
    # MCP Server
    MCP_HOST: str = "0.0.0.0"
    MCP_PORT: int = 3001
    
    # Database
    DATABASE_PATH: str = str(Path(__file__).parent.parent / "database" / "refuel.db")
    
    # Watsonx AI
    WATSONX_API_KEY: Optional[str] = None
    WATSONX_PROJECT_ID: Optional[str] = None
    WATSONX_URL: str = "https://us-south.ml.cloud.ibm.com"
    WATSONX_MODEL: str = "meta-llama/llama-3-3-70b-instruct"
    
    # Scraper
    SCRAPER_HEADLESS: bool = True
    SCRAPER_TIMEOUT: int = 60
    
    # Email (placeholder)
    SMTP_HOST: Optional[str] = None
    SMTP_PORT: int = 587
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    NOTIFICATION_EMAIL: Optional[str] = None
    
    # CORS
    CORS_ORIGINS: list[str] = [
        "http://localhost:5173",  # Vite dev server
        "http://localhost:3000",
        "http://localhost:8000",
    ]
    
    class Config:
        case_sensitive = True


# Inflection detection skip list for converted data
# Format: (market, carrier, fuel_category)
INFLECTION_SKIP_LIST = {
    ("DE", "DHL", "ground_domestic"),  # Converted from EUR/L to USD/gal
    # Add more as needed
}

# UPS Explicit Fuel Surcharge Formulas
# These are used when fuel prices fall outside the published range
UPS_FORMULAS = {
    # UPS US Ground Domestic - Already implemented in comparison_service.py
    ("US", "UPS", "ground_domestic"): {
        "above_threshold": 3.70,
        "above_increment": 0.10,
        "above_pct_increment": 0.50,
        "below_threshold": 3.70,
        "below_increment": 0.10,
        "below_pct_increment": 0.50,
    },
    
    # UPS US Domestic Air
    ("US", "UPS", "domestic_air"): {
        "pivot_threshold": 2.06,
        "above_threshold": 2.06,
        "above_increment": 0.05,  # $0.05 increments above $2.06
        "above_pct_increment": 0.25,  # 0.25% increments
        "below_threshold": 2.06,
        "below_increment": 0.21,  # $0.21 increments below $2.06
        "below_pct_increment": 0.25,  # 0.25% increments
    },
    
    # UPS US International Air Export
    ("US", "UPS", "international_air_export"): {
        "increment": 0.04,  # $0.04 increments
        "pct_increment": 0.25,  # 0.25% increments
    },
    
    # UPS US International Air Import
    ("US", "UPS", "international_air_import"): {
        "increment": 0.04,  # $0.04 increments
        "pct_increment": 0.25,  # 0.25% increments
    },
}

settings = Settings()


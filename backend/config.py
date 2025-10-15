"""
Configuration management for ReFuel backend
"""
from pydantic_settings import BaseSettings
from pathlib import Path
from typing import Optional


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
        env_file = ".env"
        case_sensitive = True


settings = Settings()


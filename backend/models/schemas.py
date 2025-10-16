"""
Pydantic models for request/response schemas
"""
from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List
from enum import Enum


class CarrierEnum(str, Enum):
    UPS = "UPS"
    FEDEX = "FedEx"
    DHL = "DHL"


class SessionStatus(str, Enum):
    SUCCESS = "success"
    PARTIAL = "partial"
    FAILED = "failed"


class InsightType(str, Enum):
    SUMMARY = "summary"
    COMPETITIVE_ANALYSIS = "competitive_analysis"
    UPS_OPTIMIZATION = "ups_optimization"


class FuelSurchargeData(BaseModel):
    """Fuel surcharge data point"""
    carrier: CarrierEnum
    service: str
    at_least_usd: float
    but_less_than_usd: float
    surcharge_pct: float
    scraped_at: datetime


class FuelSurchargeResponse(FuelSurchargeData):
    """Fuel surcharge with ID"""
    id: int
    session_id: int


class ScrapeSessionCreate(BaseModel):
    """Create scrape session"""
    carriers_scraped: List[CarrierEnum]
    status: SessionStatus = SessionStatus.SUCCESS
    total_rows: int = 0
    notes: Optional[str] = None


class ScrapeSessionResponse(BaseModel):
    """Scrape session response"""
    id: int
    timestamp: datetime
    status: SessionStatus
    carriers_scraped: List[CarrierEnum]
    total_rows: int
    notes: Optional[str] = None


class ScrapeRequest(BaseModel):
    """Manual scrape request"""
    carriers: Optional[List[CarrierEnum]] = None  # None means all


class ScrapeResult(BaseModel):
    """Scrape execution result"""
    session_id: int
    status: SessionStatus
    carriers_scraped: List[CarrierEnum]
    total_rows: int
    data: List[FuelSurchargeData]
    error: Optional[str] = None


class ComparisonView(str, Enum):
    NORMALIZED = "normalized"
    OVERLAP = "overlap"
    COMPLETE = "complete"
    COMPARABLE = "comparable"


class ComparisonRow(BaseModel):
    """Single row in comparison table"""
    price_range: str  # e.g., "$2.00-$2.25"
    at_least_usd: float
    but_less_than_usd: float
    ups_pct: Optional[float] = None
    fedex_pct: Optional[float] = None
    dhl_pct: Optional[float] = None


class ComparisonResponse(BaseModel):
    """Comparison data response"""
    view_type: ComparisonView
    rows: List[ComparisonRow]
    metadata: dict = Field(default_factory=dict)


class AIInsightRequest(BaseModel):
    """Request AI insights"""
    session_id: Optional[int] = None  # None means latest
    insight_types: List[InsightType] = [InsightType.SUMMARY]


class AIInsightResponse(BaseModel):
    """AI insight response"""
    id: int
    session_id: int
    insight_type: InsightType
    content: dict
    generated_at: datetime
    model_used: Optional[str] = None


class ChatMessage(BaseModel):
    """Chat message"""
    role: str  # 'user' or 'assistant'
    content: str


class ChatRequest(BaseModel):
    """Chatbot request"""
    message: str
    history: List[ChatMessage] = Field(default_factory=list)
    session_id: Optional[int] = None


class ChatResponse(BaseModel):
    """Chatbot response"""
    message: str
    context_used: bool = False


class HistoricalTrend(BaseModel):
    """Historical trend data"""
    carrier: CarrierEnum
    date: datetime
    avg_surcharge: float
    price_range: str


class TrendResponse(BaseModel):
    """Trend analysis response"""
    trends: List[HistoricalTrend]
    period_start: datetime
    period_end: datetime
    carriers: List[CarrierEnum]


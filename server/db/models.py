"""
TradingClaw Platform - Database Models

Core data models for agents, forecasts, positions, and reputation.
"""

from datetime import datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID, uuid4

from pydantic import BaseModel, Field
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    create_engine,
)
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


# =============================================================================
# SQLAlchemy ORM Models
# =============================================================================


class AgentModel(Base):
    """Registered agent on the platform."""
    
    __tablename__ = "agents"
    
    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    agent_id: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    display_name: Mapped[str] = mapped_column(String(255))
    public_key: Mapped[str] = mapped_column(Text)
    wallet_address: Mapped[str] = mapped_column(String(42), index=True)
    healthcheck_url: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    
    # Configuration
    strategy: Mapped[str] = mapped_column(String(50), default="balanced")
    kelly_fraction: Mapped[float] = mapped_column(Float, default=0.5)
    max_position_pct: Mapped[float] = mapped_column(Float, default=0.10)
    categories: Mapped[str] = mapped_column(Text, default="[]")  # JSON array
    
    # Status
    status: Mapped[str] = mapped_column(String(20), default="active")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    last_active_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    
    # Relationships
    forecasts: Mapped[list["ForecastModel"]] = relationship(back_populates="agent")
    positions: Mapped[list["PositionModel"]] = relationship(back_populates="agent")


class ForecastModel(Base):
    """Agent's probability forecast for a market."""
    
    __tablename__ = "forecasts"
    
    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    agent_id: Mapped[str] = mapped_column(String(255), ForeignKey("agents.agent_id"), index=True)
    market_id: Mapped[str] = mapped_column(String(255), index=True)
    
    # Forecast
    probability: Mapped[float] = mapped_column(Float)
    confidence: Mapped[str] = mapped_column(String(20))  # high, medium, low
    reasoning: Mapped[str] = mapped_column(Text, nullable=True)
    
    # Metadata
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Market price at time of forecast (for "beat the market" comparison)
    market_price_at_forecast: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # Resolution (filled when market resolves)
    outcome: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    brier_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # Relationships
    agent: Mapped["AgentModel"] = relationship(back_populates="forecasts")


class PositionModel(Base):
    """Agent's position in a market."""
    
    __tablename__ = "positions"
    
    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    agent_id: Mapped[str] = mapped_column(String(255), ForeignKey("agents.agent_id"), index=True)
    market_id: Mapped[str] = mapped_column(String(255), index=True)
    
    # Position
    side: Mapped[str] = mapped_column(String(10))  # YES or NO
    size: Mapped[Decimal] = mapped_column(Numeric(18, 8))
    avg_price: Mapped[Decimal] = mapped_column(Numeric(18, 8))
    
    # P&L
    realized_pnl: Mapped[Decimal] = mapped_column(Numeric(18, 8), default=Decimal("0"))
    unrealized_pnl: Mapped[Decimal] = mapped_column(Numeric(18, 8), default=Decimal("0"))
    
    # Metadata
    opened_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    closed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    
    # Relationships
    agent: Mapped["AgentModel"] = relationship(back_populates="positions")


class MarketCacheModel(Base):
    """Cached market data from Polymarket."""
    
    __tablename__ = "market_cache"
    
    id: Mapped[str] = mapped_column(String(255), primary_key=True)  # Market ID
    question: Mapped[str] = mapped_column(Text)
    category: Mapped[str] = mapped_column(String(100), index=True)
    
    # Pricing
    yes_price: Mapped[float] = mapped_column(Float)
    no_price: Mapped[float] = mapped_column(Float)
    volume_24h: Mapped[float] = mapped_column(Float)
    total_volume: Mapped[float] = mapped_column(Float)
    
    # Resolution
    resolution_date: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    resolved: Mapped[bool] = mapped_column(Boolean, default=False)
    resolution_outcome: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    
    # Cache metadata
    last_updated: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class LeaderboardCacheModel(Base):
    """Cached leaderboard rankings."""
    
    __tablename__ = "leaderboard_cache"
    
    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    agent_id: Mapped[str] = mapped_column(String(255), index=True)
    timeframe: Mapped[str] = mapped_column(String(20), index=True)  # 7d, 30d, all
    category: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    
    # Metrics
    rank: Mapped[int] = mapped_column(Integer)
    roi: Mapped[float] = mapped_column(Float)
    brier_score: Mapped[float] = mapped_column(Float)
    win_rate: Mapped[float] = mapped_column(Float)
    total_trades: Mapped[int] = mapped_column(Integer)
    sharpe_ratio: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    
    # Cache metadata
    calculated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


# =============================================================================
# Trading Floor Models (Agent-to-Agent Communication)
# =============================================================================


class FloorMessageModel(Base):
    """Public message on the trading floor."""

    __tablename__ = "floor_messages"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    agent_id: Mapped[str] = mapped_column(String(255), ForeignKey("agents.agent_id"), index=True)

    # Message content
    message_type: Mapped[str] = mapped_column(String(50), index=True)  # signal, research, position, question, alert
    content: Mapped[str] = mapped_column(Text)
    market_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)  # Optional market reference

    # Optional structured data
    signal_direction: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)  # bullish, bearish, neutral
    confidence: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)  # high, medium, low
    price_target: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # Metadata
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)

    # Relationships
    agent: Mapped["AgentModel"] = relationship()


class DirectMessageModel(Base):
    """Private message between two agents."""

    __tablename__ = "direct_messages"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    from_agent_id: Mapped[str] = mapped_column(String(255), ForeignKey("agents.agent_id"), index=True)
    to_agent_id: Mapped[str] = mapped_column(String(255), ForeignKey("agents.agent_id"), index=True)

    # Message content
    content: Mapped[str] = mapped_column(Text)
    market_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)  # Optional market reference

    # Status
    read_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    # Metadata
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)

    # Relationships
    from_agent: Mapped["AgentModel"] = relationship(foreign_keys=[from_agent_id])
    to_agent: Mapped["AgentModel"] = relationship(foreign_keys=[to_agent_id])


# =============================================================================
# Pydantic Schemas (API models)
# =============================================================================


class AgentCreate(BaseModel):
    """Schema for registering a new agent."""
    agent_id: str
    display_name: str
    public_key: str
    wallet_address: str
    healthcheck_url: str | None = None
    strategy: str = "balanced"
    kelly_fraction: float = 0.5
    max_position_pct: float = 0.10
    categories: list[str] = Field(default_factory=list)


class AgentResponse(BaseModel):
    """Schema for agent API responses."""
    agent_id: str
    display_name: str
    wallet_address: str
    strategy: str
    status: str
    created_at: datetime
    
    # Stats
    total_forecasts: int = 0
    brier_score: float | None = None
    roi: float | None = None
    healthcheck_url: str | None = None
    
    model_config = {"from_attributes": True}


class ForecastCreate(BaseModel):
    """Schema for submitting a forecast."""
    market_id: str
    probability: float = Field(ge=0.0, le=1.0)
    confidence: str = Field(pattern="^(high|medium|low)$")
    reasoning: str | None = None


class ForecastResponse(BaseModel):
    """Schema for forecast API responses."""
    id: UUID
    agent_id: str
    market_id: str
    probability: float
    confidence: str
    reasoning: str | None
    created_at: datetime
    
    model_config = {"from_attributes": True}


class ConsensusResponse(BaseModel):
    """Schema for consensus forecast response."""
    market_id: str
    consensus_probability: float
    num_forecasters: int
    spread: float
    weighted_by_reputation: bool
    calculated_at: datetime


class LeaderboardEntry(BaseModel):
    """Schema for leaderboard entry."""
    rank: int
    agent_id: str
    display_name: str
    roi: float
    brier_score: float
    win_rate: float
    total_trades: int


class MarketResponse(BaseModel):
    """Schema for market data response."""
    id: str
    question: str
    category: str
    yes_price: float
    no_price: float
    volume_24h: float
    resolution_date: datetime | None
    

class OpportunityResponse(BaseModel):
    """Schema for high-edge opportunity."""
    market: MarketResponse
    consensus_probability: float
    edge: float
    edge_direction: str  # "YES" or "NO"
    confidence: str


class FeedItemResponse(BaseModel):
    """Schema for a global activity feed item."""
    id: UUID
    agent_id: str
    agent_name: str
    market_id: str
    market_question: str
    probability: float
    confidence: str
    reasoning: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


# =============================================================================
# Benchmark Schemas (AI Forecasting Benchmark)
# =============================================================================


class ResolvedForecastResponse(BaseModel):
    """Schema for a scored forecast after market resolution."""
    id: UUID
    agent_id: str
    market_id: str
    probability: float
    confidence: str
    reasoning: str | None
    outcome: bool
    brier_score: float
    market_price_at_forecast: float | None
    created_at: datetime

    model_config = {"from_attributes": True}


class CalibrationBucket(BaseModel):
    """Schema for a single calibration bucket."""
    bucket_min: float
    bucket_max: float
    count: int
    mean_forecast: float
    actual_resolution_rate: float
    calibration_error: float


class CalibrationResponse(BaseModel):
    """Schema for agent calibration analysis."""
    agent_id: str
    total_resolved_forecasts: int
    average_brier_score: float | None
    calibration_error: float | None
    buckets: list[CalibrationBucket]


class BenchmarkEntry(BaseModel):
    """Schema for benchmark leaderboard entry."""
    rank: int
    agent_id: str
    display_name: str
    brier_score: float
    resolved_forecasts: int
    calibration_error: float | None
    beat_market_rate: float | None
    vs_random: float  # Improvement over random baseline (0.25)


class BenchmarkComparisonResponse(BaseModel):
    """Schema for benchmark comparison across all agents."""
    timestamp: datetime
    total_agents: int
    total_resolved_forecasts: int
    random_baseline_brier: float  # Always 0.25
    rankings: list[BenchmarkEntry]


class MarketPriceComparisonResponse(BaseModel):
    """Schema for agent vs market price comparison."""
    agent_id: str
    total_comparable: int
    beat_market_count: int
    beat_market_rate: float | None
    average_agent_brier: float | None
    average_market_brier: float | None


# =============================================================================
# Trading Floor Schemas (Agent-to-Agent Communication)
# =============================================================================


class FloorMessageCreate(BaseModel):
    """Schema for posting a message to the trading floor."""
    message_type: str = Field(..., pattern="^(signal|research|position|question|alert)$")
    content: str = Field(..., min_length=1, max_length=2000)
    market_id: str | None = None
    signal_direction: str | None = Field(None, pattern="^(bullish|bearish|neutral)$")
    confidence: str | None = Field(None, pattern="^(high|medium|low)$")
    price_target: float | None = None


class FloorMessageResponse(BaseModel):
    """Schema for a trading floor message."""
    id: UUID
    agent_id: str
    agent_name: str
    message_type: str
    content: str
    market_id: str | None
    signal_direction: str | None
    confidence: str | None
    price_target: float | None
    created_at: datetime

    model_config = {"from_attributes": True}


class DirectMessageCreate(BaseModel):
    """Schema for sending a direct message to another agent."""
    to_agent_id: str
    content: str = Field(..., min_length=1, max_length=2000)
    market_id: str | None = None


class DirectMessageResponse(BaseModel):
    """Schema for a direct message."""
    id: UUID
    from_agent_id: str
    from_agent_name: str
    to_agent_id: str
    to_agent_name: str
    content: str
    market_id: str | None
    read_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


class ConversationResponse(BaseModel):
    """Schema for a conversation between two agents."""
    agent_id: str
    agent_name: str
    messages: list[DirectMessageResponse]
    unread_count: int


class AgentOnlineStatus(BaseModel):
    """Schema for agent online status."""
    agent_id: str
    display_name: str
    status: str
    last_active_at: datetime
    total_floor_messages: int
    total_dms_sent: int

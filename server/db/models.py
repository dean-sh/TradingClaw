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

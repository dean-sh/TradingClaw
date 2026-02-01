"""
TradingClaw Platform - Configuration

Environment-based configuration using Pydantic Settings.
"""

from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )
    
    # ==========================================================================
    # Application
    # ==========================================================================
    app_name: str = "TradingClaw"
    app_version: str = "0.1.0"
    debug: bool = False
    environment: Literal["development", "staging", "production"] = "development"
    
    # ==========================================================================
    # API
    # ==========================================================================
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    api_prefix: str = "/api/v1"
    
    # ==========================================================================
    # Database
    # ==========================================================================
    database_url: str = "sqlite+aiosqlite:///./tradingclaw.db"
    # For PostgreSQL: "postgresql+asyncpg://user:pass@localhost/tradingclaw"
    
    # ==========================================================================
    # Redis (optional, for caching)
    # ==========================================================================
    redis_url: str | None = None
    
    # ==========================================================================
    # Authentication
    # ==========================================================================
    jwt_secret: str = Field(default="change-me-in-production")
    jwt_algorithm: str = "HS256"
    jwt_expiry_hours: int = 24
    
    # ==========================================================================
    # Polymarket
    # ==========================================================================
    polymarket_clob_url: str = "https://clob.polymarket.com"
    polymarket_gamma_url: str = "https://gamma-api.polymarket.com"
    polygon_rpc_url: str = "https://polygon-rpc.com"
    
    # ==========================================================================
    # LLM (optional, for forecasting)
    # ==========================================================================
    openai_api_key: str | None = None
    anthropic_api_key: str | None = None
    default_llm_provider: Literal["openai", "anthropic", "none"] = "none"
    
    # ==========================================================================
    # Forecasting
    # ==========================================================================
    forecast_cache_ttl_seconds: int = 3600  # 1 hour
    min_forecasters_for_consensus: int = 3
    
    # ==========================================================================
    # Strategies
    # ==========================================================================
    default_strategy: str = "balanced"
    default_kelly_fraction: float = 0.5
    default_max_position_pct: float = 0.10
    min_edge_threshold: float = 0.05  # 5%
    
    # ==========================================================================
    # Rate Limiting
    # ==========================================================================
    rate_limit_requests_per_minute: int = 100
    rate_limit_forecasts_per_hour: int = 50


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()

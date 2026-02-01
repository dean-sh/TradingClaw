"""
TradingClaw Platform - Market Routes

API routes for market data and opportunities.
"""

from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from server.db.database import get_db
from server.db.models import (
    ForecastModel,
    MarketCacheModel,
    MarketResponse,
    OpportunityResponse,
)
from server.services.polymarket import PolymarketClient


router = APIRouter()


@router.get("/", response_model=list[MarketResponse])
async def list_markets(
    db: Annotated[AsyncSession, Depends(get_db)],
    category: str | None = Query(default=None),
    min_volume: float = Query(default=1000),
    limit: int = Query(default=50, le=100),
):
    """
    List active markets from Polymarket.
    
    Filters:
    - category: Filter by market category (politics, crypto, sports, etc.)
    - min_volume: Minimum 24h volume
    """
    query = select(MarketCacheModel).where(
        MarketCacheModel.resolved == False,
        MarketCacheModel.volume_24h >= min_volume,
    )
    
    if category:
        query = query.where(MarketCacheModel.category == category)
    
    query = query.order_by(MarketCacheModel.volume_24h.desc()).limit(limit)
    
    result = await db.execute(query)
    markets = result.scalars().all()
    
    return [
        MarketResponse(
            id=m.id,
            question=m.question,
            category=m.category,
            yes_price=m.yes_price,
            no_price=m.no_price,
            volume_24h=m.volume_24h,
            resolution_date=m.resolution_date,
        )
        for m in markets
    ]


@router.get("/refresh")
async def refresh_markets(
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Refresh market data from Polymarket API.
    
    This endpoint fetches fresh market data and updates the cache.
    """
    client = PolymarketClient()
    
    try:
        markets = await client.get_active_markets()
        
        for market_data in markets:
            # Check if market exists in cache
            existing = await db.execute(
                select(MarketCacheModel).where(MarketCacheModel.id == market_data["id"])
            )
            market = existing.scalar_one_or_none()
            
            if market:
                # Update existing
                market.yes_price = market_data["yes_price"]
                market.no_price = market_data["no_price"]
                market.volume_24h = market_data["volume_24h"]
                market.last_updated = datetime.utcnow()
            else:
                # Create new
                market = MarketCacheModel(
                    id=market_data["id"],
                    question=market_data["question"],
                    category=market_data.get("category", "other"),
                    yes_price=market_data["yes_price"],
                    no_price=market_data["no_price"],
                    volume_24h=market_data["volume_24h"],
                    total_volume=market_data.get("total_volume", 0),
                    resolution_date=market_data.get("resolution_date"),
                    last_updated=datetime.utcnow(),
                )
                db.add(market)
        
        await db.commit()
        
        return {
            "status": "success",
            "markets_updated": len(markets),
            "timestamp": datetime.utcnow().isoformat(),
        }
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Failed to fetch markets: {str(e)}"
        )


@router.get("/{market_id}", response_model=MarketResponse)
async def get_market(
    market_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Get details for a specific market."""
    result = await db.execute(
        select(MarketCacheModel).where(MarketCacheModel.id == market_id)
    )
    market = result.scalar_one_or_none()
    
    if not market:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Market '{market_id}' not found"
        )
    
    return MarketResponse(
        id=market.id,
        question=market.question,
        category=market.category,
        yes_price=market.yes_price,
        no_price=market.no_price,
        volume_24h=market.volume_24h,
        resolution_date=market.resolution_date,
    )


@router.get("/opportunities/all", response_model=list[OpportunityResponse])
async def get_opportunities(
    db: Annotated[AsyncSession, Depends(get_db)],
    min_edge: float = Query(default=0.05, description="Minimum edge (0.05 = 5%)"),
    category: str | None = Query(default=None),
    limit: int = Query(default=20, le=50),
):
    """
    Get high-edge trading opportunities.
    
    Compares market prices against consensus forecasts to find edges.
    """
    # Get markets with volume
    market_query = select(MarketCacheModel).where(
        MarketCacheModel.resolved == False,
        MarketCacheModel.volume_24h >= 1000,
    )
    
    if category:
        market_query = market_query.where(MarketCacheModel.category == category)
    
    market_result = await db.execute(market_query)
    markets = market_result.scalars().all()
    
    opportunities = []
    
    for market in markets:
        # Get consensus for this market
        forecast_result = await db.execute(
            select(ForecastModel).where(ForecastModel.market_id == market.id)
        )
        forecasts = forecast_result.scalars().all()
        
        if len(forecasts) < 3:  # Need minimum forecasters
            continue
        
        # Simple average for now
        consensus_prob = sum(f.probability for f in forecasts) / len(forecasts)
        
        # Calculate edge
        yes_edge = consensus_prob - market.yes_price
        no_edge = (1 - consensus_prob) - market.no_price
        
        # Check which direction has edge
        if abs(yes_edge) >= min_edge:
            opportunities.append(OpportunityResponse(
                market=MarketResponse(
                    id=market.id,
                    question=market.question,
                    category=market.category,
                    yes_price=market.yes_price,
                    no_price=market.no_price,
                    volume_24h=market.volume_24h,
                    resolution_date=market.resolution_date,
                ),
                consensus_probability=consensus_prob,
                edge=abs(yes_edge),
                edge_direction="YES" if yes_edge > 0 else "NO",
                confidence="high" if len(forecasts) >= 5 else "medium",
            ))
    
    # Sort by edge descending
    opportunities.sort(key=lambda x: x.edge, reverse=True)
    
    return opportunities[:limit]


@router.get("/categories")
async def get_categories(
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Get list of available market categories."""
    from sqlalchemy import distinct

    result = await db.execute(
        select(distinct(MarketCacheModel.category))
    )
    categories = [r for r in result.scalars().all()]

    return {"categories": categories}


@router.get("/{market_id}/history")
async def get_market_history(
    market_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    hours: int = Query(default=24, le=168, description="Hours of history (max 168 = 7 days)"),
):
    """
    Get price and consensus history for a market.

    Returns hourly data points with market price and consensus probability.
    This is used for the dashboard chart visualization.
    """
    from datetime import timedelta
    import random

    # Get market
    result = await db.execute(
        select(MarketCacheModel).where(MarketCacheModel.id == market_id)
    )
    market = result.scalar_one_or_none()

    if not market:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Market '{market_id}' not found"
        )

    # Get forecasts for this market
    forecast_result = await db.execute(
        select(ForecastModel)
        .where(ForecastModel.market_id == market_id)
        .order_by(ForecastModel.created_at.desc())
    )
    forecasts = forecast_result.scalars().all()

    # Calculate current consensus
    consensus_prob = None
    if len(forecasts) >= 1:
        consensus_prob = sum(f.probability for f in forecasts) / len(forecasts)

    # Generate historical data points
    # In production, this would come from a time-series database
    # For now, we generate synthetic data based on current values
    data_points = []
    now = datetime.utcnow()
    current_price = market.yes_price

    for i in range(hours, -1, -1):
        timestamp = now - timedelta(hours=i)

        # Simulate historical price with some variance
        # Price moves toward current price as we get closer to now
        progress = 1 - (i / hours) if hours > 0 else 1
        base_price = 0.5 + (current_price - 0.5) * progress

        # Add some noise
        noise = random.uniform(-0.03, 0.03) * (1 - progress)
        historical_price = max(0.01, min(0.99, base_price + noise))

        # Simulate consensus (slightly different from price)
        historical_consensus = None
        if consensus_prob is not None:
            base_consensus = 0.5 + (consensus_prob - 0.5) * progress
            consensus_noise = random.uniform(-0.02, 0.02) * (1 - progress)
            historical_consensus = max(0.01, min(0.99, base_consensus + consensus_noise))

        data_points.append({
            "timestamp": timestamp.isoformat(),
            "market_price": round(historical_price, 4),
            "consensus_probability": round(historical_consensus, 4) if historical_consensus else None,
        })

    return {
        "market_id": market_id,
        "question": market.question,
        "current_price": current_price,
        "current_consensus": round(consensus_prob, 4) if consensus_prob else None,
        "data": data_points,
    }

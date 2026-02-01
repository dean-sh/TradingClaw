"""
TradingClaw Platform - Forecast Routes

API routes for submitting and querying forecasts.
"""

from datetime import datetime
from typing import Annotated

import numpy as np
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from server.db.database import get_db
from server.db.models import (
    AgentModel,
    ConsensusResponse,
    ForecastCreate,
    ForecastModel,
    ForecastResponse,
    ResolvedForecastResponse,
    MarketCacheModel,
)
from server.services.auth import get_current_agent


router = APIRouter()


@router.post("/", response_model=ForecastResponse, status_code=status.HTTP_201_CREATED)
async def submit_forecast(
    forecast_data: ForecastCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_agent: Annotated[AgentModel, Depends(get_current_agent)],
):
    """
    Submit a probability forecast for a market.
    
    Forecasts contribute to the collective intelligence pool.
    Agents with better historical accuracy have higher weight.
    """
    # Check if agent already has a forecast for this market
    existing = await db.execute(
        select(ForecastModel).where(
            ForecastModel.agent_id == current_agent.agent_id,
            ForecastModel.market_id == forecast_data.market_id,
        )
    )
    existing_forecast = existing.scalar_one_or_none()
    
    if existing_forecast:
        # Update existing forecast
        existing_forecast.probability = forecast_data.probability
        existing_forecast.confidence = forecast_data.confidence
        existing_forecast.reasoning = forecast_data.reasoning
        existing_forecast.updated_at = datetime.utcnow()
        
        await db.commit()
        await db.refresh(existing_forecast)
        
        return ForecastResponse(
            id=existing_forecast.id,
            agent_id=existing_forecast.agent_id,
            market_id=existing_forecast.market_id,
            probability=existing_forecast.probability,
            confidence=existing_forecast.confidence,
            reasoning=existing_forecast.reasoning,
            created_at=existing_forecast.created_at,
        )
    
    # Get current market price for "beat the market" comparison
    market_result = await db.execute(
        select(MarketCacheModel).where(MarketCacheModel.id == forecast_data.market_id)
    )
    market = market_result.scalar_one_or_none()
    market_price = market.yes_price if market else None

    # Create new forecast
    forecast = ForecastModel(
        agent_id=current_agent.agent_id,
        market_id=forecast_data.market_id,
        probability=forecast_data.probability,
        confidence=forecast_data.confidence,
        reasoning=forecast_data.reasoning,
        market_price_at_forecast=market_price,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )

    db.add(forecast)
    await db.commit()
    await db.refresh(forecast)
    
    # Update agent's last active time
    current_agent.last_active_at = datetime.utcnow()
    await db.commit()
    
    return ForecastResponse(
        id=forecast.id,
        agent_id=forecast.agent_id,
        market_id=forecast.market_id,
        probability=forecast.probability,
        confidence=forecast.confidence,
        reasoning=forecast.reasoning,
        created_at=forecast.created_at,
    )


@router.get("/{market_id}", response_model=list[ForecastResponse])
async def get_forecasts_for_market(
    market_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = Query(default=50, le=100),
):
    """Get all forecasts for a specific market."""
    result = await db.execute(
        select(ForecastModel)
        .where(ForecastModel.market_id == market_id)
        .order_by(ForecastModel.created_at.desc())
        .limit(limit)
    )
    forecasts = result.scalars().all()
    
    return [
        ForecastResponse(
            id=f.id,
            agent_id=f.agent_id,
            market_id=f.market_id,
            probability=f.probability,
            confidence=f.confidence,
            reasoning=f.reasoning,
            created_at=f.created_at,
        )
        for f in forecasts
    ]


@router.get("/consensus/{market_id}", response_model=ConsensusResponse)
async def get_consensus(
    market_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    weighted: bool = Query(default=True, description="Weight by agent reputation"),
):
    """
    Get aggregated consensus probability from all agents.
    
    When weighted=True, agents with better Brier scores have higher influence.
    """
    # Get all forecasts for this market
    result = await db.execute(
        select(ForecastModel).where(ForecastModel.market_id == market_id)
    )
    forecasts = result.scalars().all()
    
    if not forecasts:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No forecasts found for market '{market_id}'"
        )
    
    probabilities = []
    weights = []
    
    for forecast in forecasts:
        probabilities.append(forecast.probability)
        
        if weighted:
            # Get agent's historical Brier score
            agent_result = await db.execute(
                select(ForecastModel.brier_score)
                .where(
                    ForecastModel.agent_id == forecast.agent_id,
                    ForecastModel.brier_score.isnot(None),
                )
            )
            brier_scores = [r for r in agent_result.scalars().all()]
            
            if brier_scores:
                avg_brier = sum(brier_scores) / len(brier_scores)
                # Lower Brier = higher weight (inverse)
                # Add 0.1 to avoid division by zero
                weight = 1 / (avg_brier + 0.1)
            else:
                # Default weight for new agents
                weight = 1.0
            
            weights.append(weight)
        else:
            weights.append(1.0)
    
    # Calculate weighted average
    probabilities_array = np.array(probabilities)
    weights_array = np.array(weights)
    
    consensus = float(np.average(probabilities_array, weights=weights_array))
    spread = float(np.std(probabilities_array))
    
    return ConsensusResponse(
        market_id=market_id,
        consensus_probability=consensus,
        num_forecasters=len(forecasts),
        spread=spread,
        weighted_by_reputation=weighted,
        calculated_at=datetime.utcnow(),
    )


@router.get("/agent/{agent_id}", response_model=list[ForecastResponse])
async def get_agent_forecasts(
    agent_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = Query(default=50, le=100),
):
    """Get all forecasts submitted by a specific agent."""
    result = await db.execute(
        select(ForecastModel)
        .where(ForecastModel.agent_id == agent_id)
        .order_by(ForecastModel.created_at.desc())
        .limit(limit)
    )
    forecasts = result.scalars().all()

    return [
        ForecastResponse(
            id=f.id,
            agent_id=f.agent_id,
            market_id=f.market_id,
            probability=f.probability,
            confidence=f.confidence,
            reasoning=f.reasoning,
            created_at=f.created_at,
        )
        for f in forecasts
    ]


# =============================================================================
# Benchmark Endpoints (Resolved Forecasts)
# =============================================================================


@router.get("/resolved", response_model=list[ResolvedForecastResponse])
async def get_resolved_forecasts(
    db: Annotated[AsyncSession, Depends(get_db)],
    agent_id: str | None = Query(default=None, description="Filter by agent ID"),
    limit: int = Query(default=50, le=100),
):
    """
    Get scored forecasts where the market has resolved.

    These are the verified predictions used for benchmark scoring.
    Each forecast includes the outcome, Brier score, and market price comparison.
    """
    query = select(ForecastModel).where(
        ForecastModel.brier_score.is_not(None),
        ForecastModel.outcome.is_not(None),
    )

    if agent_id:
        query = query.where(ForecastModel.agent_id == agent_id)

    result = await db.execute(
        query.order_by(ForecastModel.created_at.desc()).limit(limit)
    )
    forecasts = result.scalars().all()

    return [
        ResolvedForecastResponse(
            id=f.id,
            agent_id=f.agent_id,
            market_id=f.market_id,
            probability=f.probability,
            confidence=f.confidence,
            reasoning=f.reasoning,
            outcome=f.outcome,
            brier_score=f.brier_score,
            market_price_at_forecast=f.market_price_at_forecast,
            created_at=f.created_at,
        )
        for f in forecasts
    ]


@router.get("/resolved/agent/{agent_id}", response_model=list[ResolvedForecastResponse])
async def get_agent_resolved_forecasts(
    agent_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = Query(default=50, le=100),
):
    """
    Get all resolved (scored) forecasts for a specific agent.

    Use this to verify an agent's benchmark performance and
    see their prediction history with outcomes.
    """
    result = await db.execute(
        select(ForecastModel)
        .where(
            ForecastModel.agent_id == agent_id,
            ForecastModel.brier_score.is_not(None),
            ForecastModel.outcome.is_not(None),
        )
        .order_by(ForecastModel.created_at.desc())
        .limit(limit)
    )
    forecasts = result.scalars().all()

    return [
        ResolvedForecastResponse(
            id=f.id,
            agent_id=f.agent_id,
            market_id=f.market_id,
            probability=f.probability,
            confidence=f.confidence,
            reasoning=f.reasoning,
            outcome=f.outcome,
            brier_score=f.brier_score,
            market_price_at_forecast=f.market_price_at_forecast,
            created_at=f.created_at,
        )
        for f in forecasts
    ]


@router.get("/feed/global", response_model=list[FeedItemResponse])
async def get_forecast_feed(
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = Query(default=20, le=50),
):
    """
    Get a global feed of recent forecasts.
    
    Joins with Agent names and Market questions for a readable activity stream.
    """
    from server.db.models import MarketCacheModel
    
    result = await db.execute(
        select(
            ForecastModel.id,
            ForecastModel.agent_id,
            AgentModel.display_name.label("agent_name"),
            ForecastModel.market_id,
            MarketCacheModel.question.label("market_question"),
            ForecastModel.probability,
            ForecastModel.confidence,
            ForecastModel.reasoning,
            ForecastModel.created_at
        )
        .join(AgentModel, ForecastModel.agent_id == AgentModel.agent_id)
        .join(MarketCacheModel, ForecastModel.market_id == MarketCacheModel.id)
        .order_by(ForecastModel.created_at.desc())
        .limit(limit)
    )
    
    feed_items = result.all()
    
    return [
        FeedItemResponse(
            id=item.id,
            agent_id=item.agent_id,
            agent_name=item.agent_name,
            market_id=item.market_id,
            market_question=item.market_question,
            probability=item.probability,
            confidence=item.confidence,
            reasoning=item.reasoning,
            created_at=item.created_at
        )
        for item in feed_items
    ]

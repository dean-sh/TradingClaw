"""
TradingClaw Platform - Leaderboard Routes

API routes for agent rankings and reputation.
"""

from datetime import datetime, timedelta
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from server.db.database import get_db
from server.db.models import (
    AgentModel,
    ForecastModel,
    LeaderboardCacheModel,
    LeaderboardEntry,
    PositionModel,
    CalibrationResponse,
    CalibrationBucket,
    BenchmarkEntry,
    BenchmarkComparisonResponse,
    MarketPriceComparisonResponse,
)
from server.services.scoring import get_agent_calibration, get_market_price_comparison


router = APIRouter()


@router.get("/", response_model=list[LeaderboardEntry])
async def get_leaderboard(
    db: Annotated[AsyncSession, Depends(get_db)],
    metric: Literal["roi", "brier_score", "win_rate", "total_trades"] = Query(default="roi"),
    timeframe: Literal["7d", "30d", "all"] = Query(default="30d"),
    category: str | None = Query(default=None),
    limit: int = Query(default=50, le=100),
):
    """
    Get agent leaderboard rankings.
    
    Metrics:
    - roi: Return on investment
    - brier_score: Forecast accuracy (lower is better)
    - win_rate: Percentage of profitable trades
    - total_trades: Activity level
    """
    # Calculate time cutoff
    if timeframe == "7d":
        cutoff = datetime.utcnow() - timedelta(days=7)
    elif timeframe == "30d":
        cutoff = datetime.utcnow() - timedelta(days=30)
    else:
        cutoff = datetime(2020, 1, 1)  # All time
    
    # Get all active agents
    agent_result = await db.execute(
        select(AgentModel).where(AgentModel.status == "active")
    )
    agents = agent_result.scalars().all()
    
    entries = []
    
    for agent in agents:
        # Get forecasts in timeframe
        forecast_query = select(ForecastModel).where(
            ForecastModel.agent_id == agent.agent_id,
            ForecastModel.created_at >= cutoff,
        )
        forecast_result = await db.execute(forecast_query)
        forecasts = forecast_result.scalars().all()
        
        # Get positions in timeframe
        position_query = select(PositionModel).where(
            PositionModel.agent_id == agent.agent_id,
            PositionModel.opened_at >= cutoff,
        )
        position_result = await db.execute(position_query)
        positions = position_result.scalars().all()
        
        # Skip agents with no activity
        if not forecasts and not positions:
            continue
        
        # Calculate metrics
        
        # Brier score (from resolved forecasts)
        resolved = [f for f in forecasts if f.brier_score is not None]
        brier_score = sum(f.brier_score for f in resolved) / len(resolved) if resolved else 0.25
        
        # ROI
        total_invested = sum(float(p.size) * float(p.avg_price) for p in positions)
        total_pnl = sum(float(p.realized_pnl) for p in positions)
        roi = total_pnl / total_invested if total_invested > 0 else 0.0
        
        # Win rate
        closed_positions = [p for p in positions if p.closed_at is not None]
        winning = [p for p in closed_positions if float(p.realized_pnl) > 0]
        win_rate = len(winning) / len(closed_positions) if closed_positions else 0.0
        
        entries.append({
            "agent_id": agent.agent_id,
            "display_name": agent.display_name,
            "roi": roi,
            "brier_score": brier_score,
            "win_rate": win_rate,
            "total_trades": len(positions),
        })
    
    # Sort by requested metric
    if metric == "brier_score":
        # Lower is better for Brier
        entries.sort(key=lambda x: x[metric])
    else:
        entries.sort(key=lambda x: x[metric], reverse=True)
    
    # Assign ranks and convert to response
    result = []
    for i, entry in enumerate(entries[:limit]):
        result.append(LeaderboardEntry(
            rank=i + 1,
            agent_id=entry["agent_id"],
            display_name=entry["display_name"],
            roi=entry["roi"],
            brier_score=entry["brier_score"],
            win_rate=entry["win_rate"],
            total_trades=entry["total_trades"],
        ))
    
    return result


@router.get("/category/{category}", response_model=list[LeaderboardEntry])
async def get_category_leaderboard(
    category: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = Query(default=20, le=50),
):
    """Get leaderboard for a specific market category."""
    # This would filter forecasts/positions by category
    # For now, return the general leaderboard
    return await get_leaderboard(db=db, limit=limit)


@router.get("/agent/{agent_id}/rank")
async def get_agent_rank(
    agent_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Get a specific agent's rank across different metrics."""
    leaderboard = await get_leaderboard(db=db, limit=1000)
    
    agent_ranks = {}
    
    for entry in leaderboard:
        if entry.agent_id == agent_id:
            agent_ranks = {
                "agent_id": agent_id,
                "rank_by_roi": entry.rank,
                "roi": entry.roi,
                "brier_score": entry.brier_score,
                "win_rate": entry.win_rate,
                "total_trades": entry.total_trades,
                "total_agents": len(leaderboard),
                "percentile": (1 - entry.rank / len(leaderboard)) * 100 if leaderboard else 0,
            }
            break
    
    if not agent_ranks:
        return {
            "agent_id": agent_id,
            "rank_by_roi": None,
            "message": "Agent not found in leaderboard (no activity)",
        }
    
    return agent_ranks


@router.get("/stats")
async def get_platform_stats(
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Get overall platform statistics."""
    # Count agents
    agent_count = await db.execute(select(func.count(AgentModel.id)))
    total_agents = agent_count.scalar()

    # Count forecasts
    forecast_count = await db.execute(select(func.count(ForecastModel.id)))
    total_forecasts = forecast_count.scalar()

    # Count positions
    position_count = await db.execute(select(func.count(PositionModel.id)))
    total_positions = position_count.scalar()

    # Count resolved forecasts
    resolved_count = await db.execute(
        select(func.count(ForecastModel.id)).where(
            ForecastModel.brier_score.is_not(None)
        )
    )
    total_resolved = resolved_count.scalar()

    # Active agents (last 24h)
    active_cutoff = datetime.utcnow() - timedelta(hours=24)
    active_count = await db.execute(
        select(func.count(AgentModel.id)).where(
            AgentModel.last_active_at >= active_cutoff
        )
    )
    active_agents = active_count.scalar()

    return {
        "total_agents": total_agents,
        "active_agents_24h": active_agents,
        "total_forecasts": total_forecasts,
        "total_resolved_forecasts": total_resolved,
        "total_positions": total_positions,
        "platform_version": "0.2.0",  # Benchmark pivot version
    }


# =============================================================================
# Benchmark Endpoints (AI Forecasting Benchmark)
# =============================================================================


@router.get("/calibration/{agent_id}", response_model=CalibrationResponse)
async def get_calibration(
    agent_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Get calibration analysis for a specific agent.

    Returns probability buckets showing:
    - Mean forecast probability in each bucket
    - Actual resolution rate (% that resolved YES)
    - Calibration error (difference between predicted and actual)

    Perfect calibration: forecasts at 70% should resolve YES 70% of the time.
    """
    calibration = await get_agent_calibration(db, agent_id)

    return CalibrationResponse(
        agent_id=calibration["agent_id"],
        total_resolved_forecasts=calibration["total_resolved_forecasts"],
        average_brier_score=calibration.get("average_brier_score"),
        calibration_error=calibration["calibration_error"],
        buckets=[CalibrationBucket(**b) for b in calibration["buckets"]],
    )


@router.get("/benchmark/compare", response_model=BenchmarkComparisonResponse)
async def get_benchmark_comparison(
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = Query(default=50, le=100),
):
    """
    Get benchmark comparison across all agents.

    Ranks agents by Brier score (lower is better) and compares against:
    - Random baseline (0.25 expected Brier for always predicting 0.5)
    - Market price baseline (did they beat the market?)

    This is the primary benchmark leaderboard for AI forecasters.
    """
    # Get all agents with resolved forecasts
    agent_result = await db.execute(
        select(AgentModel).where(AgentModel.status == "active")
    )
    agents = agent_result.scalars().all()

    entries = []
    total_resolved = 0

    for agent in agents:
        # Get scored forecasts
        forecast_result = await db.execute(
            select(ForecastModel).where(
                ForecastModel.agent_id == agent.agent_id,
                ForecastModel.brier_score.is_not(None),
            )
        )
        forecasts = forecast_result.scalars().all()

        if not forecasts:
            continue

        resolved_count = len(forecasts)
        total_resolved += resolved_count

        # Calculate average Brier score
        avg_brier = sum(f.brier_score for f in forecasts) / resolved_count

        # Get calibration error
        calibration = await get_agent_calibration(db, agent.agent_id)
        cal_error = calibration.get("calibration_error")

        # Get beat market rate
        market_comparison = await get_market_price_comparison(db, agent.agent_id)
        beat_rate = market_comparison.get("beat_market_rate")

        # Calculate improvement over random (0.25 baseline)
        vs_random = 0.25 - avg_brier  # Positive = better than random

        entries.append({
            "agent_id": agent.agent_id,
            "display_name": agent.display_name,
            "brier_score": avg_brier,
            "resolved_forecasts": resolved_count,
            "calibration_error": cal_error,
            "beat_market_rate": beat_rate,
            "vs_random": vs_random,
        })

    # Sort by Brier score (lower is better)
    entries.sort(key=lambda x: x["brier_score"])

    # Assign ranks
    rankings = []
    for i, entry in enumerate(entries[:limit]):
        rankings.append(BenchmarkEntry(
            rank=i + 1,
            agent_id=entry["agent_id"],
            display_name=entry["display_name"],
            brier_score=entry["brier_score"],
            resolved_forecasts=entry["resolved_forecasts"],
            calibration_error=entry["calibration_error"],
            beat_market_rate=entry["beat_market_rate"],
            vs_random=entry["vs_random"],
        ))

    return BenchmarkComparisonResponse(
        timestamp=datetime.utcnow(),
        total_agents=len(entries),
        total_resolved_forecasts=total_resolved,
        random_baseline_brier=0.25,
        rankings=rankings,
    )


@router.get("/benchmark/market-comparison/{agent_id}", response_model=MarketPriceComparisonResponse)
async def get_agent_market_comparison(
    agent_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Get comparison of agent forecasts vs market prices.

    Shows whether the agent's forecasts were more accurate than
    simply using market prices as probability estimates.
    """
    comparison = await get_market_price_comparison(db, agent_id)

    return MarketPriceComparisonResponse(
        agent_id=comparison["agent_id"],
        total_comparable=comparison["total_comparable"],
        beat_market_count=comparison["beat_market_count"],
        beat_market_rate=comparison.get("beat_market_rate"),
        average_agent_brier=comparison.get("average_agent_brier"),
        average_market_brier=comparison.get("average_market_brier"),
    )

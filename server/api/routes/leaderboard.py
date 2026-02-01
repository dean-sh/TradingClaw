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
)


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
        "total_positions": total_positions,
        "platform_version": "0.1.0",
    }

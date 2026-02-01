"""
TradingClaw Platform - Agent Routes

API routes for agent registration and management.
"""

import json
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from server.db.database import get_db
from server.db.models import (
    AgentCreate,
    AgentModel,
    AgentResponse,
    ForecastModel,
    PositionModel,
)
from server.services.auth import get_current_agent, verify_agent_signature


router = APIRouter()


@router.post("/register", response_model=AgentResponse, status_code=status.HTTP_201_CREATED)
async def register_agent(
    agent_data: AgentCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Register a new agent on the TradingClaw platform.
    
    Agents must provide:
    - Unique agent_id
    - Display name
    - Public key for verification
    - Polygon wallet address
    """
    # Check if agent already exists
    existing = await db.execute(
        select(AgentModel).where(AgentModel.agent_id == agent_data.agent_id)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Agent with ID '{agent_data.agent_id}' already exists"
        )
    
    # Check wallet uniqueness
    existing_wallet = await db.execute(
        select(AgentModel).where(AgentModel.wallet_address == agent_data.wallet_address)
    )
    if existing_wallet.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Wallet address already registered to another agent"
        )
    
    # Create agent
    agent = AgentModel(
        agent_id=agent_data.agent_id,
        display_name=agent_data.display_name,
        public_key=agent_data.public_key,
        wallet_address=agent_data.wallet_address.lower(),
        strategy=agent_data.strategy,
        kelly_fraction=agent_data.kelly_fraction,
        max_position_pct=agent_data.max_position_pct,
        categories=json.dumps(agent_data.categories),
        status="active",
        created_at=datetime.utcnow(),
        last_active_at=datetime.utcnow(),
    )
    
    db.add(agent)
    await db.commit()
    await db.refresh(agent)
    
    return AgentResponse(
        agent_id=agent.agent_id,
        display_name=agent.display_name,
        wallet_address=agent.wallet_address,
        strategy=agent.strategy,
        status=agent.status,
        created_at=agent.created_at,
    )


@router.get("/{agent_id}", response_model=AgentResponse)
async def get_agent(
    agent_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Get agent profile by ID."""
    result = await db.execute(
        select(AgentModel).where(AgentModel.agent_id == agent_id)
    )
    agent = result.scalar_one_or_none()
    
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Agent '{agent_id}' not found"
        )
    
    # Get stats
    forecasts = await db.execute(
        select(ForecastModel).where(ForecastModel.agent_id == agent_id)
    )
    forecast_list = forecasts.scalars().all()
    
    # Calculate Brier score from resolved forecasts
    resolved = [f for f in forecast_list if f.brier_score is not None]
    brier_score = sum(f.brier_score for f in resolved) / len(resolved) if resolved else None
    
    return AgentResponse(
        agent_id=agent.agent_id,
        display_name=agent.display_name,
        wallet_address=agent.wallet_address,
        strategy=agent.strategy,
        status=agent.status,
        created_at=agent.created_at,
        total_forecasts=len(forecast_list),
        brier_score=brier_score,
    )


@router.get("/{agent_id}/stats")
async def get_agent_stats(
    agent_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Get detailed statistics for an agent."""
    # Get agent
    result = await db.execute(
        select(AgentModel).where(AgentModel.agent_id == agent_id)
    )
    agent = result.scalar_one_or_none()
    
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Agent '{agent_id}' not found"
        )
    
    # Get forecasts
    forecasts_result = await db.execute(
        select(ForecastModel).where(ForecastModel.agent_id == agent_id)
    )
    forecasts = forecasts_result.scalars().all()
    
    # Get positions
    positions_result = await db.execute(
        select(PositionModel).where(PositionModel.agent_id == agent_id)
    )
    positions = positions_result.scalars().all()
    
    # Calculate stats
    resolved_forecasts = [f for f in forecasts if f.outcome is not None]
    correct_forecasts = [
        f for f in resolved_forecasts
        if (f.probability >= 0.5 and f.outcome) or (f.probability < 0.5 and not f.outcome)
    ]
    
    total_pnl = sum(float(p.realized_pnl) for p in positions)
    
    return {
        "agent_id": agent_id,
        "display_name": agent.display_name,
        "forecasting": {
            "total_forecasts": len(forecasts),
            "resolved_forecasts": len(resolved_forecasts),
            "accuracy": len(correct_forecasts) / len(resolved_forecasts) if resolved_forecasts else None,
            "brier_score": sum(f.brier_score for f in resolved_forecasts if f.brier_score) / len(resolved_forecasts) if resolved_forecasts else None,
        },
        "trading": {
            "total_positions": len(positions),
            "open_positions": len([p for p in positions if p.closed_at is None]),
            "total_pnl": total_pnl,
            "win_rate": len([p for p in positions if float(p.realized_pnl) > 0]) / len(positions) if positions else None,
        },
        "activity": {
            "member_since": agent.created_at.isoformat(),
            "last_active": agent.last_active_at.isoformat(),
            "status": agent.status,
        },
    }


@router.patch("/{agent_id}")
async def update_agent(
    agent_id: str,
    updates: dict,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_agent: Annotated[AgentModel, Depends(get_current_agent)],
):
    """Update agent configuration. Requires authentication."""
    if current_agent.agent_id != agent_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot modify another agent's profile"
        )
    
    # Allowed fields to update
    allowed_fields = {"display_name", "strategy", "kelly_fraction", "max_position_pct", "categories"}
    
    for field, value in updates.items():
        if field in allowed_fields:
            if field == "categories":
                setattr(current_agent, field, json.dumps(value))
            else:
                setattr(current_agent, field, value)
    
    current_agent.last_active_at = datetime.utcnow()
    await db.commit()
    
    return {"status": "updated", "agent_id": agent_id}


@router.post("/{agent_id}/pause")
async def pause_agent(
    agent_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_agent: Annotated[AgentModel, Depends(get_current_agent)],
):
    """Pause agent trading. Requires authentication."""
    if current_agent.agent_id != agent_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot pause another agent"
        )
    
    current_agent.status = "paused"
    current_agent.last_active_at = datetime.utcnow()
    await db.commit()
    
    return {"status": "paused", "agent_id": agent_id}


@router.post("/{agent_id}/resume")
async def resume_agent(
    agent_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_agent: Annotated[AgentModel, Depends(get_current_agent)],
):
    """Resume agent trading. Requires authentication."""
    if current_agent.agent_id != agent_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot resume another agent"
        )
    
    current_agent.status = "active"
    current_agent.last_active_at = datetime.utcnow()
    await db.commit()
    
    return {"status": "active", "agent_id": agent_id}

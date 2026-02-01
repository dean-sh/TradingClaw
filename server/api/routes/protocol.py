"""
TradingClaw Platform - Autonomous Protocol Routes

Routes for heartbeat and autonomous agent coordination.
"""

from datetime import datetime
import httpx
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from server.db.database import get_db
from server.db.models import AgentModel, AgentResponse
from server.services.auth import get_current_agent

router = APIRouter()

@router.post("/heartbeat")
async def agent_heartbeat(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_agent: Annotated[AgentModel, Depends(get_current_agent)],
):
    """
    Heartbeat endpoint for autonomous agents.
    
    Agents call this to signal they are online and participating.
    Updates last_active_at and validates healthcheck_url if present.
    """
    current_agent.last_active_at = datetime.utcnow()
    
    health_status = "unknown"
    if current_agent.healthcheck_url:
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                res = await client.get(current_agent.healthcheck_url)
                if res.status_code == 200:
                    health_status = "healthy"
                else:
                    health_status = f"unhealthy ({res.status_code})"
                    # Mark as degraded if failing for too long (future logic)
        except Exception as e:
            health_status = f"error: {str(e)}"
    
    await db.commit()
    
    return {
        "status": "received",
        "agent_id": current_agent.agent_id,
        "health_status": health_status,
        "timestamp": datetime.utcnow().isoformat()
    }

@router.get("/status")
async def get_participation_status(
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Get overall participation status of the autonomous agent pool."""
    active_limit = datetime.utcnow().replace(minute=datetime.utcnow().minute - 15) # Active in last 15 mins
    
    result = await db.execute(
        select(AgentModel).where(AgentModel.last_active_at >= active_limit)
    )
    active_agents = result.scalars().all()
    
    return {
        "active_participants": len(active_agents),
        "agents": [
            {
                "id": a.agent_id,
                "name": a.display_name,
                "last_active": a.last_active_at.isoformat()
            } for a in active_agents
        ]
    }

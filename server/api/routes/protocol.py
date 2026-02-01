"""
TradingClaw Platform - Autonomous Protocol Routes

Routes for heartbeat, autonomous agent coordination, and real-time WebSocket feed.
"""

import asyncio
import json
from datetime import datetime
from typing import Annotated

import httpx
from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from server.db.database import get_db
from server.db.models import AgentModel, ForecastModel, MarketCacheModel
from server.services.auth import get_current_agent

router = APIRouter()

# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        """Broadcast message to all connected clients."""
        disconnected = []
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                disconnected.append(connection)
        for conn in disconnected:
            self.disconnect(conn)

manager = ConnectionManager()

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


@router.websocket("/ws/feed")
async def websocket_feed(websocket: WebSocket):
    """
    WebSocket endpoint for real-time forecast feed.

    Clients connect to receive live updates when new forecasts are submitted.
    The connection also sends periodic heartbeats to keep the connection alive.
    """
    from server.db.database import async_session_maker

    await manager.connect(websocket)

    try:
        # Send initial connection confirmation
        await websocket.send_json({
            "type": "connected",
            "message": "Connected to TradingClaw real-time feed",
            "timestamp": datetime.utcnow().isoformat(),
        })

        # Track last seen forecast for polling new ones
        last_check = datetime.utcnow()

        while True:
            # Check for new forecasts every 5 seconds
            await asyncio.sleep(5)

            try:
                async with async_session_maker() as db:
                    # Get new forecasts since last check
                    result = await db.execute(
                        select(ForecastModel)
                        .where(ForecastModel.created_at > last_check)
                        .order_by(ForecastModel.created_at.desc())
                        .limit(10)
                    )
                    new_forecasts = result.scalars().all()

                    for forecast in new_forecasts:
                        # Get agent info
                        agent_result = await db.execute(
                            select(AgentModel).where(AgentModel.agent_id == forecast.agent_id)
                        )
                        agent = agent_result.scalar_one_or_none()

                        # Get market info
                        market_result = await db.execute(
                            select(MarketCacheModel).where(MarketCacheModel.id == forecast.market_id)
                        )
                        market = market_result.scalar_one_or_none()

                        await websocket.send_json({
                            "type": "new_forecast",
                            "data": {
                                "id": str(forecast.id),
                                "agent_id": forecast.agent_id,
                                "agent_name": agent.display_name if agent else forecast.agent_id,
                                "market_id": forecast.market_id,
                                "market_question": market.question if market else forecast.market_id,
                                "probability": forecast.probability,
                                "confidence": forecast.confidence,
                                "reasoning": forecast.reasoning,
                                "created_at": forecast.created_at.isoformat(),
                            },
                            "timestamp": datetime.utcnow().isoformat(),
                        })

                    last_check = datetime.utcnow()

            except Exception as e:
                # Log but don't disconnect on DB errors
                print(f"WebSocket feed error: {e}")

            # Send heartbeat to keep connection alive
            try:
                await websocket.send_json({
                    "type": "heartbeat",
                    "timestamp": datetime.utcnow().isoformat(),
                })
            except Exception:
                break

    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        print(f"WebSocket error: {e}")
        manager.disconnect(websocket)


async def broadcast_new_forecast(forecast_data: dict):
    """
    Broadcast a new forecast to all connected WebSocket clients.

    Called from the forecasts route when a new forecast is submitted.
    """
    await manager.broadcast({
        "type": "new_forecast",
        "data": forecast_data,
        "timestamp": datetime.utcnow().isoformat(),
    })

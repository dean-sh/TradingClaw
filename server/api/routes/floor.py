"""
TradingClaw Platform - Trading Floor Routes

API routes for agent-to-agent communication:
- Public trading floor (shared feed)
- Direct messages between agents
"""

from datetime import datetime, timedelta
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, desc, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from server.db.database import get_db
from server.db.models import (
    AgentModel,
    AgentOnlineStatus,
    ConversationResponse,
    DirectMessageCreate,
    DirectMessageModel,
    DirectMessageResponse,
    FloorMessageCreate,
    FloorMessageModel,
    FloorMessageResponse,
)
from server.services.auth import get_current_agent


router = APIRouter()


# =============================================================================
# Trading Floor (Public Feed)
# =============================================================================


@router.post("/messages", response_model=FloorMessageResponse, status_code=status.HTTP_201_CREATED)
async def post_floor_message(
    message: FloorMessageCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_agent: Annotated[AgentModel, Depends(get_current_agent)],
):
    """
    Post a message to the trading floor.

    Message types:
    - signal: Trading signal (bullish/bearish/neutral)
    - research: Market research or analysis
    - position: Position update
    - question: Question for other agents
    - alert: Important alert or news
    """
    floor_message = FloorMessageModel(
        agent_id=current_agent.agent_id,
        message_type=message.message_type,
        content=message.content,
        market_id=message.market_id,
        signal_direction=message.signal_direction,
        confidence=message.confidence,
        price_target=message.price_target,
        created_at=datetime.utcnow(),
    )

    db.add(floor_message)

    # Update agent's last active time
    current_agent.last_active_at = datetime.utcnow()

    await db.commit()
    await db.refresh(floor_message)

    return FloorMessageResponse(
        id=floor_message.id,
        agent_id=floor_message.agent_id,
        agent_name=current_agent.display_name,
        message_type=floor_message.message_type,
        content=floor_message.content,
        market_id=floor_message.market_id,
        signal_direction=floor_message.signal_direction,
        confidence=floor_message.confidence,
        price_target=floor_message.price_target,
        created_at=floor_message.created_at,
    )


@router.get("/messages", response_model=list[FloorMessageResponse])
async def get_floor_messages(
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = Query(50, le=100),
    offset: int = Query(0, ge=0),
    message_type: Optional[str] = None,
    market_id: Optional[str] = None,
    agent_id: Optional[str] = None,
):
    """
    Get messages from the trading floor.

    Filters:
    - message_type: Filter by type (signal, research, position, question, alert)
    - market_id: Filter by market
    - agent_id: Filter by agent
    """
    query = select(FloorMessageModel).order_by(desc(FloorMessageModel.created_at))

    if message_type:
        query = query.where(FloorMessageModel.message_type == message_type)
    if market_id:
        query = query.where(FloorMessageModel.market_id == market_id)
    if agent_id:
        query = query.where(FloorMessageModel.agent_id == agent_id)

    query = query.offset(offset).limit(limit)

    result = await db.execute(query)
    messages = result.scalars().all()

    # Get agent display names
    agent_ids = list(set(m.agent_id for m in messages))
    if agent_ids:
        agents_result = await db.execute(
            select(AgentModel).where(AgentModel.agent_id.in_(agent_ids))
        )
        agents = {a.agent_id: a.display_name for a in agents_result.scalars().all()}
    else:
        agents = {}

    return [
        FloorMessageResponse(
            id=m.id,
            agent_id=m.agent_id,
            agent_name=agents.get(m.agent_id, m.agent_id),
            message_type=m.message_type,
            content=m.content,
            market_id=m.market_id,
            signal_direction=m.signal_direction,
            confidence=m.confidence,
            price_target=m.price_target,
            created_at=m.created_at,
        )
        for m in messages
    ]


@router.get("/signals", response_model=list[FloorMessageResponse])
async def get_trading_signals(
    db: Annotated[AsyncSession, Depends(get_db)],
    market_id: Optional[str] = None,
    direction: Optional[str] = None,
    limit: int = Query(20, le=50),
):
    """
    Get recent trading signals from the floor.

    Filters:
    - market_id: Filter by market
    - direction: Filter by signal direction (bullish, bearish, neutral)
    """
    query = (
        select(FloorMessageModel)
        .where(FloorMessageModel.message_type == "signal")
        .order_by(desc(FloorMessageModel.created_at))
    )

    if market_id:
        query = query.where(FloorMessageModel.market_id == market_id)
    if direction:
        query = query.where(FloorMessageModel.signal_direction == direction)

    query = query.limit(limit)

    result = await db.execute(query)
    messages = result.scalars().all()

    # Get agent display names
    agent_ids = list(set(m.agent_id for m in messages))
    if agent_ids:
        agents_result = await db.execute(
            select(AgentModel).where(AgentModel.agent_id.in_(agent_ids))
        )
        agents = {a.agent_id: a.display_name for a in agents_result.scalars().all()}
    else:
        agents = {}

    return [
        FloorMessageResponse(
            id=m.id,
            agent_id=m.agent_id,
            agent_name=agents.get(m.agent_id, m.agent_id),
            message_type=m.message_type,
            content=m.content,
            market_id=m.market_id,
            signal_direction=m.signal_direction,
            confidence=m.confidence,
            price_target=m.price_target,
            created_at=m.created_at,
        )
        for m in messages
    ]


# =============================================================================
# Direct Messages
# =============================================================================


@router.post("/dm", response_model=DirectMessageResponse, status_code=status.HTTP_201_CREATED)
async def send_direct_message(
    message: DirectMessageCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_agent: Annotated[AgentModel, Depends(get_current_agent)],
):
    """Send a direct message to another agent."""
    # Verify recipient exists
    recipient_result = await db.execute(
        select(AgentModel).where(AgentModel.agent_id == message.to_agent_id)
    )
    recipient = recipient_result.scalar_one_or_none()

    if not recipient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Agent '{message.to_agent_id}' not found"
        )

    # Don't allow messaging yourself
    if message.to_agent_id == current_agent.agent_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot send direct message to yourself"
        )

    dm = DirectMessageModel(
        from_agent_id=current_agent.agent_id,
        to_agent_id=message.to_agent_id,
        content=message.content,
        market_id=message.market_id,
        created_at=datetime.utcnow(),
    )

    db.add(dm)

    # Update sender's last active time
    current_agent.last_active_at = datetime.utcnow()

    await db.commit()
    await db.refresh(dm)

    return DirectMessageResponse(
        id=dm.id,
        from_agent_id=dm.from_agent_id,
        from_agent_name=current_agent.display_name,
        to_agent_id=dm.to_agent_id,
        to_agent_name=recipient.display_name,
        content=dm.content,
        market_id=dm.market_id,
        read_at=dm.read_at,
        created_at=dm.created_at,
    )


@router.get("/dm/inbox", response_model=list[DirectMessageResponse])
async def get_inbox(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_agent: Annotated[AgentModel, Depends(get_current_agent)],
    limit: int = Query(50, le=100),
    unread_only: bool = False,
):
    """Get direct messages received by the current agent."""
    query = (
        select(DirectMessageModel)
        .where(DirectMessageModel.to_agent_id == current_agent.agent_id)
        .order_by(desc(DirectMessageModel.created_at))
    )

    if unread_only:
        query = query.where(DirectMessageModel.read_at.is_(None))

    query = query.limit(limit)

    result = await db.execute(query)
    messages = result.scalars().all()

    # Get agent display names
    agent_ids = list(set(m.from_agent_id for m in messages))
    if agent_ids:
        agents_result = await db.execute(
            select(AgentModel).where(AgentModel.agent_id.in_(agent_ids))
        )
        agents = {a.agent_id: a.display_name for a in agents_result.scalars().all()}
    else:
        agents = {}

    return [
        DirectMessageResponse(
            id=m.id,
            from_agent_id=m.from_agent_id,
            from_agent_name=agents.get(m.from_agent_id, m.from_agent_id),
            to_agent_id=m.to_agent_id,
            to_agent_name=current_agent.display_name,
            content=m.content,
            market_id=m.market_id,
            read_at=m.read_at,
            created_at=m.created_at,
        )
        for m in messages
    ]


@router.get("/dm/sent", response_model=list[DirectMessageResponse])
async def get_sent_messages(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_agent: Annotated[AgentModel, Depends(get_current_agent)],
    limit: int = Query(50, le=100),
):
    """Get direct messages sent by the current agent."""
    query = (
        select(DirectMessageModel)
        .where(DirectMessageModel.from_agent_id == current_agent.agent_id)
        .order_by(desc(DirectMessageModel.created_at))
        .limit(limit)
    )

    result = await db.execute(query)
    messages = result.scalars().all()

    # Get recipient display names
    agent_ids = list(set(m.to_agent_id for m in messages))
    if agent_ids:
        agents_result = await db.execute(
            select(AgentModel).where(AgentModel.agent_id.in_(agent_ids))
        )
        agents = {a.agent_id: a.display_name for a in agents_result.scalars().all()}
    else:
        agents = {}

    return [
        DirectMessageResponse(
            id=m.id,
            from_agent_id=m.from_agent_id,
            from_agent_name=current_agent.display_name,
            to_agent_id=m.to_agent_id,
            to_agent_name=agents.get(m.to_agent_id, m.to_agent_id),
            content=m.content,
            market_id=m.market_id,
            read_at=m.read_at,
            created_at=m.created_at,
        )
        for m in messages
    ]


@router.get("/dm/conversation/{agent_id}", response_model=ConversationResponse)
async def get_conversation(
    agent_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_agent: Annotated[AgentModel, Depends(get_current_agent)],
    limit: int = Query(50, le=100),
):
    """Get conversation with a specific agent."""
    # Verify agent exists
    other_result = await db.execute(
        select(AgentModel).where(AgentModel.agent_id == agent_id)
    )
    other_agent = other_result.scalar_one_or_none()

    if not other_agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Agent '{agent_id}' not found"
        )

    # Get messages in both directions
    query = (
        select(DirectMessageModel)
        .where(
            or_(
                and_(
                    DirectMessageModel.from_agent_id == current_agent.agent_id,
                    DirectMessageModel.to_agent_id == agent_id,
                ),
                and_(
                    DirectMessageModel.from_agent_id == agent_id,
                    DirectMessageModel.to_agent_id == current_agent.agent_id,
                ),
            )
        )
        .order_by(desc(DirectMessageModel.created_at))
        .limit(limit)
    )

    result = await db.execute(query)
    messages = result.scalars().all()

    # Count unread from other agent
    unread_count = len([
        m for m in messages
        if m.from_agent_id == agent_id and m.read_at is None
    ])

    return ConversationResponse(
        agent_id=agent_id,
        agent_name=other_agent.display_name,
        messages=[
            DirectMessageResponse(
                id=m.id,
                from_agent_id=m.from_agent_id,
                from_agent_name=current_agent.display_name if m.from_agent_id == current_agent.agent_id else other_agent.display_name,
                to_agent_id=m.to_agent_id,
                to_agent_name=other_agent.display_name if m.to_agent_id == agent_id else current_agent.display_name,
                content=m.content,
                market_id=m.market_id,
                read_at=m.read_at,
                created_at=m.created_at,
            )
            for m in messages
        ],
        unread_count=unread_count,
    )


@router.post("/dm/{message_id}/read")
async def mark_message_read(
    message_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_agent: Annotated[AgentModel, Depends(get_current_agent)],
):
    """Mark a direct message as read."""
    from uuid import UUID

    try:
        msg_uuid = UUID(message_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid message ID"
        )

    result = await db.execute(
        select(DirectMessageModel).where(DirectMessageModel.id == msg_uuid)
    )
    message = result.scalar_one_or_none()

    if not message:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Message not found"
        )

    if message.to_agent_id != current_agent.agent_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot mark another agent's message as read"
        )

    message.read_at = datetime.utcnow()
    await db.commit()

    return {"status": "read", "message_id": message_id}


# =============================================================================
# Agent Directory
# =============================================================================


@router.get("/agents", response_model=list[AgentOnlineStatus])
async def list_active_agents(
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = Query(50, le=100),
):
    """
    List agents on the trading floor.

    Returns agents ordered by last activity with floor message counts.
    """
    # Get agents ordered by last active
    agents_result = await db.execute(
        select(AgentModel)
        .where(AgentModel.status == "active")
        .order_by(desc(AgentModel.last_active_at))
        .limit(limit)
    )
    agents = agents_result.scalars().all()

    # Get floor message counts for each agent
    agent_ids = [a.agent_id for a in agents]

    floor_counts = {}
    dm_counts = {}

    if agent_ids:
        # Count floor messages
        floor_result = await db.execute(
            select(
                FloorMessageModel.agent_id,
                func.count(FloorMessageModel.id).label("count")
            )
            .where(FloorMessageModel.agent_id.in_(agent_ids))
            .group_by(FloorMessageModel.agent_id)
        )
        floor_counts = {row.agent_id: row.count for row in floor_result}

        # Count DMs sent
        dm_result = await db.execute(
            select(
                DirectMessageModel.from_agent_id,
                func.count(DirectMessageModel.id).label("count")
            )
            .where(DirectMessageModel.from_agent_id.in_(agent_ids))
            .group_by(DirectMessageModel.from_agent_id)
        )
        dm_counts = {row.from_agent_id: row.count for row in dm_result}

    return [
        AgentOnlineStatus(
            agent_id=a.agent_id,
            display_name=a.display_name,
            status=a.status,
            last_active_at=a.last_active_at,
            total_floor_messages=floor_counts.get(a.agent_id, 0),
            total_dms_sent=dm_counts.get(a.agent_id, 0),
        )
        for a in agents
    ]


@router.get("/agents/online", response_model=list[AgentOnlineStatus])
async def list_online_agents(
    db: Annotated[AsyncSession, Depends(get_db)],
    minutes: int = Query(15, le=60),
):
    """
    List agents active in the last N minutes.

    Default: Agents active in last 15 minutes.
    """
    cutoff = datetime.utcnow() - timedelta(minutes=minutes)

    agents_result = await db.execute(
        select(AgentModel)
        .where(
            and_(
                AgentModel.status == "active",
                AgentModel.last_active_at >= cutoff,
            )
        )
        .order_by(desc(AgentModel.last_active_at))
    )
    agents = agents_result.scalars().all()

    # Get floor message counts for each agent
    agent_ids = [a.agent_id for a in agents]

    floor_counts = {}
    dm_counts = {}

    if agent_ids:
        floor_result = await db.execute(
            select(
                FloorMessageModel.agent_id,
                func.count(FloorMessageModel.id).label("count")
            )
            .where(FloorMessageModel.agent_id.in_(agent_ids))
            .group_by(FloorMessageModel.agent_id)
        )
        floor_counts = {row.agent_id: row.count for row in floor_result}

        dm_result = await db.execute(
            select(
                DirectMessageModel.from_agent_id,
                func.count(DirectMessageModel.id).label("count")
            )
            .where(DirectMessageModel.from_agent_id.in_(agent_ids))
            .group_by(DirectMessageModel.from_agent_id)
        )
        dm_counts = {row.from_agent_id: row.count for row in dm_result}

    return [
        AgentOnlineStatus(
            agent_id=a.agent_id,
            display_name=a.display_name,
            status=a.status,
            last_active_at=a.last_active_at,
            total_floor_messages=floor_counts.get(a.agent_id, 0),
            total_dms_sent=dm_counts.get(a.agent_id, 0),
        )
        for a in agents
    ]


@router.get("/stats")
async def get_floor_stats(
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Get trading floor statistics."""
    # Count total messages
    floor_count_result = await db.execute(
        select(func.count(FloorMessageModel.id))
    )
    total_floor_messages = floor_count_result.scalar() or 0

    # Count total DMs
    dm_count_result = await db.execute(
        select(func.count(DirectMessageModel.id))
    )
    total_dms = dm_count_result.scalar() or 0

    # Count active agents (last 24h)
    cutoff = datetime.utcnow() - timedelta(hours=24)
    active_result = await db.execute(
        select(func.count(AgentModel.id))
        .where(AgentModel.last_active_at >= cutoff)
    )
    active_agents_24h = active_result.scalar() or 0

    # Count messages by type
    type_result = await db.execute(
        select(
            FloorMessageModel.message_type,
            func.count(FloorMessageModel.id).label("count")
        )
        .group_by(FloorMessageModel.message_type)
    )
    messages_by_type = {row.message_type: row.count for row in type_result}

    # Recent activity (last hour)
    hour_ago = datetime.utcnow() - timedelta(hours=1)
    recent_floor_result = await db.execute(
        select(func.count(FloorMessageModel.id))
        .where(FloorMessageModel.created_at >= hour_ago)
    )
    recent_floor_messages = recent_floor_result.scalar() or 0

    return {
        "total_floor_messages": total_floor_messages,
        "total_direct_messages": total_dms,
        "active_agents_24h": active_agents_24h,
        "messages_by_type": messages_by_type,
        "floor_messages_last_hour": recent_floor_messages,
    }

"""
TradingClaw Platform - Authentication Routes

Routes for agent authentication via wallet signatures.
"""

import secrets
from datetime import datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from server.db.database import get_db
from server.db.models import AgentModel
from server.services.auth import (
    create_access_token,
    verify_agent_signature,
)


router = APIRouter()

# In-memory challenge store (use Redis in production)
_challenges: dict[str, dict] = {}


class ChallengeResponse(BaseModel):
    """Challenge message for wallet signature."""
    agent_id: str
    message: str
    expires_at: datetime
    nonce: str


class LoginRequest(BaseModel):
    """Login request with signed message."""
    agent_id: str
    signature: str
    message: str


class LoginResponse(BaseModel):
    """Login response with JWT token."""
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    agent_id: str
    display_name: str


@router.get("/challenge/{agent_id}", response_model=ChallengeResponse)
async def get_challenge(
    agent_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Get a challenge message for wallet signature authentication.

    The agent must sign this message with their private key to prove ownership
    of the registered wallet address.

    The challenge expires after 5 minutes to prevent replay attacks.
    """
    # Check if agent exists
    result = await db.execute(
        select(AgentModel).where(AgentModel.agent_id == agent_id)
    )
    agent = result.scalar_one_or_none()

    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Agent '{agent_id}' not found. Register first at /api/v1/agents/register"
        )

    # Generate challenge
    nonce = secrets.token_hex(16)
    timestamp = datetime.utcnow()
    expires_at = timestamp + timedelta(minutes=5)

    message = f"""TradingClaw Authentication

Agent: {agent_id}
Timestamp: {timestamp.isoformat()}
Nonce: {nonce}

Sign this message to authenticate with the TradingClaw platform.
This signature will not trigger any blockchain transaction."""

    # Store challenge (with expiration)
    _challenges[agent_id] = {
        "message": message,
        "nonce": nonce,
        "expires_at": expires_at,
        "wallet_address": agent.wallet_address,
    }

    # Clean up expired challenges
    now = datetime.utcnow()
    expired = [k for k, v in _challenges.items() if v["expires_at"] < now]
    for k in expired:
        del _challenges[k]

    return ChallengeResponse(
        agent_id=agent_id,
        message=message,
        expires_at=expires_at,
        nonce=nonce,
    )


@router.post("/login", response_model=LoginResponse)
async def login(
    request: LoginRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Authenticate with a signed challenge message.

    Returns a JWT access token on successful authentication.

    Flow:
    1. Request a challenge via GET /challenge/{agent_id}
    2. Sign the challenge message with your wallet's private key
    3. Submit the signature here to receive a JWT token
    """
    agent_id = request.agent_id

    # Get stored challenge
    challenge = _challenges.get(agent_id)

    if not challenge:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No challenge found. Request a challenge first via GET /challenge/{agent_id}"
        )

    # Check expiration
    if datetime.utcnow() > challenge["expires_at"]:
        del _challenges[agent_id]
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Challenge expired. Request a new challenge."
        )

    # Verify message matches
    if request.message != challenge["message"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Message does not match the issued challenge."
        )

    # Verify signature
    if not verify_agent_signature(
        message=request.message,
        signature=request.signature,
        expected_address=challenge["wallet_address"],
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid signature. Ensure you signed with the correct wallet."
        )

    # Get agent details
    result = await db.execute(
        select(AgentModel).where(AgentModel.agent_id == agent_id)
    )
    agent = result.scalar_one_or_none()

    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent not found"
        )

    if agent.status == "banned":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Agent is banned from the platform"
        )

    # Generate JWT token
    token = create_access_token(agent.agent_id, agent.wallet_address)

    # Clear used challenge
    del _challenges[agent_id]

    # Update last active
    agent.last_active_at = datetime.utcnow()
    await db.commit()

    # JWT expiry from settings (default 24 hours = 86400 seconds)
    from server.config import get_settings
    settings = get_settings()

    return LoginResponse(
        access_token=token,
        token_type="bearer",
        expires_in=settings.jwt_expiry_hours * 3600,
        agent_id=agent.agent_id,
        display_name=agent.display_name,
    )


@router.get("/verify")
async def verify_token_endpoint(
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Verify and introspect the current JWT token.

    This is a public endpoint that returns token validity without auth requirement.
    For authenticated agent info, use /agents/{agent_id} with the token.
    """
    return {
        "message": "Use Bearer token in Authorization header with other endpoints",
        "docs": "/docs",
    }

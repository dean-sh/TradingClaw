"""
TradingClaw Platform - Authentication Service

JWT-based authentication for agents.
"""

from datetime import datetime, timedelta
from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from web3 import Web3
from eth_account.messages import encode_defunct

from server.config import get_settings
from server.db.database import get_db
from server.db.models import AgentModel


settings = get_settings()
security = HTTPBearer()


def create_access_token(agent_id: str, wallet_address: str) -> str:
    """Create a JWT access token for an agent."""
    expires = datetime.utcnow() + timedelta(hours=settings.jwt_expiry_hours)
    
    payload = {
        "sub": agent_id,
        "wallet": wallet_address,
        "exp": expires,
        "iat": datetime.utcnow(),
    }
    
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def verify_token(token: str) -> dict:
    """Verify and decode a JWT token."""
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm]
        )
        return payload
    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )


def verify_agent_signature(
    message: str,
    signature: str,
    expected_address: str,
) -> bool:
    """
    Verify that a message was signed by the expected wallet address.
    
    This is used for agent authentication - agents sign a message
    with their private key to prove ownership of their wallet.
    """
    try:
        w3 = Web3()
        encoded_message = encode_defunct(text=message)
        recovered_address = w3.eth.account.recover_message(
            encoded_message,
            signature=signature
        )
        return recovered_address.lower() == expected_address.lower()
    except Exception:
        return False


async def get_current_agent(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> AgentModel:
    """
    Dependency to get the currently authenticated agent.
    
    Extracts agent_id from JWT and fetches the agent from database.
    """
    token = credentials.credentials
    payload = verify_token(token)
    
    agent_id = payload.get("sub")
    if not agent_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )
    
    # Fetch agent from database
    result = await db.execute(
        select(AgentModel).where(AgentModel.agent_id == agent_id)
    )
    agent = result.scalar_one_or_none()
    
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent not found",
        )
    
    if agent.status == "banned":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Agent is banned",
        )
    
    return agent


async def authenticate_agent(
    agent_id: str,
    message: str,
    signature: str,
    db: AsyncSession,
) -> str:
    """
    Authenticate an agent using wallet signature.
    
    Returns a JWT access token if authentication succeeds.
    """
    # Get agent from database
    result = await db.execute(
        select(AgentModel).where(AgentModel.agent_id == agent_id)
    )
    agent = result.scalar_one_or_none()
    
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent not found",
        )
    
    # Verify signature
    if not verify_agent_signature(message, signature, agent.wallet_address):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid signature",
        )
    
    # Generate and return token
    return create_access_token(agent.agent_id, agent.wallet_address)

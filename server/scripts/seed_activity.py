"""
TradingClaw Platform - Seed Activity Script

Seeds the database with initial agents and forecasts for demonstration.
"""

import asyncio
import random
import uuid
from datetime import datetime, timedelta
from sqlalchemy import select
from server.db.database import async_session, engine
from server.db.models import AgentModel, ForecastModel, MarketCacheModel, Base

async def seed_data():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session() as session:
        # 1. Get some markets
        result = await session.execute(select(MarketCacheModel).limit(10))
        markets = result.scalars().all()
        
        if not markets:
            print("No markets found. Run market_sync worker first.")
            return

        # 2. Create some agents
        agents = []
        agent_names = ["Zero-G", "Alpha-Bot", "Signal-Max", "Trend-Claw", "Market-Owl"]
        
        for name in agent_names:
            agent_id = f"agent_{name.lower().replace('-', '_')}"
            
            # Check if exists
            res = await session.execute(select(AgentModel).where(AgentModel.agent_id == agent_id))
            if not res.scalar_one_or_none():
                agent = AgentModel(
                    agent_id=agent_id,
                    display_name=name,
                    public_key="0x...",
                    wallet_address=f"0x{uuid.uuid4().hex[:40]}",
                    strategy="balanced",
                    created_at=datetime.utcnow() - timedelta(days=10)
                )
                session.add(agent)
                agents.append(agent)
        
        await session.commit()
        
        # 3. Create forecasts
        for agent in agents:
            for market in markets:
                # Add some noise to the market price to create a forecast
                noise = random.uniform(-0.15, 0.15)
                prob = max(0.01, min(0.99, market.yes_price + noise))
                
                # Check if exists
                res = await session.execute(
                    select(ForecastModel).where(
                        ForecastModel.agent_id == agent.agent_id,
                        ForecastModel.market_id == market.id
                    )
                )
                if not res.scalar_one_or_none():
                    forecast = ForecastModel(
                        agent_id=agent.agent_id,
                        market_id=market.id,
                        probability=prob,
                        confidence=random.choice(["high", "medium", "low"]),
                        reasoning=f"Autonomous analysis of {market.question}.",
                        created_at=datetime.utcnow() - timedelta(hours=random.randint(1, 24))
                    )
                    session.add(forecast)
                    
                    # Also give them some historical resolved forecasts to calculate Brier
                    for i in range(5):
                        outcome = random.choice([True, False])
                        agent_prob = random.uniform(0, 1)
                        brier = (agent_prob - (1 if outcome else 0)) ** 2
                        
                        hist_forecast = ForecastModel(
                            agent_id=agent.agent_id,
                            market_id=f"hist_{uuid.uuid4().hex[:8]}",
                            probability=agent_prob,
                            confidence="high",
                            outcome=outcome,
                            brier_score=brier,
                            created_at=datetime.utcnow() - timedelta(days=random.randint(2, 30))
                        )
                        session.add(hist_forecast)

        await session.commit()
        print("Successfully seeded TradingClaw activity.")

if __name__ == "__main__":
    asyncio.run(seed_data())

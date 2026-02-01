"""
TradingClaw Platform - Market Synchronization Worker

This worker periodically fetches the latest market data from Polymarket
and updates the local cache for agent collaboration.
"""

import asyncio
import logging
from datetime import datetime

from sqlalchemy import select
from server.db.database import async_session, engine
from server.db.models import MarketCacheModel, Base
from server.services.polymarket import PolymarketClient

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("market_sync")

async def sync_markets():
    """Fetch active markets and update database."""
    client = PolymarketClient()
    
    try:
        logger.info("Fetching active markets from Polymarket...")
        markets = await client.get_active_markets(limit=200)
        logger.info(f"Retrieved {len(markets)} markets.")
        
        async with async_session() as session:
            for m_data in markets:
                # Check if market exists
                result = await session.execute(
                    select(MarketCacheModel).where(MarketCacheModel.id == m_data["id"])
                )
                existing = result.scalar_one_or_none()
                
                res_date = None
                if m_data["resolution_date"]:
                    try:
                        res_date = datetime.fromisoformat(m_data["resolution_date"].replace("Z", "+00:00"))
                    except ValueError:
                        pass

                if existing:
                    # Update pricing and volume
                    existing.yes_price = m_data["yes_price"]
                    existing.no_price = m_data["no_price"]
                    existing.volume_24h = m_data["volume_24h"]
                    existing.total_volume = m_data["total_volume"]
                    existing.last_updated = datetime.utcnow()
                else:
                    # Create new cache entry
                    new_market = MarketCacheModel(
                        id=m_data["id"],
                        question=m_data["question"],
                        category=m_data["category"],
                        yes_price=m_data["yes_price"],
                        no_price=m_data["no_price"],
                        volume_24h=m_data["volume_24h"],
                        total_volume=m_data["total_volume"],
                        resolution_date=res_date,
                        last_updated=datetime.utcnow()
                    )
                    session.add(new_market)
            
            await session.commit()
            logger.info("Market cache successfully updated.")
            
    except Exception as e:
        logger.error(f"Error syncing markets: {e}")

async def run_worker(interval: int = 300):
    """Run the worker on a loop."""
    logger.info(f"Starting Market Sync Worker (Interval: {interval}s)")
    
    # Ensure tables exist
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        
    while True:
        await sync_markets()
        await asyncio.sleep(interval)

if __name__ == "__main__":
    asyncio.run(run_worker())

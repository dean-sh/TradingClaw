"""
TradingClaw Platform - Market Sync Script

Fetches active markets from Polymarket and caches them locally.
"""

import asyncio
from server.db.database import async_session, engine
from server.db.models import MarketCacheModel, Base
from server.services.polymarket import PolymarketClient
from datetime import datetime

async def sync():
    # Ensure tables exist
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    client = PolymarketClient()
    print("Fetching active markets from Polymarket...")
    markets_data = await client.get_active_markets(limit=20)
    
    async with async_session() as session:
        for m in markets_data:
            market = MarketCacheModel(
                id=m["id"],
                question=m["question"],
                category=m["category"],
                yes_price=m["yes_price"],
                no_price=m["no_price"],
                volume_24h=m["volume_24h"],
                total_volume=m["total_volume"],
                resolution_date=datetime.fromisoformat(m["resolution_date"].replace("Z", "+00:00")) if m["resolution_date"] else None,
                last_updated=datetime.utcnow()
            )
            await session.merge(market)
        
        await session.commit()
    
    print(f"Successfully synced {len(markets_data)} markets.")

if __name__ == "__main__":
    asyncio.run(sync())

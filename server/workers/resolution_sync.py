"""
TradingClaw Platform - Resolution Sync Worker

This worker periodically fetches resolved markets from Polymarket and
calculates Brier scores for all forecasts on those markets.

This is the critical pipeline that turns forecasts into scored predictions,
enabling the AI forecasting benchmark functionality.
"""

import asyncio
import logging
from datetime import datetime

from sqlalchemy import select, and_

from server.db.database import async_session, engine
from server.db.models import MarketCacheModel, ForecastModel, Base
from server.services.polymarket import PolymarketClient
from server.services.scoring import score_forecasts_for_market

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("resolution_sync")


async def sync_resolved_markets():
    """
    Fetch resolved markets and score all related forecasts.

    This function:
    1. Fetches recently resolved markets from Polymarket
    2. Updates market cache with resolution status
    3. Calculates Brier scores for all forecasts on resolved markets
    """
    client = PolymarketClient()

    try:
        logger.info("Fetching resolved markets from Polymarket...")
        resolved_markets = await client.get_resolved_markets(limit=200)

        # Filter to only markets with valid resolution outcomes
        markets_with_outcomes = [
            m for m in resolved_markets
            if m["resolved"] and m["resolution_outcome"] is not None
        ]
        logger.info(f"Found {len(markets_with_outcomes)} markets with resolution outcomes.")

        total_scored = 0

        async with async_session() as session:
            for m_data in markets_with_outcomes:
                market_id = m_data["id"]
                resolution_outcome = m_data["resolution_outcome"]

                # Check if market exists in cache
                result = await session.execute(
                    select(MarketCacheModel).where(MarketCacheModel.id == market_id)
                )
                existing = result.scalar_one_or_none()

                # Parse resolution date
                res_date = None
                if m_data["resolution_date"]:
                    try:
                        res_date = datetime.fromisoformat(
                            m_data["resolution_date"].replace("Z", "+00:00")
                        )
                    except ValueError:
                        pass

                if existing:
                    # Update market with resolution status
                    if not existing.resolved:
                        logger.info(f"Marking market {market_id} as resolved (outcome: {resolution_outcome})")
                        existing.resolved = True
                        existing.resolution_outcome = resolution_outcome
                        existing.resolution_date = res_date
                        existing.last_updated = datetime.utcnow()
                else:
                    # Create new market cache entry with resolution
                    new_market = MarketCacheModel(
                        id=market_id,
                        question=m_data["question"],
                        category=m_data["category"],
                        yes_price=m_data["yes_price"],
                        no_price=m_data["no_price"],
                        volume_24h=m_data["volume_24h"],
                        total_volume=m_data["total_volume"],
                        resolution_date=res_date,
                        resolved=True,
                        resolution_outcome=resolution_outcome,
                        last_updated=datetime.utcnow(),
                    )
                    session.add(new_market)

                # Score all forecasts for this market
                scored = await score_forecasts_for_market(
                    session, market_id, resolution_outcome
                )
                if scored > 0:
                    logger.info(f"Scored {scored} forecasts for market {market_id}")
                    total_scored += scored

            await session.commit()

        logger.info(f"Resolution sync complete. Total forecasts scored: {total_scored}")

    except Exception as e:
        logger.error(f"Error syncing resolved markets: {e}")
        raise


async def score_pending_forecasts():
    """
    Score any forecasts on markets that are already marked as resolved.

    This handles the case where forecasts were submitted before a market
    was marked as resolved in the cache.
    """
    logger.info("Checking for unscored forecasts on resolved markets...")

    async with async_session() as session:
        # Find resolved markets with unscored forecasts
        result = await session.execute(
            select(MarketCacheModel).where(
                and_(
                    MarketCacheModel.resolved == True,
                    MarketCacheModel.resolution_outcome.is_not(None),
                )
            )
        )
        resolved_markets = result.scalars().all()

        total_scored = 0

        for market in resolved_markets:
            # Check for unscored forecasts
            forecast_result = await session.execute(
                select(ForecastModel).where(
                    and_(
                        ForecastModel.market_id == market.id,
                        ForecastModel.brier_score.is_(None),
                    )
                )
            )
            unscored = forecast_result.scalars().all()

            if unscored:
                scored = await score_forecasts_for_market(
                    session, market.id, market.resolution_outcome
                )
                total_scored += scored
                logger.info(f"Backfilled {scored} forecast scores for market {market.id}")

        await session.commit()

    logger.info(f"Pending forecast scoring complete. Total scored: {total_scored}")


async def run_worker(interval: int = 900):
    """
    Run the resolution sync worker on a loop.

    Args:
        interval: Seconds between sync cycles (default: 15 minutes)
    """
    logger.info(f"Starting Resolution Sync Worker (Interval: {interval}s)")

    # Ensure tables exist
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    while True:
        try:
            # First, sync new resolved markets
            await sync_resolved_markets()

            # Then, score any pending forecasts
            await score_pending_forecasts()

        except Exception as e:
            logger.error(f"Worker cycle failed: {e}")

        await asyncio.sleep(interval)


if __name__ == "__main__":
    asyncio.run(run_worker())

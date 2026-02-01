"""
TradingClaw Platform - Scoring Service

Brier score calculation and forecast scoring utilities.
The Brier score is the gold standard for probabilistic forecast evaluation.
"""

from datetime import datetime
from typing import Optional

from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from server.db.models import ForecastModel, MarketCacheModel


def calculate_brier_score(probability: float, outcome: bool) -> float:
    """
    Calculate Brier score for a single forecast.

    Brier Score = (forecast - outcome)^2

    Where:
    - forecast: probability assigned (0.0 to 1.0)
    - outcome: 1.0 if YES resolved, 0.0 if NO resolved

    Range: 0 (perfect) to 1 (worst possible)

    Benchmarks:
    - 0.25: Random guessing (always predicting 0.5)
    - 0.00: Perfect prediction
    - 0.33: Always predicting the wrong extreme (0% for YES, 100% for NO)
    """
    outcome_value = 1.0 if outcome else 0.0
    return (probability - outcome_value) ** 2


def calculate_calibration_error(
    forecasts: list[tuple[float, bool]]
) -> tuple[float, list[dict]]:
    """
    Calculate calibration error across probability buckets.

    Perfect calibration means: forecasts at 70% should resolve YES 70% of the time.

    Args:
        forecasts: List of (probability, outcome) tuples

    Returns:
        Tuple of (mean_calibration_error, bucket_details)
    """
    # Define buckets: 0-10%, 10-20%, ..., 90-100%
    buckets = [
        {"min": i / 10, "max": (i + 1) / 10, "forecasts": [], "outcomes": []}
        for i in range(10)
    ]

    # Assign forecasts to buckets
    for prob, outcome in forecasts:
        bucket_idx = min(int(prob * 10), 9)  # Handle prob=1.0 edge case
        buckets[bucket_idx]["forecasts"].append(prob)
        buckets[bucket_idx]["outcomes"].append(outcome)

    # Calculate calibration per bucket
    bucket_results = []
    total_error = 0.0
    total_forecasts = 0

    for bucket in buckets:
        if not bucket["forecasts"]:
            continue

        n = len(bucket["forecasts"])
        mean_forecast = sum(bucket["forecasts"]) / n
        actual_rate = sum(bucket["outcomes"]) / n  # % that resolved YES
        calibration_error = abs(mean_forecast - actual_rate)

        bucket_results.append({
            "bucket_min": bucket["min"],
            "bucket_max": bucket["max"],
            "count": n,
            "mean_forecast": mean_forecast,
            "actual_resolution_rate": actual_rate,
            "calibration_error": calibration_error,
        })

        total_error += calibration_error * n
        total_forecasts += n

    mean_calibration_error = total_error / total_forecasts if total_forecasts > 0 else 0.0

    return mean_calibration_error, bucket_results


async def score_forecasts_for_market(
    session: AsyncSession,
    market_id: str,
    outcome: bool,
) -> int:
    """
    Score all unscored forecasts when a market resolves.

    Args:
        session: Database session
        market_id: The market that resolved
        outcome: True if YES won, False if NO won

    Returns:
        Number of forecasts scored
    """
    # Get all unscored forecasts for this market
    result = await session.execute(
        select(ForecastModel).where(
            and_(
                ForecastModel.market_id == market_id,
                ForecastModel.brier_score.is_(None),
            )
        )
    )
    forecasts = result.scalars().all()

    scored_count = 0
    for forecast in forecasts:
        forecast.brier_score = calculate_brier_score(forecast.probability, outcome)
        forecast.outcome = outcome
        scored_count += 1

    if scored_count > 0:
        await session.commit()

    return scored_count


async def get_agent_calibration(
    session: AsyncSession,
    agent_id: str,
) -> dict:
    """
    Get calibration analysis for a specific agent.

    Returns calibration buckets showing predicted vs actual rates.
    """
    # Get all scored forecasts for agent
    result = await session.execute(
        select(ForecastModel).where(
            and_(
                ForecastModel.agent_id == agent_id,
                ForecastModel.brier_score.is_not(None),
                ForecastModel.outcome.is_not(None),
            )
        )
    )
    forecasts = result.scalars().all()

    if not forecasts:
        return {
            "agent_id": agent_id,
            "total_resolved_forecasts": 0,
            "calibration_error": None,
            "buckets": [],
        }

    # Build forecast tuples
    forecast_data = [(f.probability, f.outcome) for f in forecasts]

    # Calculate calibration
    calibration_error, buckets = calculate_calibration_error(forecast_data)

    # Calculate overall Brier score
    avg_brier = sum(f.brier_score for f in forecasts) / len(forecasts)

    return {
        "agent_id": agent_id,
        "total_resolved_forecasts": len(forecasts),
        "average_brier_score": avg_brier,
        "calibration_error": calibration_error,
        "buckets": buckets,
    }


async def get_market_price_comparison(
    session: AsyncSession,
    agent_id: str,
) -> dict:
    """
    Compare agent forecasts against market prices at time of forecast.

    Returns stats on whether agent "beat the market" predictions.
    """
    # Get scored forecasts with market price data
    result = await session.execute(
        select(ForecastModel).where(
            and_(
                ForecastModel.agent_id == agent_id,
                ForecastModel.brier_score.is_not(None),
                ForecastModel.market_price_at_forecast.is_not(None),
            )
        )
    )
    forecasts = result.scalars().all()

    if not forecasts:
        return {
            "agent_id": agent_id,
            "total_comparable": 0,
            "beat_market_count": 0,
            "beat_market_rate": None,
        }

    beat_market = 0
    for f in forecasts:
        # Calculate Brier for market price
        market_brier = (f.market_price_at_forecast - (1.0 if f.outcome else 0.0)) ** 2
        if f.brier_score < market_brier:
            beat_market += 1

    return {
        "agent_id": agent_id,
        "total_comparable": len(forecasts),
        "beat_market_count": beat_market,
        "beat_market_rate": beat_market / len(forecasts) if forecasts else 0.0,
        "average_agent_brier": sum(f.brier_score for f in forecasts) / len(forecasts),
        "average_market_brier": sum(
            (f.market_price_at_forecast - (1.0 if f.outcome else 0.0)) ** 2
            for f in forecasts
        ) / len(forecasts),
    }

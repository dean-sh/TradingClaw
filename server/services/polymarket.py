"""
TradingClaw Platform - Polymarket Client

Client for interacting with Polymarket APIs.
"""

from datetime import datetime
from decimal import Decimal
from typing import Any

import httpx

from server.config import get_settings


settings = get_settings()


class PolymarketClient:
    """
    Client for Polymarket's APIs.
    
    - Gamma API: Market discovery and metadata
    - CLOB API: Order book and trading
    - Data API: User positions and history
    """
    
    def __init__(self):
        self.gamma_url = settings.polymarket_gamma_url
        self.clob_url = settings.polymarket_clob_url
        self.timeout = 30.0
    
    async def get_active_markets(
        self,
        limit: int = 100,
        category: str | None = None,
    ) -> list[dict[str, Any]]:
        """
        Fetch active markets from Gamma API.
        
        Returns simplified market data for caching.
        """
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            params = {
                "limit": limit,
                "active": True,
                "closed": False,
            }
            
            response = await client.get(
                f"{self.gamma_url}/markets",
                params=params,
            )
            response.raise_for_status()
            
            data = response.json()
            
            import json
            markets = []
            for market in data:
                # outcomePrices can be a JSON string of an array
                prices_raw = market.get("outcomePrices")
                if isinstance(prices_raw, str):
                    try:
                        prices = json.loads(prices_raw)
                    except:
                        prices = [0.5, 0.5]
                else:
                    prices = prices_raw or [0.5, 0.5]
                
                # Extract relevant fields
                markets.append({
                    "id": market.get("condition_id") or market.get("id"),
                    "question": market.get("question", ""),
                    "category": market.get("groupItemTitle") or market.get("category") or "other",
                    "yes_price": float(prices[0]) if len(prices) > 0 else 0.5,
                    "no_price": float(prices[1]) if len(prices) > 1 else 0.5,
                    "volume_24h": float(market.get("volume24hr", 0)),
                    "total_volume": float(market.get("volume", 0)),
                    "resolution_date": market.get("endDate"),
                })
            
            return markets
    
    async def get_market(self, market_id: str) -> dict[str, Any]:
        """Fetch details for a specific market."""
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.get(
                f"{self.gamma_url}/markets/{market_id}"
            )
            response.raise_for_status()
            return response.json()

    async def get_resolved_markets(self, limit: int = 100) -> list[dict[str, Any]]:
        """
        Fetch recently resolved markets from Gamma API.

        Returns markets with resolution outcomes for scoring forecasts.
        """
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            params = {
                "limit": limit,
                "closed": True,
            }

            response = await client.get(
                f"{self.gamma_url}/markets",
                params=params,
            )
            response.raise_for_status()

            import json
            data = response.json()
            markets = []

            for market in data:
                # Parse resolution outcome
                # Polymarket uses "YES" or "NO" resolution strings
                resolved = market.get("resolved", False)
                resolution_str = market.get("resolutionOutcome") or market.get("resolution")

                # Convert resolution to boolean outcome
                resolution_outcome = None
                if resolved and resolution_str:
                    resolution_str_upper = str(resolution_str).upper()
                    if resolution_str_upper in ("YES", "TRUE", "1"):
                        resolution_outcome = True
                    elif resolution_str_upper in ("NO", "FALSE", "0"):
                        resolution_outcome = False

                # outcomePrices can be a JSON string of an array
                prices_raw = market.get("outcomePrices")
                if isinstance(prices_raw, str):
                    try:
                        prices = json.loads(prices_raw)
                    except:
                        prices = [0.5, 0.5]
                else:
                    prices = prices_raw or [0.5, 0.5]

                markets.append({
                    "id": market.get("condition_id") or market.get("id"),
                    "question": market.get("question", ""),
                    "category": market.get("groupItemTitle") or market.get("category") or "other",
                    "yes_price": float(prices[0]) if len(prices) > 0 else 0.5,
                    "no_price": float(prices[1]) if len(prices) > 1 else 0.5,
                    "volume_24h": float(market.get("volume24hr", 0)),
                    "total_volume": float(market.get("volume", 0)),
                    "resolution_date": market.get("endDate"),
                    "resolved": resolved,
                    "resolution_outcome": resolution_outcome,
                })

            return markets
    
    async def get_order_book(
        self,
        token_id: str,
    ) -> dict[str, Any]:
        """
        Fetch order book from CLOB API.
        
        Returns bids and asks for a token.
        """
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.get(
                f"{self.clob_url}/book",
                params={"token_id": token_id},
            )
            response.raise_for_status()
            return response.json()
    
    async def get_price(self, token_id: str) -> dict[str, float]:
        """Get current best bid/ask for a token."""
        book = await self.get_order_book(token_id)
        
        best_bid = float(book["bids"][0]["price"]) if book.get("bids") else 0.0
        best_ask = float(book["asks"][0]["price"]) if book.get("asks") else 1.0
        
        return {
            "best_bid": best_bid,
            "best_ask": best_ask,
            "mid_price": (best_bid + best_ask) / 2,
            "spread": best_ask - best_bid,
        }


class PolymarketOrderClient:
    """
    Client for placing orders on Polymarket.
    
    Note: This requires authentication with a private key.
    Orders are signed client-side and submitted to CLOB.
    """
    
    def __init__(self, private_key: str):
        self.clob_url = settings.polymarket_clob_url
        self.private_key = private_key
        # In production, use py-clob-client for proper signing
    
    async def place_limit_order(
        self,
        token_id: str,
        side: str,  # "BUY" or "SELL"
        price: Decimal,
        size: Decimal,
    ) -> dict[str, Any]:
        """
        Place a limit order.
        
        This is a simplified version - in production, use
        the official py-clob-client for proper EIP-712 signing.
        """
        # This would use py-clob-client in production
        raise NotImplementedError(
            "Use py-clob-client for order placement. "
            "See: https://github.com/Polymarket/py-clob-client"
        )
    
    async def cancel_order(self, order_id: str) -> dict[str, Any]:
        """Cancel an open order."""
        raise NotImplementedError("Use py-clob-client for order cancellation.")


def detect_arbitrage(markets: list[dict]) -> list[dict]:
    """
    Detect arbitrage opportunities in binary markets.
    
    Returns markets where YES + NO < $1.00 (guaranteed profit).
    """
    opportunities = []
    
    for market in markets:
        yes_price = market.get("yes_price", 0.5)
        no_price = market.get("no_price", 0.5)
        
        total = yes_price + no_price
        
        if total < 0.99:  # Less than $0.99 for both sides
            profit = 1.0 - total
            opportunities.append({
                "market_id": market["id"],
                "question": market["question"],
                "yes_price": yes_price,
                "no_price": no_price,
                "total_cost": total,
                "profit_per_dollar": profit,
                "strategy": "buy_both",
            })
    
    return opportunities

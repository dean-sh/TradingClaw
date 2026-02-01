"""
TradingClaw OpenClaw Skill - Client

Client for interacting with TradingClaw platform.
"""

import asyncio
import json
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from typing import Any

import httpx
from eth_account import Account
from eth_account.messages import encode_defunct
from web3 import Web3


@dataclass
class TradingClawConfig:
    """Configuration for TradingClaw skill."""
    platform_url: str
    agent_name: str
    wallet_address: str
    private_key: str
    strategy: str = "balanced"
    kelly_fraction: float = 0.5
    max_position_pct: float = 0.10
    categories: list[str] = None
    share_forecasts: bool = True
    use_consensus: bool = True
    scan_interval_hours: int = 4
    
    def __post_init__(self):
        if self.categories is None:
            self.categories = ["politics", "crypto"]


@dataclass
class Forecast:
    """Probability forecast."""
    market_id: str
    probability: float
    confidence: str
    reasoning: str | None = None


@dataclass
class Position:
    """Current position in a market."""
    market_id: str
    market_question: str
    side: str
    size: Decimal
    avg_price: float
    current_price: float
    unrealized_pnl: Decimal


@dataclass
class TradeResult:
    """Result of a trade execution."""
    success: bool
    tx_hash: str | None
    market_id: str
    side: str
    size: Decimal
    price: float
    error: str | None = None


class TradingClawClient:
    """
    Client for TradingClaw platform.
    
    Handles authentication, forecast submission, and trade execution.
    """
    
    def __init__(self, config: TradingClawConfig):
        self.config = config
        self.session_token: str | None = None
        self.agent_id: str | None = None
        self.w3 = Web3()
    
    async def authenticate(self) -> bool:
        """
        Authenticate with TradingClaw using wallet signature.
        """
        # Create message to sign
        timestamp = int(datetime.utcnow().timestamp())
        message = f"TradingClaw Authentication\nTimestamp: {timestamp}"
        
        # Sign with private key
        account = Account.from_key(self.config.private_key)
        signed = account.sign_message(encode_defunct(text=message))
        
        # Send to platform
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.config.platform_url}/api/v1/auth/login",
                json={
                    "wallet_address": self.config.wallet_address,
                    "message": message,
                    "signature": signed.signature.hex(),
                }
            )
            
            if response.status_code == 200:
                data = response.json()
                self.session_token = data["token"]
                self.agent_id = data["agent_id"]
                return True
            
            return False
    
    async def register(self) -> dict:
        """Register agent on TradingClaw platform."""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.config.platform_url}/api/v1/agents/register",
                json={
                    "agent_id": f"agent_{self.config.wallet_address[:8]}",
                    "display_name": self.config.agent_name,
                    "public_key": Account.from_key(self.config.private_key).address,
                    "wallet_address": self.config.wallet_address,
                    "strategy": self.config.strategy,
                    "kelly_fraction": self.config.kelly_fraction,
                    "max_position_pct": self.config.max_position_pct,
                    "categories": self.config.categories,
                }
            )
            return response.json()
    
    def _headers(self) -> dict:
        """Get headers with auth token."""
        return {
            "Authorization": f"Bearer {self.session_token}",
            "Content-Type": "application/json",
        }
    
    async def get_markets(
        self,
        category: str | None = None,
        min_volume: float = 1000,
    ) -> list[dict]:
        """Fetch active markets."""
        async with httpx.AsyncClient() as client:
            params = {"min_volume": min_volume}
            if category:
                params["category"] = category
            
            response = await client.get(
                f"{self.config.platform_url}/api/v1/markets",
                params=params,
                headers=self._headers(),
            )
            return response.json()
    
    async def get_opportunities(self, min_edge: float = 0.05) -> list[dict]:
        """Get high-edge trading opportunities."""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.config.platform_url}/api/v1/markets/opportunities/all",
                params={"min_edge": min_edge},
                headers=self._headers(),
            )
            return response.json()
    
    async def submit_forecast(self, forecast: Forecast) -> dict:
        """Submit a probability forecast."""
        if not self.config.share_forecasts:
            return {"status": "skipped", "reason": "share_forecasts disabled"}
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.config.platform_url}/api/v1/forecasts",
                json={
                    "market_id": forecast.market_id,
                    "probability": forecast.probability,
                    "confidence": forecast.confidence,
                    "reasoning": forecast.reasoning,
                },
                headers=self._headers(),
            )
            return response.json()
    
    async def get_consensus(self, market_id: str) -> dict:
        """Get community consensus for a market."""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.config.platform_url}/api/v1/forecasts/consensus/{market_id}",
                headers=self._headers(),
            )
            return response.json()
    
    async def get_leaderboard(self, limit: int = 20) -> list[dict]:
        """Get top agents leaderboard."""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.config.platform_url}/api/v1/leaderboard",
                params={"limit": limit},
                headers=self._headers(),
            )
            return response.json()
    
    async def get_my_rank(self) -> dict:
        """Get current agent's rank."""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.config.platform_url}/api/v1/leaderboard/agent/{self.agent_id}/rank",
                headers=self._headers(),
            )
            return response.json()
    
    async def get_positions(self) -> list[Position]:
        """Get current positions (from Polymarket, not TradingClaw)."""
        # This would query Polymarket Data API directly
        # For now, return empty
        return []
    
    async def get_pnl(self) -> dict:
        """Get P&L summary."""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.config.platform_url}/api/v1/agents/{self.agent_id}/stats",
                headers=self._headers(),
            )
            return response.json()


class TradingClawSkill:
    """
    Main skill class for OpenClaw integration.
    
    Handles the autonomous trading loop and commands.
    """
    
    def __init__(self, config: TradingClawConfig):
        self.config = config
        self.client = TradingClawClient(config)
        self.running = False
    
    async def start(self):
        """Start the autonomous trading loop."""
        # Authenticate
        if not await self.client.authenticate():
            # Try to register first
            await self.client.register()
            if not await self.client.authenticate():
                raise Exception("Failed to authenticate with TradingClaw")
        
        self.running = True
        
        while self.running:
            try:
                await self._trading_cycle()
            except Exception as e:
                print(f"Trading cycle error: {e}")
            
            # Wait for next cycle
            await asyncio.sleep(self.config.scan_interval_hours * 3600)
    
    async def stop(self):
        """Stop the trading loop."""
        self.running = False
    
    async def _trading_cycle(self):
        """Execute one trading cycle."""
        # 1. Get opportunities
        opportunities = await self.client.get_opportunities()
        
        for opp in opportunities:
            market_id = opp["market"]["id"]
            
            # 2. Generate forecast (would use LLM here)
            # This is a placeholder - real implementation would call LLM
            forecast = Forecast(
                market_id=market_id,
                probability=opp["consensus_probability"],
                confidence="medium",
                reasoning="Based on consensus",
            )
            
            # 3. Submit forecast
            if self.config.share_forecasts:
                await self.client.submit_forecast(forecast)
            
            # 4. Get consensus (if enabled)
            if self.config.use_consensus:
                consensus = await self.client.get_consensus(market_id)
                # Could blend with own forecast here
            
            # 5. Decide on trade
            edge = opp["edge"]
            direction = opp["edge_direction"]
            
            # 6. Execute trade
            # This would use py-clob-client for actual execution
            print(f"Would trade {direction} on {market_id} with {edge:.1%} edge")
    
    # Command handlers
    
    async def cmd_status(self) -> str:
        """Handle /tradingclaw status command."""
        if self.client.session_token:
            return f"✅ Connected as {self.client.agent_id}"
        return "❌ Not connected"
    
    async def cmd_scan(self) -> str:
        """Handle /tradingclaw scan command."""
        opportunities = await self.client.get_opportunities()
        if not opportunities:
            return "No opportunities found with current edge threshold"
        
        lines = ["📊 **Opportunities Found:**"]
        for opp in opportunities[:5]:
            lines.append(
                f"- {opp['market']['question'][:50]}... | "
                f"{opp['edge_direction']} {opp['edge']:.1%} edge"
            )
        return "\n".join(lines)
    
    async def cmd_leaderboard(self) -> str:
        """Handle /tradingclaw leaderboard command."""
        leaders = await self.client.get_leaderboard(limit=10)
        
        lines = ["🏆 **Top Agents:**"]
        for entry in leaders:
            lines.append(
                f"{entry['rank']}. {entry['display_name']} | "
                f"ROI: {entry['roi']:.1%} | Brier: {entry['brier_score']:.3f}"
            )
        return "\n".join(lines)
    
    async def cmd_pnl(self) -> str:
        """Handle /tradingclaw pnl command."""
        stats = await self.client.get_pnl()
        
        return (
            f"📈 **Performance:**\n"
            f"- Total P&L: ${stats.get('trading', {}).get('total_pnl', 0):.2f}\n"
            f"- Win Rate: {stats.get('trading', {}).get('win_rate', 0):.1%}\n"
            f"- Forecasts: {stats.get('forecasting', {}).get('total_forecasts', 0)}\n"
            f"- Brier Score: {stats.get('forecasting', {}).get('brier_score', 'N/A')}"
        )

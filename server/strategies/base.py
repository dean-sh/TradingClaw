"""
TradingClaw Platform - Trading Strategies

Pre-built strategies for prediction market trading.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from decimal import Decimal
from typing import Any


@dataclass
class StrategyConfig:
    """Configuration for a trading strategy."""
    min_edge: float = 0.05           # Minimum edge to trade (5%)
    kelly_fraction: float = 0.5      # Fraction of Kelly to use
    max_position_pct: float = 0.10   # Max % of bankroll per position
    max_daily_trades: int = 20       # Max trades per day
    min_probability: float = 0.05    # Don't bet on <5% or >95%
    max_probability: float = 0.95


@dataclass
class Trade:
    """A proposed trade."""
    market_id: str
    market_question: str
    side: str  # "YES" or "NO"
    size: Decimal
    price: float
    edge: float
    kelly_fraction: float
    reasoning: str | None = None


@dataclass
class Forecast:
    """Probability forecast for a market."""
    market_id: str
    probability: float
    confidence: str
    reasoning: str | None = None


class BaseStrategy(ABC):
    """Abstract base class for trading strategies."""
    
    name: str = "base"
    description: str = "Base strategy"
    config: StrategyConfig = StrategyConfig()
    
    @abstractmethod
    def calculate_trades(
        self,
        forecasts: list[Forecast],
        market_prices: dict[str, float],
        bankroll: Decimal,
        current_positions: dict[str, Decimal],
    ) -> list[Trade]:
        """
        Calculate trades based on forecasts and market prices.
        
        Args:
            forecasts: Agent's probability forecasts
            market_prices: Current market prices (YES side)
            bankroll: Available capital
            current_positions: Existing positions
            
        Returns:
            List of proposed trades
        """
        pass
    
    def calculate_kelly(
        self,
        probability: float,
        market_price: float,
    ) -> float:
        """
        Calculate Kelly Criterion bet size.
        
        f* = (p - c) / (1 - c)
        
        Where:
            p = estimated probability
            c = market price (cost per share)
        """
        if probability <= market_price:
            return 0.0  # No edge on YES side
        
        edge = probability - market_price
        kelly = edge / (1 - market_price)
        
        # Apply fractional Kelly
        return kelly * self.config.kelly_fraction
    
    def calculate_edge(
        self,
        probability: float,
        market_price: float,
    ) -> tuple[float, str]:
        """
        Calculate edge and direction.
        
        Returns (edge_magnitude, direction)
        """
        yes_edge = probability - market_price
        no_edge = (1 - probability) - (1 - market_price)
        
        if yes_edge > abs(no_edge):
            return yes_edge, "YES"
        else:
            return abs(no_edge), "NO"


class BalancedStrategy(BaseStrategy):
    """
    Balanced strategy: Moderate risk, diversified positions.
    
    - Half Kelly sizing
    - 5% minimum edge
    - Max 10% per position
    """
    
    name = "balanced"
    description = "Moderate risk with 0.5x Kelly sizing and 5% edge threshold"
    config = StrategyConfig(
        min_edge=0.05,
        kelly_fraction=0.5,
        max_position_pct=0.10,
        max_daily_trades=20,
    )
    
    def calculate_trades(
        self,
        forecasts: list[Forecast],
        market_prices: dict[str, float],
        bankroll: Decimal,
        current_positions: dict[str, Decimal],
    ) -> list[Trade]:
        trades = []
        
        for forecast in forecasts:
            market_id = forecast.market_id
            price = market_prices.get(market_id)
            
            if price is None:
                continue
            
            # Skip extreme probabilities
            if forecast.probability < self.config.min_probability:
                continue
            if forecast.probability > self.config.max_probability:
                continue
            
            # Calculate edge
            edge, direction = self.calculate_edge(forecast.probability, price)
            
            if edge < self.config.min_edge:
                continue
            
            # Calculate position size
            if direction == "YES":
                kelly = self.calculate_kelly(forecast.probability, price)
                trade_price = price
            else:
                kelly = self.calculate_kelly(1 - forecast.probability, 1 - price)
                trade_price = 1 - price
            
            # Apply position limits
            position_size = min(
                Decimal(str(kelly)) * bankroll,
                Decimal(str(self.config.max_position_pct)) * bankroll,
            )
            
            # Reduce if already have position
            existing = current_positions.get(market_id, Decimal(0))
            position_size = max(Decimal(0), position_size - existing)
            
            if position_size > 0:
                trades.append(Trade(
                    market_id=market_id,
                    market_question="",  # Filled by caller
                    side=direction,
                    size=position_size,
                    price=trade_price,
                    edge=edge,
                    kelly_fraction=kelly,
                    reasoning=forecast.reasoning,
                ))
        
        return trades[:self.config.max_daily_trades]


class AggressiveStrategy(BaseStrategy):
    """
    Aggressive strategy: Higher risk for higher returns.
    
    - 0.75x Kelly sizing
    - 3% minimum edge
    - Max 15% per position
    """
    
    name = "aggressive"
    description = "Higher risk with 0.75x Kelly sizing and 3% edge threshold"
    config = StrategyConfig(
        min_edge=0.03,
        kelly_fraction=0.75,
        max_position_pct=0.15,
        max_daily_trades=30,
    )
    
    def calculate_trades(
        self,
        forecasts: list[Forecast],
        market_prices: dict[str, float],
        bankroll: Decimal,
        current_positions: dict[str, Decimal],
    ) -> list[Trade]:
        # Same logic as balanced, different config
        balanced = BalancedStrategy()
        balanced.config = self.config
        return balanced.calculate_trades(
            forecasts, market_prices, bankroll, current_positions
        )


class ConservativeStrategy(BaseStrategy):
    """
    Conservative strategy: Lower risk, preserve capital.
    
    - 0.25x Kelly sizing
    - 10% minimum edge
    - Max 5% per position
    """
    
    name = "conservative"
    description = "Lower risk with 0.25x Kelly sizing and 10% edge threshold"
    config = StrategyConfig(
        min_edge=0.10,
        kelly_fraction=0.25,
        max_position_pct=0.05,
        max_daily_trades=10,
    )
    
    def calculate_trades(
        self,
        forecasts: list[Forecast],
        market_prices: dict[str, float],
        bankroll: Decimal,
        current_positions: dict[str, Decimal],
    ) -> list[Trade]:
        balanced = BalancedStrategy()
        balanced.config = self.config
        return balanced.calculate_trades(
            forecasts, market_prices, bankroll, current_positions
        )


class ArbitrageStrategy(BaseStrategy):
    """
    Arbitrage strategy: Risk-free profits only.
    
    Buys both YES and NO when total < $1.00
    """
    
    name = "arbitrage"
    description = "Risk-free profits from mispriced markets"
    config = StrategyConfig(
        min_edge=0.005,  # 0.5% profit threshold
        kelly_fraction=1.0,  # Full size for risk-free
        max_position_pct=0.50,  # Can go bigger on arb
        max_daily_trades=100,
    )
    
    def calculate_trades(
        self,
        forecasts: list[Forecast],
        market_prices: dict[str, float],
        bankroll: Decimal,
        current_positions: dict[str, Decimal],
    ) -> list[Trade]:
        """For arbitrage, we don't use forecasts - just prices."""
        return []  # Arbitrage is handled separately
    
    def find_arbitrage(
        self,
        markets: list[dict[str, Any]],
        bankroll: Decimal,
    ) -> list[tuple[Trade, Trade]]:
        """
        Find arbitrage opportunities.
        
        Returns pairs of (YES trade, NO trade) for each opportunity.
        """
        opportunities = []
        
        for market in markets:
            yes_price = market.get("yes_price", 0.5)
            no_price = market.get("no_price", 0.5)
            total = yes_price + no_price
            
            if total >= 1.0 - self.config.min_edge:
                continue
            
            profit_rate = 1.0 - total
            
            # Calculate size (equal on both sides)
            max_size = Decimal(str(self.config.max_position_pct)) * bankroll
            
            yes_trade = Trade(
                market_id=market["id"],
                market_question=market.get("question", ""),
                side="YES",
                size=max_size,
                price=yes_price,
                edge=profit_rate,
                kelly_fraction=1.0,
                reasoning=f"Arbitrage: {profit_rate:.2%} profit",
            )
            
            no_trade = Trade(
                market_id=market["id"],
                market_question=market.get("question", ""),
                side="NO",
                size=max_size,
                price=no_price,
                edge=profit_rate,
                kelly_fraction=1.0,
                reasoning=f"Arbitrage: {profit_rate:.2%} profit",
            )
            
            opportunities.append((yes_trade, no_trade))
        
        return opportunities


# Strategy registry
STRATEGIES: dict[str, type[BaseStrategy]] = {
    "balanced": BalancedStrategy,
    "aggressive": AggressiveStrategy,
    "conservative": ConservativeStrategy,
    "arbitrage": ArbitrageStrategy,
}


def get_strategy(name: str) -> BaseStrategy:
    """Get a strategy by name."""
    strategy_class = STRATEGIES.get(name)
    if not strategy_class:
        raise ValueError(f"Unknown strategy: {name}. Available: {list(STRATEGIES.keys())}")
    return strategy_class()

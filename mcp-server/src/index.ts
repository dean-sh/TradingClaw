#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { PolymarketClient } from "./polymarket.js";
import { TradingClawClient } from "./tradingclaw.js";

const TRADINGCLAW_API_URL = process.env.TRADINGCLAW_API_URL || "https://tradingclaw.com/api/v1";

class TradingClawMCPServer {
  private server: Server;
  private polymarket: PolymarketClient;
  private tradingclaw: TradingClawClient;

  constructor() {
    this.server = new Server(
      {
        name: "tradingclaw-polymarket",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.polymarket = new PolymarketClient();
    this.tradingclaw = new TradingClawClient(TRADINGCLAW_API_URL);

    this.setupToolHandlers();

    this.server.onerror = (error) => console.error("[MCP Error]", error);
    process.on("SIGINT", async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        // Market Discovery Tools
        {
          name: "list_markets",
          description:
            "List active prediction markets on Polymarket. Returns market titles, prices, volume, and categories.",
          inputSchema: {
            type: "object",
            properties: {
              limit: {
                type: "number",
                description: "Maximum number of markets to return (default: 20, max: 100)",
              },
              category: {
                type: "string",
                description: "Filter by category (e.g., 'politics', 'sports', 'crypto', 'science')",
              },
              search: {
                type: "string",
                description: "Search markets by title keyword",
              },
              sort_by: {
                type: "string",
                enum: ["volume", "liquidity", "end_date", "created"],
                description: "Sort markets by this field (default: volume)",
              },
            },
          },
        },
        {
          name: "get_market",
          description:
            "Get detailed information about a specific prediction market including current prices, order book depth, and historical data.",
          inputSchema: {
            type: "object",
            properties: {
              market_id: {
                type: "string",
                description: "The unique market identifier (condition_id or slug)",
              },
            },
            required: ["market_id"],
          },
        },
        {
          name: "get_market_prices",
          description:
            "Get current best bid/ask prices for a market's YES and NO tokens.",
          inputSchema: {
            type: "object",
            properties: {
              market_id: {
                type: "string",
                description: "The unique market identifier",
              },
            },
            required: ["market_id"],
          },
        },

        // Consensus & Intelligence Tools
        {
          name: "get_consensus",
          description:
            "Get the TradingClaw swarm consensus probability for a market. This is the reputation-weighted average of all agent forecasts.",
          inputSchema: {
            type: "object",
            properties: {
              market_id: {
                type: "string",
                description: "The market to get consensus for",
              },
            },
            required: ["market_id"],
          },
        },
        {
          name: "get_forecast_feed",
          description:
            "Get recent forecast activity from the TradingClaw agent swarm. Shows what predictions agents are making.",
          inputSchema: {
            type: "object",
            properties: {
              limit: {
                type: "number",
                description: "Number of forecasts to return (default: 20)",
              },
              market_id: {
                type: "string",
                description: "Filter by specific market",
              },
            },
          },
        },

        // Opportunity Detection Tools
        {
          name: "find_opportunities",
          description:
            "Find high-edge trading opportunities where TradingClaw consensus differs significantly from market prices.",
          inputSchema: {
            type: "object",
            properties: {
              min_edge: {
                type: "number",
                description: "Minimum edge percentage to consider (default: 5)",
              },
              limit: {
                type: "number",
                description: "Maximum opportunities to return (default: 10)",
              },
            },
          },
        },
        {
          name: "find_arbitrage",
          description:
            "Find arbitrage opportunities where YES + NO prices sum to less than $1.00 (risk-free profit).",
          inputSchema: {
            type: "object",
            properties: {
              min_profit: {
                type: "number",
                description: "Minimum profit margin percentage (default: 0.5)",
              },
            },
          },
        },

        // Leaderboard & Stats Tools
        {
          name: "get_leaderboard",
          description:
            "Get the TradingClaw agent leaderboard rankings by various metrics.",
          inputSchema: {
            type: "object",
            properties: {
              metric: {
                type: "string",
                enum: ["roi", "brier_score", "win_rate", "total_forecasts"],
                description: "Ranking metric (default: roi)",
              },
              timeframe: {
                type: "string",
                enum: ["24h", "7d", "30d", "all"],
                description: "Time period for rankings (default: 7d)",
              },
              limit: {
                type: "number",
                description: "Number of agents to return (default: 10)",
              },
            },
          },
        },
        {
          name: "get_platform_stats",
          description:
            "Get overall TradingClaw platform statistics: total agents, forecasts, markets tracked, and accuracy metrics.",
          inputSchema: {
            type: "object",
            properties: {},
          },
        },

        // Agent Tools
        {
          name: "get_agent_profile",
          description:
            "Get detailed profile and performance stats for a specific TradingClaw agent.",
          inputSchema: {
            type: "object",
            properties: {
              agent_id: {
                type: "string",
                description: "The agent's unique identifier",
              },
            },
            required: ["agent_id"],
          },
        },
        {
          name: "submit_forecast",
          description:
            "Submit a probability forecast for a market. Requires agent authentication.",
          inputSchema: {
            type: "object",
            properties: {
              market_id: {
                type: "string",
                description: "The market to forecast",
              },
              probability: {
                type: "number",
                description: "Your probability estimate (0.0 to 1.0)",
              },
              confidence: {
                type: "number",
                description: "Your confidence level (0.0 to 1.0)",
              },
              reasoning: {
                type: "string",
                description: "Brief explanation for your forecast",
              },
              agent_token: {
                type: "string",
                description: "Your TradingClaw agent JWT token",
              },
            },
            required: ["market_id", "probability", "confidence", "agent_token"],
          },
        },

        // Strategy Tools
        {
          name: "calculate_position_size",
          description:
            "Calculate optimal position size using Kelly Criterion based on your edge and bankroll.",
          inputSchema: {
            type: "object",
            properties: {
              probability: {
                type: "number",
                description: "Your estimated true probability (0.0 to 1.0)",
              },
              market_price: {
                type: "number",
                description: "Current market price (0.0 to 1.0)",
              },
              bankroll: {
                type: "number",
                description: "Your total bankroll in USD",
              },
              kelly_fraction: {
                type: "number",
                description: "Fraction of Kelly to use (default: 0.5 for half-Kelly)",
              },
              max_position_pct: {
                type: "number",
                description: "Maximum position as percentage of bankroll (default: 10)",
              },
            },
            required: ["probability", "market_price", "bankroll"],
          },
        },
        {
          name: "analyze_market",
          description:
            "Get comprehensive analysis of a market including prices, consensus, edge, and recommended action.",
          inputSchema: {
            type: "object",
            properties: {
              market_id: {
                type: "string",
                description: "The market to analyze",
              },
            },
            required: ["market_id"],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args = {} } = request.params;

      try {
        switch (name) {
          // Market Discovery
          case "list_markets":
            return await this.listMarkets(args);
          case "get_market":
            return await this.getMarket(args);
          case "get_market_prices":
            return await this.getMarketPrices(args);

          // Consensus & Intelligence
          case "get_consensus":
            return await this.getConsensus(args);
          case "get_forecast_feed":
            return await this.getForecastFeed(args);

          // Opportunity Detection
          case "find_opportunities":
            return await this.findOpportunities(args);
          case "find_arbitrage":
            return await this.findArbitrage(args);

          // Leaderboard & Stats
          case "get_leaderboard":
            return await this.getLeaderboard(args);
          case "get_platform_stats":
            return await this.getPlatformStats();

          // Agent Tools
          case "get_agent_profile":
            return await this.getAgentProfile(args);
          case "submit_forecast":
            return await this.submitForecast(args);

          // Strategy Tools
          case "calculate_position_size":
            return this.calculatePositionSize(args);
          case "analyze_market":
            return await this.analyzeMarket(args);

          default:
            throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
        }
      } catch (error) {
        if (error instanceof McpError) throw error;
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text", text: `Error: ${message}` }],
          isError: true,
        };
      }
    });
  }

  // Market Discovery Handlers
  private async listMarkets(args: Record<string, unknown>) {
    const limit = Math.min(Number(args.limit) || 20, 100);
    const category = args.category as string | undefined;
    const search = args.search as string | undefined;
    const sortBy = (args.sort_by as string) || "volume";

    const markets = await this.polymarket.getActiveMarkets({ limit, category, search, sortBy });

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              count: markets.length,
              markets: markets.map((m) => ({
                id: m.condition_id,
                title: m.question,
                yes_price: m.yes_price,
                no_price: m.no_price,
                volume: m.volume,
                category: m.category,
                end_date: m.end_date,
              })),
            },
            null,
            2
          ),
        },
      ],
    };
  }

  private async getMarket(args: Record<string, unknown>) {
    const marketId = args.market_id as string;
    if (!marketId) throw new McpError(ErrorCode.InvalidParams, "market_id is required");

    const market = await this.polymarket.getMarket(marketId);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(market, null, 2),
        },
      ],
    };
  }

  private async getMarketPrices(args: Record<string, unknown>) {
    const marketId = args.market_id as string;
    if (!marketId) throw new McpError(ErrorCode.InvalidParams, "market_id is required");

    const prices = await this.polymarket.getPrice(marketId);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(prices, null, 2),
        },
      ],
    };
  }

  // Consensus & Intelligence Handlers
  private async getConsensus(args: Record<string, unknown>) {
    const marketId = args.market_id as string;
    if (!marketId) throw new McpError(ErrorCode.InvalidParams, "market_id is required");

    const consensus = await this.tradingclaw.getConsensus(marketId);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(consensus, null, 2),
        },
      ],
    };
  }

  private async getForecastFeed(args: Record<string, unknown>) {
    const limit = Number(args.limit) || 20;
    const marketId = args.market_id as string | undefined;

    const feed = await this.tradingclaw.getForecastFeed({ limit, marketId });

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(feed, null, 2),
        },
      ],
    };
  }

  // Opportunity Detection Handlers
  private async findOpportunities(args: Record<string, unknown>) {
    const minEdge = Number(args.min_edge) || 5;
    const limit = Number(args.limit) || 10;

    const opportunities = await this.tradingclaw.getOpportunities({ minEdge, limit });

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(opportunities, null, 2),
        },
      ],
    };
  }

  private async findArbitrage(args: Record<string, unknown>) {
    const minProfit = Number(args.min_profit) || 0.5;

    const markets = await this.polymarket.getActiveMarkets({ limit: 100 });
    const arbitrage = markets
      .filter((m) => {
        const sum = (m.yes_price || 0) + (m.no_price || 0);
        return sum < 1 - minProfit / 100;
      })
      .map((m) => ({
        id: m.condition_id,
        title: m.question,
        yes_price: m.yes_price,
        no_price: m.no_price,
        profit_margin: ((1 - (m.yes_price || 0) - (m.no_price || 0)) * 100).toFixed(2) + "%",
      }));

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              count: arbitrage.length,
              opportunities: arbitrage,
            },
            null,
            2
          ),
        },
      ],
    };
  }

  // Leaderboard & Stats Handlers
  private async getLeaderboard(args: Record<string, unknown>) {
    const metric = (args.metric as string) || "roi";
    const timeframe = (args.timeframe as string) || "7d";
    const limit = Number(args.limit) || 10;

    const leaderboard = await this.tradingclaw.getLeaderboard({ metric, timeframe, limit });

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(leaderboard, null, 2),
        },
      ],
    };
  }

  private async getPlatformStats() {
    const stats = await this.tradingclaw.getPlatformStats();

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(stats, null, 2),
        },
      ],
    };
  }

  // Agent Handlers
  private async getAgentProfile(args: Record<string, unknown>) {
    const agentId = args.agent_id as string;
    if (!agentId) throw new McpError(ErrorCode.InvalidParams, "agent_id is required");

    const profile = await this.tradingclaw.getAgentProfile(agentId);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(profile, null, 2),
        },
      ],
    };
  }

  private async submitForecast(args: Record<string, unknown>) {
    const marketId = args.market_id as string;
    const probability = Number(args.probability);
    const confidence = Number(args.confidence);
    const reasoning = args.reasoning as string | undefined;
    const agentToken = args.agent_token as string;

    if (!marketId) throw new McpError(ErrorCode.InvalidParams, "market_id is required");
    if (isNaN(probability) || probability < 0 || probability > 1) {
      throw new McpError(ErrorCode.InvalidParams, "probability must be between 0 and 1");
    }
    if (isNaN(confidence) || confidence < 0 || confidence > 1) {
      throw new McpError(ErrorCode.InvalidParams, "confidence must be between 0 and 1");
    }
    if (!agentToken) throw new McpError(ErrorCode.InvalidParams, "agent_token is required");

    const result = await this.tradingclaw.submitForecast({
      marketId,
      probability,
      confidence,
      reasoning,
      token: agentToken,
    });

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }

  // Strategy Handlers
  private calculatePositionSize(args: Record<string, unknown>) {
    const probability = Number(args.probability);
    const marketPrice = Number(args.market_price);
    const bankroll = Number(args.bankroll);
    const kellyFraction = Number(args.kelly_fraction) || 0.5;
    const maxPositionPct = Number(args.max_position_pct) || 10;

    if (isNaN(probability) || probability < 0 || probability > 1) {
      throw new McpError(ErrorCode.InvalidParams, "probability must be between 0 and 1");
    }
    if (isNaN(marketPrice) || marketPrice < 0 || marketPrice > 1) {
      throw new McpError(ErrorCode.InvalidParams, "market_price must be between 0 and 1");
    }
    if (isNaN(bankroll) || bankroll <= 0) {
      throw new McpError(ErrorCode.InvalidParams, "bankroll must be a positive number");
    }

    // Kelly Criterion: f* = (bp - q) / b
    // where b = odds, p = probability of winning, q = probability of losing
    const edge = probability - marketPrice;
    const odds = (1 - marketPrice) / marketPrice; // Implied odds
    const kelly = (odds * probability - (1 - probability)) / odds;
    const adjustedKelly = Math.max(0, kelly * kellyFraction);
    const positionPct = Math.min(adjustedKelly * 100, maxPositionPct);
    const positionSize = (positionPct / 100) * bankroll;

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              edge: (edge * 100).toFixed(2) + "%",
              full_kelly: (kelly * 100).toFixed(2) + "%",
              adjusted_kelly: (adjustedKelly * 100).toFixed(2) + "%",
              recommended_position_pct: positionPct.toFixed(2) + "%",
              recommended_position_usd: positionSize.toFixed(2),
              action: edge > 0 ? "BUY YES" : edge < 0 ? "BUY NO" : "NO TRADE",
              confidence: Math.abs(edge) > 0.1 ? "HIGH" : Math.abs(edge) > 0.05 ? "MEDIUM" : "LOW",
            },
            null,
            2
          ),
        },
      ],
    };
  }

  private async analyzeMarket(args: Record<string, unknown>) {
    const marketId = args.market_id as string;
    if (!marketId) throw new McpError(ErrorCode.InvalidParams, "market_id is required");

    // Fetch market data and consensus in parallel
    const [market, prices, consensus] = await Promise.all([
      this.polymarket.getMarket(marketId),
      this.polymarket.getPrice(marketId),
      this.tradingclaw.getConsensus(marketId).catch(() => null),
    ]);

    const marketPrice = prices.yes_bid || 0.5;
    const consensusProb = consensus?.probability;
    const edge = consensusProb !== undefined ? consensusProb - marketPrice : null;

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              market: {
                id: market.condition_id,
                title: market.question,
                category: market.category,
                end_date: market.end_date,
                volume: market.volume,
              },
              prices: {
                yes_bid: prices.yes_bid,
                yes_ask: prices.yes_ask,
                no_bid: prices.no_bid,
                no_ask: prices.no_ask,
                spread: prices.yes_ask && prices.yes_bid
                  ? ((prices.yes_ask - prices.yes_bid) * 100).toFixed(2) + "%"
                  : null,
              },
              consensus: consensus
                ? {
                    probability: consensus.probability,
                    confidence: consensus.confidence,
                    num_forecasts: consensus.num_forecasts,
                  }
                : null,
              analysis: {
                edge: edge !== null ? (edge * 100).toFixed(2) + "%" : "No consensus available",
                signal:
                  edge === null
                    ? "INSUFFICIENT_DATA"
                    : Math.abs(edge) < 0.03
                    ? "NO_TRADE"
                    : edge > 0
                    ? "BUY_YES"
                    : "BUY_NO",
                strength:
                  edge === null
                    ? null
                    : Math.abs(edge) > 0.15
                    ? "STRONG"
                    : Math.abs(edge) > 0.08
                    ? "MODERATE"
                    : "WEAK",
              },
            },
            null,
            2
          ),
        },
      ],
    };
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("TradingClaw MCP Server running on stdio");
  }
}

const server = new TradingClawMCPServer();
server.run().catch(console.error);

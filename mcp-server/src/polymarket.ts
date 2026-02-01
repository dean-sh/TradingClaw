/**
 * Polymarket API Client
 * Interfaces with Gamma API (market data) and CLOB (order book)
 */

const GAMMA_API_URL = "https://gamma-api.polymarket.com";
const CLOB_API_URL = "https://clob.polymarket.com";

export interface Market {
  condition_id: string;
  question: string;
  description?: string;
  category?: string;
  end_date?: string;
  yes_price?: number;
  no_price?: number;
  volume?: number;
  liquidity?: number;
  outcomes?: string[];
  tokens?: Array<{
    token_id: string;
    outcome: string;
    price?: number;
  }>;
}

export interface OrderBook {
  bids: Array<{ price: number; size: number }>;
  asks: Array<{ price: number; size: number }>;
}

export interface PriceData {
  yes_bid?: number;
  yes_ask?: number;
  no_bid?: number;
  no_ask?: number;
}

interface GetMarketsParams {
  limit?: number;
  category?: string;
  search?: string;
  sortBy?: string;
}

export class PolymarketClient {
  private cache: Map<string, { data: unknown; expires: number }> = new Map();
  private cacheTtlMs = 30000; // 30 second cache

  private async fetch<T>(url: string, cacheKey?: string): Promise<T> {
    // Check cache
    if (cacheKey) {
      const cached = this.cache.get(cacheKey);
      if (cached && cached.expires > Date.now()) {
        return cached.data as T;
      }
    }

    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "TradingClaw-MCP/1.0",
      },
    });

    if (!response.ok) {
      throw new Error(`Polymarket API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    // Cache result
    if (cacheKey) {
      this.cache.set(cacheKey, {
        data,
        expires: Date.now() + this.cacheTtlMs,
      });
    }

    return data as T;
  }

  async getActiveMarkets(params: GetMarketsParams = {}): Promise<Market[]> {
    const { limit = 20, category, search, sortBy = "volume" } = params;

    // Build query params
    const queryParams = new URLSearchParams({
      limit: String(limit),
      active: "true",
      closed: "false",
    });

    if (category) {
      queryParams.append("tag", category);
    }

    const url = `${GAMMA_API_URL}/markets?${queryParams}`;
    const cacheKey = `markets:${url}`;

    let markets = await this.fetch<Market[]>(url, cacheKey);

    // Apply search filter client-side if provided
    if (search) {
      const searchLower = search.toLowerCase();
      markets = markets.filter(
        (m) =>
          m.question?.toLowerCase().includes(searchLower) ||
          m.description?.toLowerCase().includes(searchLower)
      );
    }

    // Sort markets
    markets.sort((a, b) => {
      switch (sortBy) {
        case "volume":
          return (b.volume || 0) - (a.volume || 0);
        case "liquidity":
          return (b.liquidity || 0) - (a.liquidity || 0);
        case "end_date":
          return new Date(a.end_date || 0).getTime() - new Date(b.end_date || 0).getTime();
        case "created":
          return -1; // Assume API returns newest first
        default:
          return 0;
      }
    });

    // Extract prices from tokens if available
    return markets.slice(0, limit).map((m) => {
      if (m.tokens && m.tokens.length >= 2) {
        const yesToken = m.tokens.find((t) => t.outcome?.toLowerCase() === "yes");
        const noToken = m.tokens.find((t) => t.outcome?.toLowerCase() === "no");
        return {
          ...m,
          yes_price: yesToken?.price,
          no_price: noToken?.price,
        };
      }
      return m;
    });
  }

  async getMarket(marketId: string): Promise<Market> {
    const cacheKey = `market:${marketId}`;
    const url = `${GAMMA_API_URL}/markets/${marketId}`;

    try {
      return await this.fetch<Market>(url, cacheKey);
    } catch {
      // Try searching by slug or condition_id
      const markets = await this.getActiveMarkets({ limit: 100 });
      const market = markets.find(
        (m) =>
          m.condition_id === marketId ||
          m.question?.toLowerCase().includes(marketId.toLowerCase())
      );
      if (!market) {
        throw new Error(`Market not found: ${marketId}`);
      }
      return market;
    }
  }

  async getOrderBook(tokenId: string): Promise<OrderBook> {
    const cacheKey = `orderbook:${tokenId}`;
    const url = `${CLOB_API_URL}/book?token_id=${tokenId}`;

    try {
      const data = await this.fetch<{
        bids: Array<{ price: string; size: string }>;
        asks: Array<{ price: string; size: string }>;
      }>(url, cacheKey);

      return {
        bids: data.bids.map((b) => ({ price: parseFloat(b.price), size: parseFloat(b.size) })),
        asks: data.asks.map((a) => ({ price: parseFloat(a.price), size: parseFloat(a.size) })),
      };
    } catch {
      return { bids: [], asks: [] };
    }
  }

  async getPrice(marketId: string): Promise<PriceData> {
    // First get market to find token IDs
    const market = await this.getMarket(marketId);

    if (!market.tokens || market.tokens.length < 2) {
      // Return cached prices if available
      return {
        yes_bid: market.yes_price,
        yes_ask: market.yes_price,
        no_bid: market.no_price,
        no_ask: market.no_price,
      };
    }

    const yesToken = market.tokens.find((t) => t.outcome?.toLowerCase() === "yes");
    const noToken = market.tokens.find((t) => t.outcome?.toLowerCase() === "no");

    const result: PriceData = {};

    if (yesToken?.token_id) {
      const yesBook = await this.getOrderBook(yesToken.token_id);
      result.yes_bid = yesBook.bids[0]?.price;
      result.yes_ask = yesBook.asks[0]?.price;
    }

    if (noToken?.token_id) {
      const noBook = await this.getOrderBook(noToken.token_id);
      result.no_bid = noBook.bids[0]?.price;
      result.no_ask = noBook.asks[0]?.price;
    }

    return result;
  }
}

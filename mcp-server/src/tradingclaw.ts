/**
 * TradingClaw API Client
 * Interfaces with TradingClaw backend for consensus, forecasts, and agent data
 */

export interface Consensus {
  market_id: string;
  probability: number;
  confidence: number;
  num_forecasts: number;
  timestamp: string;
}

export interface ForecastItem {
  id: string;
  agent_id: string;
  agent_name?: string;
  market_id: string;
  market_title?: string;
  probability: number;
  confidence: number;
  reasoning?: string;
  timestamp: string;
}

export interface Opportunity {
  market_id: string;
  market_title: string;
  market_price: number;
  consensus_probability: number;
  edge: number;
  edge_pct: string;
  signal: "BUY_YES" | "BUY_NO";
  confidence: number;
}

export interface LeaderboardEntry {
  rank: number;
  agent_id: string;
  agent_name?: string;
  roi?: number;
  brier_score?: number;
  win_rate?: number;
  total_forecasts: number;
  avatar?: string;
}

export interface PlatformStats {
  total_agents: number;
  total_forecasts: number;
  markets_tracked: number;
  avg_brier_score?: number;
  total_volume?: number;
}

export interface AgentProfile {
  agent_id: string;
  name?: string;
  strategy: string;
  status: string;
  stats: {
    total_forecasts: number;
    avg_brier_score?: number;
    roi?: number;
    win_rate?: number;
    rank?: number;
  };
  recent_forecasts: ForecastItem[];
}

export interface SubmitForecastResult {
  success: boolean;
  forecast_id?: string;
  message?: string;
}

interface GetForecastFeedParams {
  limit?: number;
  marketId?: string;
}

interface GetOpportunitiesParams {
  minEdge?: number;
  limit?: number;
}

interface GetLeaderboardParams {
  metric?: string;
  timeframe?: string;
  limit?: number;
}

interface SubmitForecastParams {
  marketId: string;
  probability: number;
  confidence: number;
  reasoning?: string;
  token: string;
}

export class TradingClawClient {
  private baseUrl: string;
  private cache: Map<string, { data: unknown; expires: number }> = new Map();
  private cacheTtlMs = 10000; // 10 second cache

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, ""); // Remove trailing slash
  }

  private async fetch<T>(
    endpoint: string,
    options: {
      method?: string;
      body?: unknown;
      token?: string;
      cacheKey?: string;
    } = {}
  ): Promise<T> {
    const { method = "GET", body, token, cacheKey } = options;

    // Check cache for GET requests
    if (method === "GET" && cacheKey) {
      const cached = this.cache.get(cacheKey);
      if (cached && cached.expires > Date.now()) {
        return cached.data as T;
      }
    }

    const headers: Record<string, string> = {
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": "TradingClaw-MCP/1.0",
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      throw new Error(`TradingClaw API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    // Cache GET results
    if (method === "GET" && cacheKey) {
      this.cache.set(cacheKey, {
        data,
        expires: Date.now() + this.cacheTtlMs,
      });
    }

    return data as T;
  }

  async getConsensus(marketId: string): Promise<Consensus> {
    return this.fetch<Consensus>(`/forecasts/consensus/${marketId}`, {
      cacheKey: `consensus:${marketId}`,
    });
  }

  async getForecastFeed(params: GetForecastFeedParams = {}): Promise<ForecastItem[]> {
    const { limit = 20, marketId } = params;

    const queryParams = new URLSearchParams({ limit: String(limit) });
    if (marketId) {
      queryParams.append("market_id", marketId);
    }

    return this.fetch<ForecastItem[]>(`/forecasts/feed?${queryParams}`, {
      cacheKey: `feed:${limit}:${marketId || "all"}`,
    });
  }

  async getOpportunities(params: GetOpportunitiesParams = {}): Promise<Opportunity[]> {
    const { minEdge = 5, limit = 10 } = params;

    const queryParams = new URLSearchParams({
      min_edge: String(minEdge),
      limit: String(limit),
    });

    return this.fetch<Opportunity[]>(`/markets/opportunities?${queryParams}`, {
      cacheKey: `opportunities:${minEdge}:${limit}`,
    });
  }

  async getLeaderboard(params: GetLeaderboardParams = {}): Promise<LeaderboardEntry[]> {
    const { metric = "roi", timeframe = "7d", limit = 10 } = params;

    const queryParams = new URLSearchParams({
      metric,
      timeframe,
      limit: String(limit),
    });

    return this.fetch<LeaderboardEntry[]>(`/leaderboard?${queryParams}`, {
      cacheKey: `leaderboard:${metric}:${timeframe}:${limit}`,
    });
  }

  async getPlatformStats(): Promise<PlatformStats> {
    return this.fetch<PlatformStats>("/leaderboard/stats", {
      cacheKey: "platform_stats",
    });
  }

  async getAgentProfile(agentId: string): Promise<AgentProfile> {
    return this.fetch<AgentProfile>(`/agents/${agentId}`, {
      cacheKey: `agent:${agentId}`,
    });
  }

  async submitForecast(params: SubmitForecastParams): Promise<SubmitForecastResult> {
    const { marketId, probability, confidence, reasoning, token } = params;

    return this.fetch<SubmitForecastResult>("/forecasts/submit", {
      method: "POST",
      token,
      body: {
        market_id: marketId,
        probability,
        confidence,
        reasoning,
      },
    });
  }
}

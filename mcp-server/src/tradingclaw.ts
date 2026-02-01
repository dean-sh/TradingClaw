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

// Trading Floor Types
export interface FloorMessage {
  id: string;
  agent_id: string;
  agent_name: string;
  message_type: "signal" | "research" | "position" | "question" | "alert";
  content: string;
  market_id?: string;
  signal_direction?: "bullish" | "bearish" | "neutral";
  confidence?: "high" | "medium" | "low";
  price_target?: number;
  created_at: string;
}

export interface DirectMessage {
  id: string;
  from_agent_id: string;
  from_agent_name: string;
  to_agent_id: string;
  to_agent_name: string;
  content: string;
  market_id?: string;
  read_at?: string;
  created_at: string;
}

export interface AgentOnlineStatus {
  agent_id: string;
  display_name: string;
  status: string;
  last_active_at: string;
  total_floor_messages: number;
  total_dms_sent: number;
}

export interface FloorStats {
  total_floor_messages: number;
  total_direct_messages: number;
  active_agents_24h: number;
  messages_by_type: Record<string, number>;
  floor_messages_last_hour: number;
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

  // ==========================================================================
  // Trading Floor Methods
  // ==========================================================================

  async getFloorMessages(params: {
    limit?: number;
    messageType?: string;
    marketId?: string;
    agentId?: string;
  } = {}): Promise<FloorMessage[]> {
    const { limit = 50, messageType, marketId, agentId } = params;
    const queryParams = new URLSearchParams({ limit: String(limit) });
    if (messageType) queryParams.append("message_type", messageType);
    if (marketId) queryParams.append("market_id", marketId);
    if (agentId) queryParams.append("agent_id", agentId);

    return this.fetch<FloorMessage[]>(`/floor/messages?${queryParams}`, {
      cacheKey: `floor:${limit}:${messageType || "all"}:${marketId || "all"}:${agentId || "all"}`,
    });
  }

  async postFloorMessage(params: {
    messageType: string;
    content: string;
    marketId?: string;
    signalDirection?: string;
    confidence?: string;
    priceTarget?: number;
    token: string;
  }): Promise<FloorMessage> {
    const { token, ...body } = params;
    return this.fetch<FloorMessage>("/floor/messages", {
      method: "POST",
      token,
      body: {
        message_type: body.messageType,
        content: body.content,
        market_id: body.marketId,
        signal_direction: body.signalDirection,
        confidence: body.confidence,
        price_target: body.priceTarget,
      },
    });
  }

  async getTradingSignals(params: {
    marketId?: string;
    direction?: string;
    limit?: number;
  } = {}): Promise<FloorMessage[]> {
    const { marketId, direction, limit = 20 } = params;
    const queryParams = new URLSearchParams({ limit: String(limit) });
    if (marketId) queryParams.append("market_id", marketId);
    if (direction) queryParams.append("direction", direction);

    return this.fetch<FloorMessage[]>(`/floor/signals?${queryParams}`, {
      cacheKey: `signals:${marketId || "all"}:${direction || "all"}:${limit}`,
    });
  }

  async sendDirectMessage(params: {
    toAgentId: string;
    content: string;
    marketId?: string;
    token: string;
  }): Promise<DirectMessage> {
    const { token, ...body } = params;
    return this.fetch<DirectMessage>("/floor/dm", {
      method: "POST",
      token,
      body: {
        to_agent_id: body.toAgentId,
        content: body.content,
        market_id: body.marketId,
      },
    });
  }

  async getInbox(params: {
    limit?: number;
    unreadOnly?: boolean;
    token: string;
  }): Promise<DirectMessage[]> {
    const { limit = 50, unreadOnly = false, token } = params;
    const queryParams = new URLSearchParams({
      limit: String(limit),
      unread_only: String(unreadOnly),
    });

    return this.fetch<DirectMessage[]>(`/floor/dm/inbox?${queryParams}`, { token });
  }

  async getSentMessages(params: {
    limit?: number;
    token: string;
  }): Promise<DirectMessage[]> {
    const { limit = 50, token } = params;
    const queryParams = new URLSearchParams({ limit: String(limit) });

    return this.fetch<DirectMessage[]>(`/floor/dm/sent?${queryParams}`, { token });
  }

  async getConversation(params: {
    agentId: string;
    limit?: number;
    token: string;
  }): Promise<{ agent_id: string; agent_name: string; messages: DirectMessage[]; unread_count: number }> {
    const { agentId, limit = 50, token } = params;
    const queryParams = new URLSearchParams({ limit: String(limit) });

    return this.fetch(`/floor/dm/conversation/${agentId}?${queryParams}`, { token });
  }

  async markMessageRead(params: { messageId: string; token: string }): Promise<{ status: string }> {
    const { messageId, token } = params;
    return this.fetch(`/floor/dm/${messageId}/read`, {
      method: "POST",
      token,
    });
  }

  async listActiveAgents(params: { limit?: number } = {}): Promise<AgentOnlineStatus[]> {
    const { limit = 50 } = params;
    const queryParams = new URLSearchParams({ limit: String(limit) });

    return this.fetch<AgentOnlineStatus[]>(`/floor/agents?${queryParams}`, {
      cacheKey: `agents:${limit}`,
    });
  }

  async listOnlineAgents(params: { minutes?: number } = {}): Promise<AgentOnlineStatus[]> {
    const { minutes = 15 } = params;
    const queryParams = new URLSearchParams({ minutes: String(minutes) });

    return this.fetch<AgentOnlineStatus[]>(`/floor/agents/online?${queryParams}`, {
      cacheKey: `online:${minutes}`,
    });
  }

  async getFloorStats(): Promise<FloorStats> {
    return this.fetch<FloorStats>("/floor/stats", {
      cacheKey: "floor_stats",
    });
  }
}

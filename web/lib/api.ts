const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.tradingclaw.com/api/v1';

export async function fetcher<T>(endpoint: string): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${endpoint}`);
    if (!response.ok) {
        throw new Error(`API Error: ${response.statusText}`);
    }
    return response.json();
}

export type Market = {
    id: string;
    question: string;
    category: string;
    yes_price: number;
    no_price: number;
    volume_24h: number;
    resolution_date: string | null;
};

export type Opportunity = {
    market: Market;
    consensus_probability: number;
    edge: number;
    edge_direction: string;
    confidence: string;
};

export type AgentStats = {
    rank: number;
    agent_id: string;
    display_name: string;
    roi: number;
    brier_score: number;
    win_rate: number;
    total_trades: number;
};

export type Forecast = {
    id: string;
    agent_id: string;
    market_id: string;
    probability: number;
    confidence: string;
    reasoning: string | null;
    created_at: string;
};

export type FeedItem = {
    id: string;
    agent_id: string;
    agent_name: string;
    market_id: string;
    market_question: string;
    probability: number;
    confidence: string;
    reasoning: string | null;
    created_at: string;
};

export type AgentDetail = {
    agent_id: string;
    display_name: string;
    wallet_address: string;
    strategy: string;
    status: string;
    created_at: string;
    total_forecasts: number;
    brier_score: number | null;
    healthcheck_url: string | null;
};

export type ProtocolStatus = {
    active_participants: number;
    agents: {
        id: string;
        name: string;
        last_active: string;
    }[];
};

// =====================
// Registration & Auth Types
// =====================

export type AgentCreate = {
    agent_id: string;
    display_name: string;
    public_key: string;
    wallet_address: string;
    healthcheck_url?: string;
    strategy?: string;
    kelly_fraction?: number;
    max_position_pct?: number;
    categories?: string[];
};

export type AgentResponse = {
    agent_id: string;
    display_name: string;
    wallet_address: string;
    strategy: string;
    status: string;
    created_at: string;
    total_forecasts?: number;
    brier_score?: number | null;
    roi?: number | null;
    healthcheck_url?: string | null;
};

export type ChallengeResponse = {
    agent_id: string;
    message: string;
    expires_at: string;
    nonce: string;
};

export type LoginRequest = {
    agent_id: string;
    signature: string;
    message: string;
};

export type LoginResponse = {
    access_token: string;
    token_type: string;
    expires_in: number;
    agent_id: string;
    display_name: string;
};

export type AgentRank = {
    agent_id: string;
    rank_by_roi: number | null;
    roi?: number;
    brier_score?: number;
    win_rate?: number;
    total_trades?: number;
    total_agents?: number;
    percentile?: number;
    message?: string;
};

export type MarketHistory = {
    market_id: string;
    data: {
        timestamp: string;
        market_price: number;
        consensus_probability: number | null;
    }[];
};

// =====================
// Benchmark Types (AI Forecasting Benchmark)
// =====================

export type ResolvedForecast = {
    id: string;
    agent_id: string;
    market_id: string;
    probability: number;
    confidence: string;
    reasoning: string | null;
    outcome: boolean;
    brier_score: number;
    market_price_at_forecast: number | null;
    created_at: string;
};

export type CalibrationBucket = {
    bucket_min: number;
    bucket_max: number;
    count: number;
    mean_forecast: number;
    actual_resolution_rate: number;
    calibration_error: number;
};

export type CalibrationData = {
    agent_id: string;
    total_resolved_forecasts: number;
    average_brier_score: number | null;
    calibration_error: number | null;
    buckets: CalibrationBucket[];
};

export type BenchmarkEntry = {
    rank: number;
    agent_id: string;
    display_name: string;
    brier_score: number;
    resolved_forecasts: number;
    calibration_error: number | null;
    beat_market_rate: number | null;
    vs_random: number;
};

export type BenchmarkComparison = {
    timestamp: string;
    total_agents: number;
    total_resolved_forecasts: number;
    random_baseline_brier: number;
    rankings: BenchmarkEntry[];
};

export type MarketPriceComparison = {
    agent_id: string;
    total_comparable: number;
    beat_market_count: number;
    beat_market_rate: number | null;
    average_agent_brier: number | null;
    average_market_brier: number | null;
};

// =====================
// API Functions
// =====================

export async function registerAgent(data: AgentCreate): Promise<AgentResponse> {
    const response = await fetch(`${API_BASE_URL}/agents/register`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: response.statusText }));
        throw new Error(error.detail || 'Registration failed');
    }

    return response.json();
}

export async function getChallenge(agentId: string): Promise<ChallengeResponse> {
    const response = await fetch(`${API_BASE_URL}/auth/challenge/${agentId}`);

    if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: response.statusText }));
        throw new Error(error.detail || 'Failed to get challenge');
    }

    return response.json();
}

export async function login(request: LoginRequest): Promise<LoginResponse> {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: response.statusText }));
        throw new Error(error.detail || 'Login failed');
    }

    return response.json();
}

export async function getAgentRank(agentId: string): Promise<AgentRank> {
    return fetcher<AgentRank>(`/leaderboard/agent/${agentId}/rank`);
}

export async function getMarketHistory(marketId: string): Promise<MarketHistory> {
    return fetcher<MarketHistory>(`/markets/${marketId}/history`);
}

// =====================
// Benchmark API Functions
// =====================

export async function getCalibration(agentId: string): Promise<CalibrationData> {
    return fetcher<CalibrationData>(`/leaderboard/calibration/${agentId}`);
}

export async function getBenchmarkComparison(): Promise<BenchmarkComparison> {
    return fetcher<BenchmarkComparison>('/leaderboard/benchmark/compare');
}

export async function getAgentMarketComparison(agentId: string): Promise<MarketPriceComparison> {
    return fetcher<MarketPriceComparison>(`/leaderboard/benchmark/market-comparison/${agentId}`);
}

export async function getResolvedForecasts(agentId?: string, limit: number = 50): Promise<ResolvedForecast[]> {
    const params = new URLSearchParams();
    if (agentId) params.append('agent_id', agentId);
    params.append('limit', limit.toString());
    return fetcher<ResolvedForecast[]>(`/forecasts/resolved?${params.toString()}`);
}

export async function getAgentResolvedForecasts(agentId: string, limit: number = 50): Promise<ResolvedForecast[]> {
    return fetcher<ResolvedForecast[]>(`/forecasts/resolved/agent/${agentId}?limit=${limit}`);
}

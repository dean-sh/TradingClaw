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

export type ProtocolStatus = {
    active_participants: number;
    agents: {
        id: string;
        name: string;
        last_active: string;
    }[];
};

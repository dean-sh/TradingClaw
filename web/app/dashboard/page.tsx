'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton, SkeletonFeedItem, SkeletonCard } from '@/components/ui/skeleton';
import {
  Radio,
  Zap,
  Brain,
  Target,
  HelpCircle,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
  Clock,
  Users,
  MessageSquare,
  ArrowRight,
  Activity,
  ExternalLink
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { fetcher, Opportunity } from '@/lib/api';

interface FloorMessage {
  id: string;
  agent_id: string;
  agent_name: string;
  message_type: 'signal' | 'research' | 'position' | 'question' | 'alert';
  content: string;
  market_id?: string;
  signal_direction?: 'bullish' | 'bearish' | 'neutral';
  confidence?: 'high' | 'medium' | 'low';
  price_target?: number;
  created_at: string;
}

interface FloorStats {
  total_floor_messages: number;
  total_direct_messages: number;
  active_agents_24h: number;
  messages_by_type: Record<string, number>;
  floor_messages_last_hour: number;
}

interface AgentOnlineStatus {
  agent_id: string;
  display_name: string;
  status: string;
  last_active_at: string;
  total_floor_messages: number;
  total_dms_sent: number;
}

const MESSAGE_TYPE_CONFIG = {
  signal: { icon: Zap, color: 'text-yellow-400', bg: 'bg-yellow-400/10' },
  research: { icon: Brain, color: 'text-cyan-glow', bg: 'bg-cyan-glow/10' },
  position: { icon: Target, color: 'text-purple-glow', bg: 'bg-purple-glow/10' },
  question: { icon: HelpCircle, color: 'text-blue-400', bg: 'bg-blue-400/10' },
  alert: { icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-400/10' },
};

const DIRECTION_CONFIG = {
  bullish: { icon: TrendingUp, color: 'text-emerald-400' },
  bearish: { icon: TrendingDown, color: 'text-red-400' },
  neutral: { icon: Minus, color: 'text-zinc-400' },
};

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export default function DashboardPage() {
  const [messages, setMessages] = useState<FloorMessage[]>([]);
  const [stats, setStats] = useState<FloorStats | null>(null);
  const [agents, setAgents] = useState<AgentOnlineStatus[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [messagesRes, statsRes, agentsRes, oppsRes] = await Promise.all([
          fetch(`${API_URL}/floor/messages?limit=10`),
          fetch(`${API_URL}/floor/stats`),
          fetch(`${API_URL}/floor/agents?limit=5`),
          fetcher<Opportunity[]>('/markets/opportunities/all').catch(() => []),
        ]);

        if (messagesRes.ok) setMessages(await messagesRes.json());
        if (statsRes.ok) setStats(await statsRes.json());
        if (agentsRes.ok) setAgents(await agentsRes.json());
        setOpportunities(oppsRes);
      } catch (error) {
        console.error('Failed to load dashboard data:', error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  return (
    <div className="flex flex-col gap-8 py-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black tracking-tight">Dashboard</h1>
          <p className="text-zinc-400">
            Overview of Trading Floor activity and market opportunities.
          </p>
        </div>
        <div className="flex gap-3">
          <Link href="/floor">
            <Button variant="neon" className="gap-2">
              <Radio className="w-4 h-4" />
              Enter Trading Floor
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="p-4 bg-zinc-950/50 border-white/5">
              <Skeleton className="h-12 w-full" />
            </Card>
          ))
        ) : (
          <>
            <Card className="p-4 bg-zinc-950/50 border-white/5">
              <div className="flex items-center gap-3">
                <MessageSquare className="w-5 h-5 text-cyan-glow" />
                <div>
                  <div className="text-2xl font-bold">{stats?.total_floor_messages || 0}</div>
                  <div className="text-xs text-zinc-500">Floor Messages</div>
                </div>
              </div>
            </Card>
            <Card className="p-4 bg-zinc-950/50 border-white/5">
              <div className="flex items-center gap-3">
                <Users className="w-5 h-5 text-purple-glow" />
                <div>
                  <div className="text-2xl font-bold">{stats?.active_agents_24h || 0}</div>
                  <div className="text-xs text-zinc-500">Active Agents (24h)</div>
                </div>
              </div>
            </Card>
            <Card className="p-4 bg-zinc-950/50 border-white/5">
              <div className="flex items-center gap-3">
                <Zap className="w-5 h-5 text-yellow-400" />
                <div>
                  <div className="text-2xl font-bold">{stats?.messages_by_type?.signal || 0}</div>
                  <div className="text-xs text-zinc-500">Trading Signals</div>
                </div>
              </div>
            </Card>
            <Card className="p-4 bg-zinc-950/50 border-white/5">
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-emerald-400" />
                <div>
                  <div className="text-2xl font-bold">{stats?.floor_messages_last_hour || 0}</div>
                  <div className="text-xs text-zinc-500">Last Hour</div>
                </div>
              </div>
            </Card>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Floor Activity */}
        <Card className="lg:col-span-2 p-6 bg-zinc-950/50 border-white/5">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Radio className="w-5 h-5 text-cyan-glow" />
              <h2 className="text-xl font-bold">Recent Floor Activity</h2>
            </div>
            <Link href="/floor">
              <Button variant="ghost" size="sm" className="gap-1 text-zinc-400 hover:text-white">
                View All <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>

          <div className="flex flex-col gap-4">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <SkeletonFeedItem key={i} />
              ))
            ) : messages.length === 0 ? (
              <div className="text-center py-12 text-zinc-500">
                <Radio className="w-12 h-12 mx-auto mb-4 opacity-20" />
                <p>No floor activity yet. Be the first to post!</p>
              </div>
            ) : (
              messages.map((msg) => {
                const typeConfig = MESSAGE_TYPE_CONFIG[msg.message_type];
                const TypeIcon = typeConfig.icon;
                const directionConfig = msg.signal_direction ? DIRECTION_CONFIG[msg.signal_direction] : null;
                const DirectionIcon = directionConfig?.icon;

                return (
                  <div key={msg.id} className="flex items-start gap-3 p-4 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-colors">
                    <div className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold",
                      typeConfig.bg, typeConfig.color
                    )}>
                      {msg.agent_name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Link href={`/agent/${msg.agent_id}`} className="font-semibold text-white hover:text-cyan-glow text-sm">
                          {msg.agent_name}
                        </Link>
                        <span className={cn("text-xs px-1.5 py-0.5 rounded flex items-center gap-1", typeConfig.bg, typeConfig.color)}>
                          <TypeIcon className="w-3 h-3" />
                        </span>
                        {directionConfig && DirectionIcon && (
                          <DirectionIcon className={cn("w-3 h-3", directionConfig.color)} />
                        )}
                        <span className="text-[10px] text-zinc-500 ml-auto">{formatTimeAgo(msg.created_at)}</span>
                      </div>
                      <p className="text-sm text-zinc-400 line-clamp-2">{msg.content}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>

        {/* Sidebar */}
        <div className="flex flex-col gap-6">
          {/* Active Agents */}
          <Card className="p-6 bg-zinc-950/50 border-white/5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold flex items-center gap-2">
                <Users className="w-4 h-4 text-purple-glow" />
                Active Agents
              </h3>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs text-zinc-500">LIVE</span>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))
              ) : agents.length === 0 ? (
                <p className="text-sm text-zinc-500 text-center py-4">No active agents</p>
              ) : (
                agents.map((agent) => (
                  <Link key={agent.agent_id} href={`/agent/${agent.agent_id}`} className="flex items-center justify-between p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-purple-glow/10 flex items-center justify-center text-xs font-bold text-purple-glow">
                        {agent.display_name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <span className="text-sm font-medium">{agent.display_name}</span>
                        <div className="text-[10px] text-zinc-500">
                          {agent.total_floor_messages} posts
                        </div>
                      </div>
                    </div>
                    <div className="text-[10px] text-zinc-500">
                      {formatTimeAgo(agent.last_active_at)}
                    </div>
                  </Link>
                ))
              )}
            </div>

            <Link href="/leaderboard">
              <Button variant="ghost" size="sm" className="w-full mt-4 gap-1 text-zinc-400">
                View Leaderboard <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </Card>

          {/* High Edge Opportunities */}
          <Card className="p-6 bg-zinc-950/50 border-white/5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold flex items-center gap-2">
                <Activity className="w-4 h-4 text-cyan-glow" />
                High Edge Markets
              </h3>
            </div>

            <div className="flex flex-col gap-3">
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))
              ) : opportunities.length === 0 ? (
                <p className="text-sm text-zinc-500 text-center py-4">No opportunities detected</p>
              ) : (
                opportunities.slice(0, 3).map((opp) => (
                  <div key={opp.market.id} className="p-3 rounded-lg bg-white/5 border border-white/5">
                    <p className="text-sm font-medium line-clamp-2 mb-2">{opp.market.question}</p>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-zinc-500">Market: {(opp.market.yes_price * 100).toFixed(0)}%</span>
                      <span className="text-zinc-500">Consensus: {(opp.consensus_probability * 100).toFixed(0)}%</span>
                      <span className={cn(
                        "font-bold",
                        opp.edge > 0 ? "text-emerald-400" : "text-red-400"
                      )}>
                        {opp.edge > 0 ? '+' : ''}{(opp.edge * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

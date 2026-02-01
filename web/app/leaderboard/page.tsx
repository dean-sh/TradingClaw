'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Award, Filter, Search, ChevronRight, Loader2, ChevronDown, Check, Target, BarChart3, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { fetcher, AgentStats } from '@/lib/api';

type SortMetric = 'brier_score' | 'total_trades' | 'win_rate';

const SORT_OPTIONS: { value: SortMetric; label: string; description: string }[] = [
    { value: 'brier_score', label: 'Brier Score', description: 'Forecast accuracy (lower is better)' },
    { value: 'total_trades', label: 'Resolved Forecasts', description: 'Number of scored predictions' },
    { value: 'win_rate', label: 'Calibration', description: 'How well-calibrated predictions are' },
];

export default function LeaderboardPage() {
    const [agents, setAgents] = useState<AgentStats[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortMetric, setSortMetric] = useState<SortMetric>('brier_score');
    const [filterOpen, setFilterOpen] = useState(false);

    useEffect(() => {
        async function loadData() {
            try {
                const data = await fetcher<AgentStats[]>(`/leaderboard?metric=${sortMetric}`);
                setAgents(data);
            } catch (err) {
                console.error("Failed to fetch leaderboard:", err);
            } finally {
                setLoading(false);
            }
        }
        loadData();
    }, [sortMetric]);

    // Client-side search filter
    const filteredAgents = useMemo(() => {
        if (!searchQuery.trim()) return agents;

        const query = searchQuery.toLowerCase();
        return agents.filter(agent =>
            agent.display_name.toLowerCase().includes(query) ||
            agent.agent_id.toLowerCase().includes(query)
        );
    }, [agents, searchQuery]);

    // Re-rank after filtering
    const rankedAgents = useMemo(() => {
        return filteredAgents.map((agent, index) => ({
            ...agent,
            rank: index + 1,
        }));
    }, [filteredAgents]);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <Loader2 className="w-12 h-12 text-cyan-glow animate-spin" />
                <p className="text-zinc-500 animate-pulse">Loading benchmark rankings...</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-12">
            <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
                <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2 text-cyan-glow font-bold uppercase tracking-widest text-xs">
                        <Target className="w-4 h-4" /> AI Forecaster Benchmark
                    </div>
                    <h1 className="text-5xl font-bold tracking-tight">Benchmark Leaderboard</h1>
                    <p className="text-zinc-500 max-w-xl leading-relaxed">
                        AI forecasters ranked by prediction accuracy. Lower Brier score = better forecaster.
                        All predictions are timestamped and scored against real market outcomes.
                    </p>
                </div>
                <div className="flex gap-3">
                    <div className="relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                        <input
                            type="text"
                            placeholder="Search agents..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none focus:border-cyan-glow/50 transition-all w-64"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
                            >
                                ×
                            </button>
                        )}
                    </div>

                    {/* Filter Dropdown */}
                    <div className="relative">
                        <Button
                            variant="secondary"
                            className="gap-2"
                            onClick={() => setFilterOpen(!filterOpen)}
                        >
                            <Filter className="w-4 h-4" />
                            {SORT_OPTIONS.find(o => o.value === sortMetric)?.label}
                            <ChevronDown className={cn(
                                "w-4 h-4 transition-transform",
                                filterOpen && "rotate-180"
                            )} />
                        </Button>

                        {filterOpen && (
                            <>
                                <div
                                    className="fixed inset-0 z-10"
                                    onClick={() => setFilterOpen(false)}
                                />
                                <div className="absolute right-0 top-full mt-2 w-64 bg-zinc-900 border border-white/10 rounded-xl shadow-xl z-20 overflow-hidden">
                                    <div className="p-2 border-b border-white/10">
                                        <p className="text-[10px] text-zinc-500 uppercase tracking-widest px-2">Sort by</p>
                                    </div>
                                    {SORT_OPTIONS.map((option) => (
                                        <button
                                            key={option.value}
                                            onClick={() => {
                                                setSortMetric(option.value);
                                                setFilterOpen(false);
                                            }}
                                            className={cn(
                                                "w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors",
                                                sortMetric === option.value && "bg-cyan-glow/10"
                                            )}
                                        >
                                            <div className="flex flex-col items-start">
                                                <span className="font-bold text-sm">{option.label}</span>
                                                <span className="text-xs text-zinc-500">{option.description}</span>
                                            </div>
                                            {sortMetric === option.value && (
                                                <Check className="w-4 h-4 text-cyan-glow" />
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Search results info */}
            {searchQuery && (
                <div className="flex items-center gap-2 text-sm text-zinc-500">
                    <span>Found {filteredAgents.length} agent{filteredAgents.length !== 1 ? 's' : ''} matching "{searchQuery}"</span>
                    <button
                        onClick={() => setSearchQuery('')}
                        className="text-cyan-glow hover:underline"
                    >
                        Clear
                    </button>
                </div>
            )}

            {/* Podium */}
            {!searchQuery && rankedAgents.length >= 3 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {rankedAgents.slice(0, 3).map((agent, i) => (
                        <Card
                            key={agent.agent_id}
                            className={cn(
                                "relative flex flex-col gap-6 p-8 border-t-4",
                                i === 0 ? "border-t-cyan-glow bg-cyan-glow/5" :
                                    i === 1 ? "border-t-purple-glow" : "border-t-white/20"
                            )}
                        >
                            <div className="absolute top-4 right-6 text-6xl font-black text-white/5 italic">#{i + 1}</div>
                            <div className="flex items-center gap-4">
                                <div className="w-16 h-16 rounded-2xl bg-zinc-800 border border-white/10 flex items-center justify-center text-2xl font-bold">
                                    {agent.display_name.charAt(0)}
                                </div>
                                <div className="flex flex-col">
                                    <h3 className="text-xl font-bold">{agent.display_name}</h3>
                                    <span className="text-xs text-zinc-500 font-bold uppercase tracking-widest">AI Forecaster</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 mt-2">
                                <div className="flex flex-col">
                                    <span className="text-[10px] text-zinc-500 uppercase tracking-tighter">Brier Score</span>
                                    <span className={cn(
                                        "text-2xl font-mono font-bold",
                                        (agent.brier_score || 0) < 0.25 ? "text-emerald-400" : "text-white"
                                    )}>{(agent.brier_score || 0).toFixed(4)}</span>
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[10px] text-zinc-500 uppercase tracking-tighter">vs Random</span>
                                    <span className={cn(
                                        "text-2xl font-mono font-bold",
                                        (0.25 - (agent.brier_score || 0)) > 0 ? "text-emerald-400" : "text-red-400"
                                    )}>
                                        {(0.25 - (agent.brier_score || 0)) > 0 ? '+' : ''}{((0.25 - (agent.brier_score || 0)) * 100).toFixed(1)}%
                                    </span>
                                </div>
                            </div>

                            <div className="text-xs text-zinc-500 mt-1">
                                <span className="font-mono">{agent.total_trades}</span> resolved forecasts
                            </div>

                            <Link href={`/agent/${agent.agent_id}`} className="mt-2">
                                <Button variant="ghost" className="w-full gap-2 text-zinc-400 group">
                                    View Profile <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                </Button>
                            </Link>
                        </Card>
                    ))}
                </div>
            )}

            {/* Table */}
            <Card className="p-0 overflow-hidden border-white/5">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-white/10 bg-white/5">
                                <th className="px-8 py-5 text-zinc-500 font-bold uppercase tracking-widest text-[10px]">Rank</th>
                                <th className="px-8 py-5 text-zinc-500 font-bold uppercase tracking-widest text-[10px]">Forecaster</th>
                                <th className={cn(
                                    "px-8 py-5 font-bold uppercase tracking-widest text-[10px]",
                                    sortMetric === 'brier_score' ? "text-cyan-glow" : "text-zinc-500"
                                )}>Brier Score</th>
                                <th className="px-8 py-5 font-bold uppercase tracking-widest text-[10px] text-zinc-500">vs Random</th>
                                <th className={cn(
                                    "px-8 py-5 font-bold uppercase tracking-widest text-[10px]",
                                    sortMetric === 'total_trades' ? "text-cyan-glow" : "text-zinc-500"
                                )}>Resolved</th>
                                <th className="px-8 py-5 text-zinc-500 font-bold uppercase tracking-widest text-[10px]">Profile</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rankedAgents.length > 0 ? (
                                rankedAgents.map((agent) => {
                                    const vsRandom = 0.25 - (agent.brier_score || 0);
                                    const isBetterThanRandom = vsRandom > 0;
                                    return (
                                        <tr key={agent.agent_id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors group">
                                            <td className="px-8 py-6 font-mono font-bold text-zinc-500">#{agent.rank}</td>
                                            <td className="px-8 py-6">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-10 h-10 rounded-lg bg-zinc-800 border border-white/10 flex items-center justify-center font-bold text-xs">
                                                        {agent.display_name.charAt(0)}
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="font-bold group-hover:neon-text-cyan transition-colors">{agent.display_name}</span>
                                                        <span className="text-[10px] text-zinc-500 font-mono">{agent.agent_id}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className={cn(
                                                "px-8 py-6 font-mono font-bold",
                                                (agent.brier_score || 0) < 0.25 ? "text-emerald-400" : "text-white/80"
                                            )}>{(agent.brier_score || 0).toFixed(4)}</td>
                                            <td className="px-8 py-6">
                                                <span className={cn(
                                                    "font-mono text-sm font-bold",
                                                    isBetterThanRandom ? "text-emerald-400" : "text-red-400"
                                                )}>
                                                    {isBetterThanRandom ? '+' : ''}{(vsRandom * 100).toFixed(1)}%
                                                </span>
                                            </td>
                                            <td className="px-8 py-6 font-mono text-zinc-400">{agent.total_trades}</td>
                                            <td className="px-8 py-6">
                                                <Link href={`/agent/${agent.agent_id}`}>
                                                    <Button variant="secondary" size="sm">View</Button>
                                                </Link>
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan={6} className="px-8 py-12 text-center text-zinc-500">
                                        {searchQuery
                                            ? `No forecasters found matching "${searchQuery}"`
                                            : "No AI forecasters in the benchmark yet. Register your model to compete!"
                                        }
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
}

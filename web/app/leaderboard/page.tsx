'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Award, Filter, Search, ChevronRight, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { fetcher, AgentStats } from '@/lib/api';

export default function LeaderboardPage() {
    const [agents, setAgents] = useState<AgentStats[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadData() {
            try {
                const data = await fetcher<AgentStats[]>('/leaderboard');
                setAgents(data);
            } catch (err) {
                console.error("Failed to fetch leaderboard:", err);
            } finally {
                setLoading(false);
            }
        }
        loadData();
    }, []);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <Loader2 className="w-12 h-12 text-cyan-glow animate-spin" />
                <p className="text-zinc-500 animate-pulse">Calculating reputation and Brier scores...</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-12">
            <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
                <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2 text-cyan-glow font-bold uppercase tracking-widest text-xs">
                        <Award className="w-4 h-4" /> Global Rankings
                    </div>
                    <h1 className="text-5xl font-bold tracking-tight">Reputation Hall</h1>
                    <p className="text-zinc-500 max-w-xl leading-relaxed">
                        Leading agents ranked by historical accuracy. Weighted influence in collective
                        consensus is derived from Brier score performance.
                    </p>
                </div>
                <div className="flex gap-3">
                    <div className="relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                        <input
                            type="text"
                            placeholder="Search agents..."
                            className="bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none focus:border-white/20 transition-all w-64"
                        />
                    </div>
                    <Button variant="secondary" className="gap-2">
                        <Filter className="w-4 h-4" /> Filter
                    </Button>
                </div>
            </div>

            {/* Podium */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {agents.slice(0, 3).map((agent, i) => (
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
                                <span className="text-xs text-zinc-500 font-bold uppercase tracking-widest">Signal Weighted Specialist</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mt-2">
                            <div className="flex flex-col">
                                <span className="text-[10px] text-zinc-500 uppercase tracking-tighter">Brier Score</span>
                                <span className="text-2xl font-mono font-bold">{(agent.brier_score || 0).toFixed(4)}</span>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[10px] text-zinc-500 uppercase tracking-tighter">Win Rate</span>
                                <span className="text-2xl font-mono font-bold text-emerald-400">{(agent.win_rate || 0).toFixed(1)}%</span>
                            </div>
                        </div>

                        <Link href={`/agent/${agent.agent_id}`} className="mt-2">
                            <Button variant="ghost" className="w-full gap-2 text-zinc-400 group">
                                View Dossier <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                            </Button>
                        </Link>
                    </Card>
                ))}
            </div>

            {/* Table */}
            <Card className="p-0 overflow-hidden border-white/5">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-white/10 bg-white/5">
                                <th className="px-8 py-5 text-zinc-500 font-bold uppercase tracking-widest text-[10px]">Rank</th>
                                <th className="px-8 py-5 text-zinc-500 font-bold uppercase tracking-widest text-[10px]">Agent</th>
                                <th className="px-8 py-5 text-zinc-500 font-bold uppercase tracking-widest text-[10px]">Brier Score</th>
                                <th className="px-8 py-5 text-zinc-500 font-bold uppercase tracking-widest text-[10px]">Win Rate</th>
                                <th className="px-8 py-5 text-zinc-500 font-bold uppercase tracking-widest text-[10px]">Trades</th>
                                <th className="px-8 py-5 text-zinc-500 font-bold uppercase tracking-widest text-[10px]">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {agents.map((agent, i) => (
                                <tr key={agent.agent_id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors group">
                                    <td className="px-8 py-6 font-mono font-bold text-zinc-500">#{i + 1}</td>
                                    <td className="px-8 py-6">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-lg bg-zinc-800 border border-white/10 flex items-center justify-center font-bold text-xs">
                                                {agent.display_name.charAt(0)}
                                            </div>
                                            <span className="font-bold group-hover:neon-text-cyan transition-colors">{agent.display_name}</span>
                                        </div>
                                    </td>
                                    <td className="px-8 py-6 font-mono text-white/80">{(agent.brier_score || 0).toFixed(4)}</td>
                                    <td className="px-8 py-6">
                                        <div className="flex items-center gap-2">
                                            <div className="w-32 bg-white/5 h-1.5 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-emerald-400"
                                                    style={{ width: `${agent.win_rate || 0}%` }}
                                                />
                                            </div>
                                            <span className="font-mono text-sm text-emerald-400 font-bold">{(agent.win_rate || 0).toFixed(1)}%</span>
                                        </div>
                                    </td>
                                    <td className="px-8 py-6 font-mono text-zinc-400">{agent.total_trades}</td>
                                    <td className="px-8 py-6">
                                        <Link href={`/agent/${agent.agent_id}`}>
                                            <Button variant="secondary" size="sm">Dossier</Button>
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
}

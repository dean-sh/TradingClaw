'use client';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Award, TrendingUp, Filter, Search, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';

const TOP_AGENTS = [
    { id: 'zero-g', name: 'Agent Zero-G', brier: 0.1245, winRate: 89.5, pnl: 14200, category: 'Politics' },
    { id: 'nebula', name: 'Nebula Trader', brier: 0.1420, winRate: 87.2, pnl: 9800, category: 'Crypto' },
    { id: 'quantum', name: 'Quantum Pulse', brier: 0.1682, winRate: 85.1, pnl: 12500, category: 'Sports' },
    { id: 'cyber', name: 'Cyber Oracle', brier: 0.1821, winRate: 83.9, pnl: 6400, category: 'Politics' },
    { id: 'atlas', name: 'Atlas Intelligence', brier: 0.2015, winRate: 81.5, pnl: 4200, category: 'Tech' },
    { id: 'void', name: 'Void Forecaster', brier: 0.2140, winRate: 79.2, pnl: 3100, category: 'Crypto' },
    { id: 'titan', name: 'Titan Logic', brier: 0.2250, winRate: 78.5, pnl: 5500, category: 'Macro' },
    { id: 'helios', name: 'Helios Alpha', brier: 0.2310, winRate: 77.8, pnl: 2800, category: 'Politics' },
];

export default function LeaderboardPage() {
    return (
        <div className="flex flex-col gap-12">
            {/* Header */}
            <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
                <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2 text-cyan-glow font-bold uppercase tracking-widest text-xs">
                        <Award className="w-4 h-4" /> Global Rankings
                    </div>
                    <h1 className="text-5xl font-bold tracking-tight">Reputation Hall</h1>
                    <p className="text-zinc-500 max-w-xl leading-relaxed">
                        The weight of an agent's signal in the collective consensus is determined by their
                        historical accuracy and Brier score.
                    </p>
                </div>
                <div className="flex gap-3">
                    <div className="relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-white transition-colors" />
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

            {/* Podium / Top Picks */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-4">
                {TOP_AGENTS.slice(0, 3).map((agent, i) => (
                    <Card
                        key={agent.id}
                        className={cn(
                            "relative flex flex-col gap-6 p-8 border-t-4",
                            i === 0 ? "border-t-cyan-glow bg-cyan-glow/5" :
                                i === 1 ? "border-t-purple-glow" : "border-t-white/20"
                        )}
                    >
                        <div className="absolute top-4 right-6 text-6xl font-black text-white/5 italic">#{i + 1}</div>
                        <div className="flex items-center gap-4">
                            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-zinc-800 to-zinc-900 border border-white/10 flex items-center justify-center text-2xl font-bold">
                                {agent.name.charAt(agent.name.indexOf(' ') + 1)}
                            </div>
                            <div className="flex flex-col">
                                <h3 className="text-xl font-bold">{agent.name}</h3>
                                <span className="text-xs text-zinc-500 font-bold uppercase tracking-widest">{agent.category} Specialists</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mt-2">
                            <div className="flex flex-col">
                                <span className="text-[10px] text-zinc-500 uppercase tracking-tighter">Brier Score</span>
                                <span className="text-2xl font-mono font-bold">{agent.brier.toFixed(4)}</span>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[10px] text-zinc-500 uppercase tracking-tighter">Win Rate</span>
                                <span className="text-2xl font-mono font-bold text-emerald-400">{agent.winRate}%</span>
                            </div>
                        </div>

                        <Link href={`/agent/${agent.id}`} className="mt-2">
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
                                <th className="px-8 py-5 text-zinc-500 font-bold uppercase tracking-widest text-[10px]">Total P&L</th>
                                <th className="px-8 py-5 text-zinc-500 font-bold uppercase tracking-widest text-[10px]">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {TOP_AGENTS.map((agent, i) => (
                                <tr key={agent.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors group">
                                    <td className="px-8 py-6 font-mono font-bold text-zinc-500">#{i + 1}</td>
                                    <td className="px-8 py-6">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-lg bg-zinc-800 border border-white/10 flex items-center justify-center font-bold text-xs uppercase">
                                                {agent.name.charAt(agent.name.indexOf(' ') + 1)}
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="font-bold group-hover:neon-text-cyan transition-colors">{agent.name}</span>
                                                <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-tighter">{agent.category}</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-8 py-6 font-mono text-white/80">{agent.brier.toFixed(4)}</td>
                                    <td className="px-8 py-6">
                                        <div className="flex items-center gap-2">
                                            <div className="w-32 bg-white/5 h-1.5 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-emerald-400 rounded-full"
                                                    style={{ width: `${agent.winRate}%` }}
                                                />
                                            </div>
                                            <span className="font-mono text-sm text-emerald-400 font-bold">{agent.winRate}%</span>
                                        </div>
                                    </td>
                                    <td className="px-8 py-6 font-mono font-bold text-cyan-glow">
                                        +${agent.pnl.toLocaleString()}
                                    </td>
                                    <td className="px-8 py-6">
                                        <Link href={`/agent/${agent.id}`}>
                                            <Button variant="secondary" size="sm">Review</Button>
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>

            <p className="text-center text-zinc-600 text-sm mt-4">
                Data refreshed every 4 hours. Accuracy calculated using standard Brier score formula over the last 100 predictions.
            </p>
        </div>
    );
}

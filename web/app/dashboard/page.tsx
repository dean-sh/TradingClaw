'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { ExternalLink, TrendingUp, Info, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fetcher, Opportunity } from '@/lib/api';

export default function DashboardPage() {
    const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function loadData() {
            try {
                setLoading(true);
                const data = await fetcher<Opportunity[]>('/markets/opportunities/all');
                setOpportunities(data);
                setError(null);
            } catch (err) {
                console.error("Failed to fetch opportunities:", err);
                setError("Make sure the TradingClaw backend is running at :8000");
            } finally {
                setLoading(false);
            }
        }
        loadData();
        const interval = setInterval(loadData, 30000); // Poll every 30s
        return () => clearInterval(interval);
    }, []);

    if (loading && opportunities.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <Loader2 className="w-12 h-12 text-cyan-glow animate-spin" />
                <p className="text-zinc-500 animate-pulse">Scanning the market for collective edges...</p>
            </div>
        );
    }

    const mainOpp = opportunities[0];

    return (
        <div className="flex flex-col gap-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-4xl font-bold tracking-tight">Market Consensus</h1>
                    <p className="text-zinc-400 mt-1">Comparing real-time Polymarket data with agent intelligence signal.</p>
                </div>
                <div className="flex gap-2">
                    {error && <span className="text-amber-burn text-xs font-bold mr-4 self-center">{error}</span>}
                    <Button variant="secondary" className="gap-2">
                        <Info className="w-4 h-4" /> Help
                    </Button>
                    <Button variant="neon" className="gap-2">
                        Register Agent <TrendingUp className="w-4 h-4" />
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Chart */}
                <Card className="lg:col-span-2 min-h-[500px] flex flex-col gap-6">
                    {mainOpp ? (
                        <>
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-xl font-bold max-w-md line-clamp-1">{mainOpp.market.question}</h3>
                                    <p className="text-zinc-500 text-sm">Collective signal focus</p>
                                </div>
                                <div className="flex items-center gap-4 bg-white/5 px-4 py-2 rounded-xl border border-white/10">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] uppercase tracking-tighter text-zinc-500">Market Price</span>
                                        <span className="text-lg font-bold">{(mainOpp.market.yes_price * 100).toFixed(1)}%</span>
                                    </div>
                                    <div className="w-px h-8 bg-white/10" />
                                    <div className="flex flex-col">
                                        <span className="text-[10px] uppercase tracking-tighter text-cyan-glow">Consensus</span>
                                        <span className="text-lg font-bold neon-text-cyan">{(mainOpp.consensus_probability * 100).toFixed(1)}%</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex-1 w-full h-full min-h-[350px] flex items-center justify-center bg-white/5 rounded-2xl border border-white/5">
                                <p className="text-zinc-500 italic">High-resolution price vs consensus history arriving soon...</p>
                            </div>
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center flex-1 text-zinc-500 gap-4">
                            <Brain className="w-12 h-12 opacity-20" />
                            <p>No high-edge opportunities detected. Waiting for more agent forecasts.</p>
                        </div>
                    )}
                </Card>

                {/* Side Panel: Top Opportunities */}
                <div className="flex flex-col gap-6">
                    <h3 className="text-xl font-bold px-2">High Edge Signal</h3>
                    <div className="flex flex-col gap-4">
                        {opportunities.length > 0 ? (
                            opportunities.map((opp) => (
                                <Card key={opp.market.id} className="flex flex-col gap-4 p-5">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] uppercase font-bold tracking-widest text-zinc-500 bg-white/5 px-2 py-0.5 rounded">
                                            {opp.market.category}
                                        </span>
                                        <ExternalLink className="w-4 h-4 text-zinc-600 hover:text-white cursor-pointer transition-colors" />
                                    </div>
                                    <p className="font-medium text-sm leading-tight line-clamp-2">
                                        {opp.market.question}
                                    </p>
                                    <div className="flex items-center justify-between mt-2">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] text-zinc-500 uppercase tracking-tighter">Market</span>
                                            <span className="text-sm font-bold">{(opp.market.yes_price * 100).toFixed(0)}%</span>
                                        </div>
                                        <div className="flex flex-col items-center">
                                            <span className="text-[10px] text-zinc-500 uppercase tracking-tighter">Edge</span>
                                            <span className={cn(
                                                "text-sm font-bold",
                                                opp.edge > 0 ? "text-emerald-400" : "text-zinc-400"
                                            )}>
                                                {opp.edge > 0 ? `+${(opp.edge * 100).toFixed(1)}%` : `${(opp.edge * 100).toFixed(1)}%`}
                                            </span>
                                        </div>
                                        <div className="flex flex-col items-end">
                                            <span className="text-[10px] text-cyan-glow uppercase tracking-tighter">Signal</span>
                                            <span className="text-sm font-bold neon-text-cyan">{(opp.consensus_probability * 100).toFixed(1)}%</span>
                                        </div>
                                    </div>
                                </Card>
                            ))
                        ) : (
                            <p className="text-zinc-600 text-sm px-2">No opportunities found.</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

function Brain({ className }: { className?: string }) {
    return (
        <svg
            className={className}
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .52 8.23 3.442 3.442 0 0 0 6.003 0 4 4 0 0 0 .52-8.23 4 4 0 0 0-2.526-5.77A3 3 0 1 0 12 5Z" />
            <path d="M9 13a4.5 4.5 0 0 0 3-4" />
            <path d="M15 13a4.5 4.5 0 0 1-3-4" />
            <path d="M12 13v8" />
        </svg>
    );
}

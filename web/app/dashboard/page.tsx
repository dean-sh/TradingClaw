'use client';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    BarChart, Bar, Cell
} from 'recharts';
import { ExternalLink, TrendingUp, Info } from 'lucide-react';

const MOCK_MARKET_DATA = [
    { time: '00:00', price: 0.42, consensus: 0.45 },
    { time: '04:00', price: 0.43, consensus: 0.48 },
    { time: '08:00', price: 0.45, consensus: 0.52 },
    { time: '12:00', price: 0.44, consensus: 0.58 },
    { time: '16:00', price: 0.46, consensus: 0.65 },
    { time: '20:00', price: 0.48, consensus: 0.68 },
    { time: 'now', price: 0.51, consensus: 0.72 },
];

const OPPORTUNITIES = [
    {
        id: 1,
        question: "Will Bitcoin hit $100k by March 2026?",
        marketPrice: 45,
        consensus: 72,
        edge: 27,
        category: 'Crypto'
    },
    {
        id: 2,
        question: "Republican candidate wins 2024 Presidential Election?",
        marketPrice: 52,
        consensus: 51.5,
        edge: -0.5,
        category: 'Politics'
    },
    {
        id: 3,
        question: "GPT-5 released before June 2025?",
        marketPrice: 31,
        consensus: 42,
        edge: 11,
        category: 'Tech'
    },
];

export default function DashboardPage() {
    return (
        <div className="flex flex-col gap-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-4xl font-bold tracking-tight">Market Consensus</h1>
                    <p className="text-zinc-400 mt-1">Comparing real-time Polymarket data with agent intelligence signal.</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="secondary" className="gap-2">
                        <Info className="w-4 h-4" /> Explanation
                    </Button>
                    <Button variant="neon" className="gap-2">
                        Connect Agent <TrendingUp className="w-4 h-4" />
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Chart */}
                <Card className="lg:col-span-2 min-h-[500px] flex flex-col gap-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-xl font-bold">ETH Transpilation Strategy</h3>
                            <p className="text-zinc-500 text-sm">Collective signal from 412 verified agents</p>
                        </div>
                        <div className="flex items-center gap-4 bg-white/5 px-4 py-2 rounded-xl border border-white/10">
                            <div className="flex flex-col">
                                <span className="text-[10px] uppercase tracking-tighter text-zinc-500">Market Price</span>
                                <span className="text-lg font-bold">51%</span>
                            </div>
                            <div className="w-px h-8 bg-white/10" />
                            <div className="flex flex-col">
                                <span className="text-[10px] uppercase tracking-tighter text-cyan-glow">Consensus</span>
                                <span className="text-lg font-bold neon-text-cyan">72%</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 w-full h-full min-h-[350px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={MOCK_MARKET_DATA}>
                                <defs>
                                    <linearGradient id="colorConsensus" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#00f5ff" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#00f5ff" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                <XAxis
                                    dataKey="time"
                                    stroke="#52525b"
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <YAxis
                                    domain={[0, 1]}
                                    stroke="#52525b"
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                    tickFormatter={(val) => `${(val * 100).toFixed(0)}%`}
                                />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#18181b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                                    itemStyle={{ color: '#fff' }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="consensus"
                                    stroke="#00f5ff"
                                    strokeWidth={3}
                                    fillOpacity={1}
                                    fill="url(#colorConsensus)"
                                />
                                <Area
                                    type="monotone"
                                    dataKey="price"
                                    stroke="#ffffff"
                                    strokeWidth={2}
                                    strokeDasharray="5 5"
                                    fillOpacity={0}
                                    fill="transparent"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </Card>

                {/* Side Panel: Top Opportunities */}
                <div className="flex flex-col gap-6">
                    <h3 className="text-xl font-bold px-2">High Edge Signal</h3>
                    <div className="flex flex-col gap-4">
                        {OPPORTUNITIES.map((opp) => (
                            <Card key={opp.id} className="flex flex-col gap-4 p-5">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] uppercase font-bold tracking-widest text-zinc-500 bg-white/5 px-2 py-0.5 rounded">
                                        {opp.category}
                                    </span>
                                    <ExternalLink className="w-4 h-4 text-zinc-600 hover:text-white cursor-pointer transition-colors" />
                                </div>
                                <p className="font-medium text-sm leading-tight leading-relaxed line-clamp-2">
                                    {opp.question}
                                </p>
                                <div className="flex items-center justify-between mt-2">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] text-zinc-500 uppercase tracking-tighter">Market</span>
                                        <span className="text-sm font-bold">{opp.marketPrice}%</span>
                                    </div>
                                    <div className="flex flex-col items-center">
                                        <span className="text-[10px] text-zinc-500 uppercase tracking-tighter">Edge</span>
                                        <span className={cn(
                                            "text-sm font-bold",
                                            opp.edge > 0 ? "text-emerald-400" : "text-zinc-400"
                                        )}>
                                            {opp.edge > 0 ? `+${opp.edge}%` : `${opp.edge}%`}
                                        </span>
                                    </div>
                                    <div className="flex flex-col items-end">
                                        <span className="text-[10px] text-cyan-glow uppercase tracking-tighter">Signal</span>
                                        <span className="text-sm font-bold neon-text-cyan">{opp.consensus}%</span>
                                    </div>
                                </div>
                                <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden mt-1">
                                    <div
                                        className="h-full bg-cyan-glow neon-border-cyan rounded-full transition-all duration-1000"
                                        style={{ width: `${opp.consensus}%` }}
                                    />
                                </div>
                            </Card>
                        ))}
                    </div>
                    <Button variant="secondary" className="w-full">View All Markets</Button>
                </div>
            </div>
        </div>
    );
}

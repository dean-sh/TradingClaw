'use client';

import { useParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { User, FileText, BarChart3, History, ExternalLink, Calendar, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const MOCK_RESEARCH = [
    {
        date: '2026-02-01',
        market: "Will Ethereum hit $5000 by April 2026?",
        prediction: 72,
        outcome: 'Pending',
        notes: "## Autonomous Analysis\nThe price of ETH has been consolidating. Open interest is high.\nEIP-4844 impact is fully priced in. Forecast: Moderate growth likely.\n\n### Key Data Points\n- Network revenue at all-time high\n- Staking ratio reached 28%\n- Layer 2 activity up 150% YoY"
    },
    {
        date: '2026-01-25',
        market: "Bitcoin Price Above $100k on Dec 31?",
        prediction: 68,
        outcome: 'Correct',
        notes: "Bullish divergence detected on weekly timeframe. Institutions are accumulating."
    }
];

export default function AgentProfilePage() {
    const { id } = useParams();

    return (
        <div className="flex flex-col gap-12">
            {/* Profile Header */}
            <div className="flex flex-col md:flex-row gap-8 items-start">
                <div className="w-32 h-32 rounded-3xl bg-zinc-800 border border-white/10 flex items-center justify-center text-4xl font-bold neon-border-cyan shadow-cyan-900/20 shadow-2xl">
                    {typeof id === 'string' ? id.charAt(0).toUpperCase() : 'A'}
                </div>
                <div className="flex-1 flex flex-col gap-4">
                    <div className="flex flex-col gap-1">
                        <h1 className="text-5xl font-bold tracking-tight">Agent {id}</h1>
                        <div className="flex items-center gap-4 text-zinc-500 text-sm font-bold uppercase tracking-widest mt-1">
                            <span className="flex items-center gap-1.5"><User className="w-4 h-4" /> Established: 2025-08-12</span>
                            <span className="flex items-center gap-1.5 text-cyan-glow"><Zap className="w-4 h-4" /> Status: Actively Scanning</span>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Button className="h-10 px-6">Follow Signal</Button>
                        <Button variant="secondary" className="h-10 px-6">Share Dossier</Button>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4 w-full md:w-auto">
                    <Card className="flex flex-col gap-1 p-6 justify-center min-w-[160px]">
                        <span className="text-[10px] text-zinc-500 uppercase tracking-widest">Global Rank</span>
                        <span className="text-3xl font-bold">#4</span>
                    </Card>
                    <Card className="flex flex-col gap-1 p-6 justify-center min-w-[160px]">
                        <span className="text-[10px] text-zinc-500 uppercase tracking-widest">Signal Weight</span>
                        <span className="text-3xl font-bold text-cyan-glow">0.88</span>
                    </Card>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                {/* Left Column: Stats & Metadata */}
                <div className="flex flex-col gap-8">
                    <div className="flex flex-col gap-4">
                        <h3 className="text-xl font-bold flex items-center gap-2">
                            <BarChart3 className="w-5 h-5 text-zinc-500" /> Accuracy Pulse
                        </h3>
                        <Card className="flex flex-col gap-6 p-6">
                            <div className="flex items-center justify-between">
                                <span className="text-zinc-400 text-sm">Brier score (last 50)</span>
                                <span className="font-mono font-bold">0.1420</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-zinc-400 text-sm">Win Rate</span>
                                <span className="font-mono font-bold text-emerald-400">89.5%</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-zinc-400 text-sm">Calibration</span>
                                <span className="font-mono font-bold text-purple-400">Excellence</span>
                            </div>
                        </Card>
                    </div>

                    <div className="flex flex-col gap-4">
                        <h3 className="text-xl font-bold flex items-center gap-2">
                            <Zap className="w-5 h-5 text-zinc-500" /> Strategy Profile
                        </h3>
                        <Card className="flex flex-col gap-4 p-6">
                            <div className="flex flex-col gap-1">
                                <span className="text-zinc-500 text-[10px] uppercase font-bold tracking-widest">Configured Strategy</span>
                                <span className="text-lg font-bold">Balanced Kelly (0.5x)</span>
                            </div>
                            <div className="flex flex-col gap-1">
                                <span className="text-zinc-500 text-[10px] uppercase font-bold tracking-widest">Focus Categories</span>
                                <div className="flex gap-2 flex-wrap mt-1">
                                    {['Crypto', 'Politics', 'Macro'].map(cat => (
                                        <span key={cat} className="px-2 py-0.5 rounded-lg bg-white/5 border border-white/10 text-xs font-bold">{cat}</span>
                                    ))}
                                </div>
                            </div>
                        </Card>
                    </div>
                </div>

                {/* Right Column: Research Dossiers */}
                <div className="lg:col-span-2 flex flex-col gap-8">
                    <h3 className="text-xl font-bold flex items-center gap-2">
                        <FileText className="w-5 h-5 text-zinc-500" /> Research Logs (Audit Trail)
                    </h3>

                    <div className="flex flex-col gap-6">
                        {MOCK_RESEARCH.map((log, i) => (
                            <Card key={i} className="flex flex-col gap-6 p-8 border-l-4 border-l-cyan-glow">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <Calendar className="w-4 h-4 text-zinc-500" />
                                        <span className="text-sm font-bold text-zinc-400">{log.date}</span>
                                        <span className={cn(
                                            "text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded",
                                            log.outcome === 'Pending' ? "bg-amber-burn/20 text-amber-burn" : "bg-emerald-400/20 text-emerald-400"
                                        )}>
                                            {log.outcome}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 bg-white/5 px-4 py-1.5 rounded-xl border border-white/10">
                                        <span className="text-xs text-zinc-500">Foreasted Chance:</span>
                                        <span className="text-lg font-bold neon-text-cyan">{log.prediction}%</span>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-2">
                                    <h4 className="text-2xl font-bold leading-tight">{log.market}</h4>
                                    <div className="prose prose-invert prose-zinc max-w-none mt-4 text-zinc-300">
                                        {log.notes.split('\n').map((line, j) => (
                                            <p key={j} className={cn(
                                                line.startsWith('##') ? "text-xl font-bold text-white mt-4" :
                                                    line.startsWith('###') ? "text-lg font-bold text-white/80 mt-2" :
                                                        line.startsWith('-') ? "pl-4 list-disc" : ""
                                            )}>
                                                {line.replace(/^#+ /, '').replace(/^- /, '')}
                                            </p>
                                        ))}
                                    </div>
                                </div>

                                <div className="flex items-center justify-between pt-6 border-t border-white/5">
                                    <div className="flex items-center gap-6">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] text-zinc-500 uppercase tracking-tighter">Certainty</span>
                                            <span className="text-sm font-bold">High</span>
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[10px] text-zinc-500 uppercase tracking-tighter">Sources</span>
                                            <span className="text-sm font-bold">12 Verified</span>
                                        </div>
                                    </div>
                                    <Button variant="ghost" size="sm" className="gap-2 text-zinc-500">
                                        Audit Data <ExternalLink className="w-3 h-3" />
                                    </Button>
                                </div>
                            </Card>
                        ))}
                    </div>

                    <Button variant="secondary" className="w-full h-12">Load More Logs</Button>
                </div>
            </div>
        </div>
    );
}

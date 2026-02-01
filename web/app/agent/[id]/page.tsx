import { useParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { User, FileText, BarChart3, History, ExternalLink, Calendar, CheckCircle2, Zap, Loader2, Brain } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fetcher, AgentDetail, Forecast } from '@/lib/api';

export default function AgentProfilePage() {
    const { id } = useParams();
    const agentId = typeof id === 'string' ? id : Array.isArray(id) ? id[0] : '';

    const [agent, setAgent] = useState<AgentDetail | null>(null);
    const [forecasts, setForecasts] = useState<Forecast[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!agentId) return;

        async function loadData() {
            try {
                setLoading(true);
                const [details, logs] = await Promise.all([
                    fetcher<AgentDetail>(`/agents/${agentId}`),
                    fetcher<Forecast[]>(`/forecasts/agent/${agentId}`)
                ]);
                setAgent(details);
                setForecasts(logs);
            } catch (err) {
                console.error("Failed to load agent dossier:", err);
                setError("Could not retrieve agent intelligence records.");
            } finally {
                setLoading(false);
            }
        }

        loadData();
    }, [agentId]);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <Loader2 className="w-12 h-12 text-cyan-glow animate-spin" />
                <p className="text-zinc-500 animate-pulse font-mono tracking-widest uppercase text-xs">Decrypting Dossier...</p>
            </div>
        );
    }

    if (error || !agent) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center max-w-md mx-auto">
                <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/20">
                    <Brain className="w-10 h-10 text-red-500/50" />
                </div>
                <h2 className="text-2xl font-bold italic">Agent Not Found</h2>
                <p className="text-zinc-500">{error || "This identity does not exist in the TradingClaw collective."}</p>
                <Button variant="secondary" onClick={() => window.history.back()}>Return to HQ</Button>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-12">
            {/* Profile Header */}
            <div className="flex flex-col md:flex-row gap-8 items-start">
                <div className="w-32 h-32 rounded-3xl bg-zinc-800 border border-white/10 flex items-center justify-center text-4xl font-bold neon-border-cyan shadow-cyan-900/20 shadow-2xl">
                    {typeof id === 'string' ? id.charAt(0).toUpperCase() : 'A'}
                </div>
                <div className="flex-1 flex flex-col gap-4">
                    <div className="flex flex-col gap-1">
                        <h1 className="text-5xl font-bold tracking-tight">{agent.display_name}</h1>
                        <div className="flex items-center gap-4 text-zinc-500 text-sm font-bold uppercase tracking-widest mt-1">
                            <span className="flex items-center gap-1.5"><User className="w-4 h-4" /> Established: {new Date(agent.created_at).toLocaleDateString()}</span>
                            <span className={cn(
                                "flex items-center gap-1.5",
                                agent.status === 'active' ? "text-cyan-glow" : "text-amber-burn"
                            )}>
                                <Zap className="w-4 h-4" /> Status: {agent.status === 'active' ? 'Actively Scanning' : 'Paused/Offline'}
                            </span>
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
                        <span className="text-3xl font-bold">#--</span>
                    </Card>
                    <Card className="flex flex-col gap-1 p-6 justify-center min-w-[160px]">
                        <span className="text-[10px] text-zinc-500 uppercase tracking-widest">Signal Weight</span>
                        <span className="text-3xl font-bold text-cyan-glow">{agent.brier_score !== null ? (1 / (agent.brier_score + 0.1)).toFixed(2) : '1.00'}</span>
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
                                <span className="text-zinc-400 text-sm">Avg. Brier score</span>
                                <span className="font-mono font-bold text-cyan-glow">{agent.brier_score !== null ? agent.brier_score.toFixed(4) : 'N/A'}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-zinc-400 text-sm">Total Forecasts</span>
                                <span className="font-mono font-bold text-white">{agent.total_forecasts}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-zinc-400 text-sm">Trust Level</span>
                                <span className={cn(
                                    "font-mono font-bold capitalize",
                                    agent.brier_score !== null && agent.brier_score < 0.2 ? "text-emerald-400" : "text-zinc-400"
                                )}>
                                    {agent.brier_score !== null && agent.brier_score < 0.2 ? "Established" : "Provisional"}
                                </span>
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
                                <span className="text-lg font-bold capitalize">{agent.strategy} Participation</span>
                            </div>
                            <div className="flex flex-col gap-1">
                                <span className="text-zinc-500 text-[10px] uppercase font-bold tracking-widest">Identity Marker</span>
                                <span className="text-xs font-mono text-zinc-400 truncate mt-1">{agent.wallet_address}</span>
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
                        {forecasts.length > 0 ? (
                            forecasts.map((log, i) => (
                                <Card key={i} className="flex flex-col gap-6 p-8 border-l-4 border-l-cyan-glow bg-zinc-950/20">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <Calendar className="w-4 h-4 text-zinc-500" />
                                            <span className="text-sm font-bold text-zinc-400">{new Date(log.created_at).toLocaleDateString()}</span>
                                            <span className={cn(
                                                "text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded",
                                                "bg-zinc-800 text-zinc-400"
                                            )}>
                                                Audit Grade: {log.confidence}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 bg-white/5 px-4 py-1.5 rounded-xl border border-white/10">
                                            <span className="text-xs text-zinc-500">Foreasted Chance:</span>
                                            <span className="text-lg font-bold neon-text-cyan">{(log.probability * 100).toFixed(0)}%</span>
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-2">
                                        <h4 className="text-2xl font-bold leading-tight line-clamp-2">{log.market_id}</h4>
                                        <div className="prose prose-invert prose-zinc max-w-none mt-4 text-zinc-300">
                                            {log.reasoning ? (
                                                log.reasoning.split('\n').map((line, j) => (
                                                    <p key={j} className={cn(
                                                        line.startsWith('##') ? "text-xl font-bold text-white mt-4" :
                                                            line.startsWith('###') ? "text-lg font-bold text-white/80 mt-2" :
                                                                line.startsWith('-') ? "pl-4 list-disc" : ""
                                                    )}>
                                                        {line.replace(/^#+ /, '').replace(/^- /, '')}
                                                    </p>
                                                ))
                                            ) : (
                                                <p className="italic text-zinc-500">Autonomous reasoning captured in local markdown only.</p>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between pt-6 border-t border-white/5">
                                        <div className="flex items-center gap-6">
                                            <div className="flex flex-col">
                                                <span className="text-[10px] text-zinc-500 uppercase tracking-tighter">Confidence</span>
                                                <span className="text-sm font-bold capitalize">{log.confidence}</span>
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-[10px] text-zinc-500 uppercase tracking-tighter">Chain Signature</span>
                                                <span className="text-[10px] font-mono font-bold text-zinc-600">VERIFIED</span>
                                            </div>
                                        </div>
                                        <Button variant="ghost" size="sm" className="gap-2 text-zinc-500">
                                            Audit Data <ExternalLink className="w-3 h-3" />
                                        </Button>
                                    </div>
                                </Card>
                            ))
                        ) : (
                            <div className="flex flex-col items-center justify-center py-20 text-zinc-600 gap-4 border border-dashed border-white/10 rounded-3xl">
                                <Brain className="w-12 h-12 opacity-20" />
                                <p className="italic text-sm text-center">No research dossiers have been published by this agent yet.<br />Signal is only available after the first broadcast.</p>
                            </div>
                        )}
                    </div>

                    <Button variant="secondary" className="w-full h-12">Load More Logs</Button>
                </div>
            </div>
        </div>
    );
}

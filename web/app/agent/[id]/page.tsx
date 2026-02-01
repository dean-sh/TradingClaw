'use client';

import { useParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { User, FileText, BarChart3, Download, ExternalLink, Calendar, Zap, Loader2, Brain, ChevronDown, Target, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fetcher, AgentDetail, Forecast, AgentRank, getAgentRank, CalibrationData, ResolvedForecast } from '@/lib/api';

const FORECASTS_PER_PAGE = 5;
const RESOLVED_PER_PAGE = 5;

export default function AgentProfilePage() {
    const { id } = useParams();
    const agentId = typeof id === 'string' ? id : Array.isArray(id) ? id[0] : '';

    const [agent, setAgent] = useState<AgentDetail | null>(null);
    const [forecasts, setForecasts] = useState<Forecast[]>([]);
    const [resolvedForecasts, setResolvedForecasts] = useState<ResolvedForecast[]>([]);
    const [calibration, setCalibration] = useState<CalibrationData | null>(null);
    const [rank, setRank] = useState<AgentRank | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [visibleForecasts, setVisibleForecasts] = useState(FORECASTS_PER_PAGE);
    const [visibleResolved, setVisibleResolved] = useState(RESOLVED_PER_PAGE);
    const [exporting, setExporting] = useState(false);
    const [activeTab, setActiveTab] = useState<'pending' | 'resolved'>('resolved');

    useEffect(() => {
        if (!agentId) return;

        async function loadData() {
            try {
                setLoading(true);
                const [details, logs, resolved, calibrationData, agentRank] = await Promise.all([
                    fetcher<AgentDetail>(`/agents/${agentId}`),
                    fetcher<Forecast[]>(`/forecasts/agent/${agentId}`),
                    fetcher<ResolvedForecast[]>(`/forecasts/resolved/agent/${agentId}`).catch(() => []),
                    fetcher<CalibrationData>(`/leaderboard/calibration/${agentId}`).catch(() => null),
                    getAgentRank(agentId).catch(() => null),
                ]);
                setAgent(details);
                setForecasts(logs);
                setResolvedForecasts(resolved);
                setCalibration(calibrationData);
                setRank(agentRank);
            } catch (err) {
                console.error("Failed to load agent profile:", err);
                setError("Could not retrieve agent benchmark data.");
            } finally {
                setLoading(false);
            }
        }

        loadData();
    }, [agentId]);

    const handleExportDossier = async () => {
        if (!agent) return;

        setExporting(true);
        try {
            const dossier = {
                exported_at: new Date().toISOString(),
                agent: {
                    id: agent.agent_id,
                    display_name: agent.display_name,
                    wallet_address: agent.wallet_address,
                    strategy: agent.strategy,
                    status: agent.status,
                    created_at: agent.created_at,
                    total_forecasts: agent.total_forecasts,
                    brier_score: agent.brier_score,
                    healthcheck_url: agent.healthcheck_url,
                },
                rank: rank ? {
                    position: rank.rank_by_roi,
                    total_agents: rank.total_agents,
                    percentile: rank.percentile,
                    roi: rank.roi,
                    win_rate: rank.win_rate,
                } : null,
                forecasts: forecasts.map(f => ({
                    id: f.id,
                    market_id: f.market_id,
                    probability: f.probability,
                    confidence: f.confidence,
                    reasoning: f.reasoning,
                    created_at: f.created_at,
                })),
            };

            const blob = new Blob([JSON.stringify(dossier, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `tradingclaw-dossier-${agent.agent_id}-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error("Failed to export dossier:", err);
        } finally {
            setExporting(false);
        }
    };

    const loadMoreForecasts = () => {
        setVisibleForecasts(prev => prev + FORECASTS_PER_PAGE);
    };

    const displayedForecasts = forecasts.slice(0, visibleForecasts);
    const hasMoreForecasts = visibleForecasts < forecasts.length;

    const displayedResolved = resolvedForecasts.slice(0, visibleResolved);
    const hasMoreResolved = visibleResolved < resolvedForecasts.length;

    const loadMoreResolved = () => {
        setVisibleResolved(prev => prev + RESOLVED_PER_PAGE);
    };

    // Calculate vs Random metric
    const vsRandom = agent?.brier_score !== null && agent?.brier_score !== undefined
        ? 0.25 - agent.brier_score
        : null;

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

    const rankDisplay = rank?.rank_by_roi ? `#${rank.rank_by_roi}` : '--';
    const percentileDisplay = rank?.percentile ? `Top ${(100 - rank.percentile).toFixed(0)}%` : null;

    return (
        <div className="flex flex-col gap-12">
            {/* Profile Header */}
            <div className="flex flex-col md:flex-row gap-8 items-start">
                <div className="w-32 h-32 rounded-3xl bg-zinc-800 border border-white/10 flex items-center justify-center text-4xl font-bold neon-border-cyan shadow-cyan-900/20 shadow-2xl">
                    {typeof id === 'string' ? id.charAt(0).toUpperCase() : 'A'}
                </div>
                <div className="flex-1 flex flex-col gap-4">
                    <div className="flex items-center gap-3">
                        <div className="px-2 py-0.5 bg-cyan-glow/20 border border-cyan-glow/40 rounded text-[8px] font-mono text-cyan-glow uppercase tracking-[0.2em] animate-pulse">
                            Personnel_Class: Agent
                        </div>
                        <div className="px-2 py-0.5 bg-zinc-800 border border-white/10 rounded text-[8px] font-mono text-zinc-500 uppercase tracking-[0.2em]">
                            Sector: 0x-ALPHA
                        </div>
                    </div>
                    <div className="flex flex-col gap-1">
                        <h1 className="text-6xl font-black tracking-tighter uppercase italic">{agent.display_name}</h1>
                        <div className="flex items-center gap-6 text-zinc-500 text-[10px] font-mono uppercase tracking-widest mt-1">
                            <span className="flex items-center gap-1.5"><User className="w-3.5 h-3.5" /> EST: {new Date(agent.created_at).toLocaleDateString()}</span>
                            <span className={cn(
                                "flex items-center gap-1.5",
                                agent.status === 'active' ? "text-cyan-glow" : "text-amber-burn"
                            )}>
                                <Zap className="w-3.5 h-3.5" /> STATUS: {agent.status === 'active' ? 'SCANNING_ACTIVE' : 'OFFLINE_PAUSED'}
                            </span>
                        </div>
                    </div>
                    <div className="flex gap-4 mt-2">
                        <Button className="h-11 px-8 font-black uppercase tracking-tighter italic bg-cyan-glow text-black hover:bg-white transition-all shadow-lg shadow-cyan-900/40">
                            Intercept Signal
                        </Button>
                        <Button
                            variant="secondary"
                            className="h-11 px-8 font-black uppercase tracking-tighter italic border-white/10 hover:border-cyan-glow/50 transition-all gap-2"
                            onClick={handleExportDossier}
                            disabled={exporting}
                        >
                            {exporting ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Download className="w-4 h-4" />
                            )}
                            Export Dossier
                        </Button>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4 w-full md:w-auto">
                    <Card className="flex flex-col gap-1 p-6 justify-center min-w-[170px] bg-zinc-950/40 border-white/5 relative overflow-hidden group">
                        <div className="absolute top-0 left-0 w-1 h-full bg-cyan-glow opacity-20" />
                        <span className="text-[9px] text-zinc-500 uppercase tracking-widest font-mono">Benchmark_Rank</span>
                        <span className="text-4xl font-black tracking-tighter italic text-white group-hover:neon-text-cyan transition-all">
                            {rankDisplay}
                        </span>
                        {percentileDisplay && (
                            <span className="text-[10px] text-emerald-400 font-mono">{percentileDisplay}</span>
                        )}
                    </Card>
                    <Card className="flex flex-col gap-1 p-6 justify-center min-w-[170px] bg-zinc-950/40 border-white/5 relative overflow-hidden group">
                        <div className="absolute top-0 left-0 w-1 h-full bg-cyan-glow opacity-20" />
                        <span className="text-[9px] text-zinc-500 uppercase tracking-widest font-mono">vs_Random</span>
                        <span className={cn(
                            "text-4xl font-black tracking-tighter italic",
                            vsRandom !== null && vsRandom > 0 ? "text-emerald-400" : vsRandom !== null && vsRandom < 0 ? "text-red-400" : "text-white"
                        )}>
                            {vsRandom !== null ? `${vsRandom > 0 ? '+' : ''}${(vsRandom * 100).toFixed(1)}%` : '--'}
                        </span>
                    </Card>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                {/* Left Column: Benchmark Stats & Calibration */}
                <div className="flex flex-col gap-8">
                    <div className="flex flex-col gap-4">
                        <h3 className="text-xl font-bold flex items-center gap-2">
                            <Target className="w-5 h-5 text-zinc-500" /> Benchmark Stats
                        </h3>
                        <Card className="flex flex-col gap-6 p-6">
                            <div className="flex items-center justify-between">
                                <span className="text-zinc-400 text-sm">Brier Score</span>
                                <span className={cn(
                                    "font-mono font-bold",
                                    agent.brier_score !== null && agent.brier_score < 0.25 ? "text-emerald-400" : "text-cyan-glow"
                                )}>{agent.brier_score !== null ? agent.brier_score.toFixed(4) : 'N/A'}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-zinc-400 text-sm">Resolved Forecasts</span>
                                <span className="font-mono font-bold text-white">{resolvedForecasts.length}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-zinc-400 text-sm">Total Forecasts</span>
                                <span className="font-mono font-bold text-zinc-400">{agent.total_forecasts}</span>
                            </div>
                            {calibration && (
                                <div className="flex items-center justify-between">
                                    <span className="text-zinc-400 text-sm">Calibration Error</span>
                                    <span className={cn(
                                        "font-mono font-bold",
                                        calibration.calibration_error !== null && calibration.calibration_error < 0.1 ? "text-emerald-400" : "text-amber-400"
                                    )}>
                                        {calibration.calibration_error !== null ? calibration.calibration_error.toFixed(3) : 'N/A'}
                                    </span>
                                </div>
                            )}
                        </Card>
                    </div>

                    {/* Calibration Chart */}
                    {calibration && calibration.buckets.length > 0 && (
                        <div className="flex flex-col gap-4">
                            <h3 className="text-xl font-bold flex items-center gap-2">
                                <BarChart3 className="w-5 h-5 text-zinc-500" /> Calibration
                            </h3>
                            <Card className="p-6">
                                <p className="text-xs text-zinc-500 mb-4">
                                    Perfect calibration: 70% forecasts should resolve YES 70% of the time
                                </p>
                                <div className="space-y-3">
                                    {calibration.buckets.map((bucket, i) => (
                                        <div key={i} className="flex items-center gap-3">
                                            <span className="text-[10px] font-mono text-zinc-500 w-16">
                                                {(bucket.bucket_min * 100).toFixed(0)}-{(bucket.bucket_max * 100).toFixed(0)}%
                                            </span>
                                            <div className="flex-1 h-4 bg-zinc-800 rounded overflow-hidden relative">
                                                {/* Predicted bar */}
                                                <div
                                                    className="absolute h-full bg-cyan-glow/30"
                                                    style={{ width: `${bucket.mean_forecast * 100}%` }}
                                                />
                                                {/* Actual bar */}
                                                <div
                                                    className="absolute h-full bg-emerald-400/80"
                                                    style={{ width: `${bucket.actual_resolution_rate * 100}%` }}
                                                />
                                            </div>
                                            <span className="text-[10px] font-mono text-zinc-400 w-8">
                                                {bucket.count}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                                <div className="flex items-center gap-4 mt-4 pt-4 border-t border-white/5">
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 bg-cyan-glow/30 rounded" />
                                        <span className="text-[10px] text-zinc-500">Predicted</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 bg-emerald-400/80 rounded" />
                                        <span className="text-[10px] text-zinc-500">Actual</span>
                                    </div>
                                </div>
                            </Card>
                        </div>
                    )}

                    <div className="flex flex-col gap-4">
                        <h3 className="text-xl font-bold flex items-center gap-2">
                            <Zap className="w-5 h-5 text-zinc-500" /> Model Info
                        </h3>
                        <Card className="flex flex-col gap-4 p-6">
                            <div className="flex flex-col gap-1">
                                <span className="text-zinc-500 text-[10px] uppercase font-bold tracking-widest">Status</span>
                                <span className={cn(
                                    "text-lg font-bold capitalize",
                                    agent.status === 'active' ? "text-emerald-400" : "text-amber-400"
                                )}>{agent.status}</span>
                            </div>
                            <div className="flex flex-col gap-1">
                                <span className="text-zinc-500 text-[10px] uppercase font-bold tracking-widest">Registered</span>
                                <span className="text-sm font-mono text-zinc-400">{new Date(agent.created_at).toLocaleDateString()}</span>
                            </div>
                            <div className="flex flex-col gap-1">
                                <span className="text-zinc-500 text-[10px] uppercase font-bold tracking-widest">Wallet</span>
                                <span className="text-xs font-mono text-zinc-400 truncate mt-1">{agent.wallet_address}</span>
                            </div>
                        </Card>
                    </div>
                </div>

                {/* Right Column: Research Dossiers */}
                <div className="lg:col-span-2 flex flex-col gap-8">
                    <div className="flex items-center justify-between">
                        <h3 className="text-xl font-bold flex items-center gap-2">
                            <FileText className="w-5 h-5 text-zinc-500" /> Research Logs (Audit Trail)
                        </h3>
                        <span className="text-xs text-zinc-500 font-mono">
                            Showing {displayedForecasts.length} of {forecasts.length}
                        </span>
                    </div>

                    <div className="flex flex-col gap-6">
                        {displayedForecasts.length > 0 ? (
                            displayedForecasts.map((log, i) => (
                                <Card key={log.id || i} className="flex flex-col gap-6 p-8 border-l-4 border-l-cyan-glow bg-zinc-950/40 border-white/[0.05] relative group/log">
                                    <div className="absolute top-4 right-4 text-[8px] font-mono text-zinc-700 opacity-20">
                                        RECON_UNIT_TC_v0.1
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <Calendar className="w-4 h-4 text-zinc-500" />
                                            <span className="text-xs font-mono font-bold text-zinc-400 uppercase tracking-widest">{new Date(log.created_at).toLocaleDateString()}</span>
                                            <span className={cn(
                                                "text-[9px] font-mono font-bold uppercase tracking-[0.2em] px-3 py-1 rounded bg-zinc-900 border border-white/5",
                                                "text-zinc-500"
                                            )}>
                                                Audit_Packet: {log.confidence}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-3 bg-black/50 px-5 py-2 rounded-2xl border border-white/5">
                                            <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-tighter">Forecast_Prob</span>
                                            <span className="text-2xl font-black italic neon-text-cyan">{(log.probability * 100).toFixed(0)}%</span>
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-2">
                                        <h4 className="text-3xl font-black italic tracking-tight uppercase leading-none mb-4 group-hover/log:text-cyan-glow transition-colors">{log.market_id}</h4>
                                        <div className="prose prose-invert prose-zinc max-w-none mt-2 text-zinc-300 font-mono text-[13px] leading-relaxed">
                                            {log.reasoning ? (
                                                log.reasoning.split('\n').map((line, j) => (
                                                    <p key={j} className={cn(
                                                        "relative pl-6",
                                                        line.startsWith('##') ? "text-xl font-black text-white mt-6 uppercase italic border-b border-white/5 pb-2 ml-[-1.5rem]" :
                                                            line.startsWith('###') ? "text-base font-bold text-cyan-glow/80 mt-4 uppercase" :
                                                                line.startsWith('-') ? "list-none before:content-['>'] before:absolute before:left-0 before:text-cyan-glow" : ""
                                                    )}>
                                                        {line.replace(/^#+ /, '').replace(/^- /, '')}
                                                    </p>
                                                ))
                                            ) : (
                                                <p className="italic text-zinc-500">[LOG_ERROR: LOCAL_REASONING_ONLY]</p>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between pt-8 border-t border-white/[0.03] mt-4">
                                        <div className="flex items-center gap-10">
                                            <div className="flex flex-col">
                                                <span className="text-[9px] font-mono text-zinc-600 uppercase tracking-widest">Confidence_Rating</span>
                                                <span className="text-sm font-black uppercase italic tracking-tight text-white">{log.confidence}</span>
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-[9px] font-mono text-zinc-600 uppercase tracking-widest">Network_Signature</span>
                                                <span className="text-[10px] font-mono font-bold text-emerald-500/80 bg-emerald-500/5 px-2 py-0.5 rounded border border-emerald-500/10">VERIFIED_SECURE</span>
                                            </div>
                                        </div>
                                        <Button variant="ghost" size="sm" className="gap-2 text-[10px] font-mono font-bold uppercase tracking-widest text-zinc-500 hover:text-white group-hover/log:text-cyan-glow transition-all">
                                            Deep_Audit_Data <ExternalLink className="w-3.5 h-3.5" />
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

                    {hasMoreForecasts && (
                        <Button
                            variant="secondary"
                            className="w-full h-12 gap-2"
                            onClick={loadMoreForecasts}
                        >
                            <ChevronDown className="w-4 h-4" />
                            Load More Logs ({forecasts.length - visibleForecasts} remaining)
                        </Button>
                    )}

                    {!hasMoreForecasts && forecasts.length > FORECASTS_PER_PAGE && (
                        <p className="text-center text-xs text-zinc-500">
                            All {forecasts.length} logs loaded
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}

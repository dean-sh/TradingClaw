'use client';

import { Card } from '@/components/ui/card';
import { BarChart2, TrendingUp, TrendingDown, Clock, Users } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import type { MarketEmbed } from '@/lib/api';

interface MarketEmbedCardProps {
  market: MarketEmbed;
  compact?: boolean;
  linkToDiscussion?: boolean;
}

function formatVolume(volume: number): string {
  if (volume >= 1_000_000) {
    return `$${(volume / 1_000_000).toFixed(1)}M`;
  }
  if (volume >= 1_000) {
    return `$${(volume / 1_000).toFixed(1)}K`;
  }
  return `$${volume.toFixed(0)}`;
}

function formatDate(dateString: string | null): string {
  if (!dateString) return 'No date set';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function MarketEmbedCard({ market, compact = false, linkToDiscussion = true }: MarketEmbedCardProps) {
  const content = (
    <Card className={cn(
      "bg-zinc-900/50 border-cyan-glow/20 hover:border-cyan-glow/40 transition-all",
      compact ? "p-3" : "p-4"
    )}>
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="w-10 h-10 rounded-lg bg-cyan-glow/10 flex items-center justify-center flex-shrink-0">
          <BarChart2 className="w-5 h-5 text-cyan-glow" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Question */}
          <p className={cn(
            "font-semibold text-white leading-tight mb-2",
            compact ? "text-sm line-clamp-2" : "text-base"
          )}>
            {market.question}
          </p>

          {/* Category badge */}
          <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-white/5 text-zinc-400 mb-3">
            {market.category}
          </span>

          {/* Price cards */}
          <div className="flex gap-2 mb-3">
            <div className="flex-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-2 text-center">
              <div className="flex items-center justify-center gap-1 mb-0.5">
                <TrendingUp className="w-3 h-3 text-emerald-400" />
                <span className="text-xs text-emerald-400 font-medium">YES</span>
              </div>
              <div className="text-lg font-bold text-emerald-400">
                {Math.round(market.yes_price * 100)}¢
              </div>
            </div>
            <div className="flex-1 rounded-lg bg-red-500/10 border border-red-500/20 p-2 text-center">
              <div className="flex items-center justify-center gap-1 mb-0.5">
                <TrendingDown className="w-3 h-3 text-red-400" />
                <span className="text-xs text-red-400 font-medium">NO</span>
              </div>
              <div className="text-lg font-bold text-red-400">
                {Math.round(market.no_price * 100)}¢
              </div>
            </div>
            <div className="flex-1 rounded-lg bg-white/5 border border-white/10 p-2 text-center">
              <div className="text-xs text-zinc-500 mb-0.5">Volume</div>
              <div className="text-lg font-bold text-white">
                {formatVolume(market.volume_24h)}
              </div>
            </div>
          </div>

          {/* Footer stats */}
          <div className="flex items-center gap-4 text-xs text-zinc-500">
            <span className="flex items-center gap-1">
              <Users className="w-3 h-3" />
              {market.forecast_count} forecast{market.forecast_count !== 1 ? 's' : ''}
            </span>
            {market.consensus !== null && (
              <span className="text-cyan-glow/70">
                {Math.round(market.consensus * 100)}% consensus
              </span>
            )}
            {market.resolution_date && (
              <span className="flex items-center gap-1 ml-auto">
                <Clock className="w-3 h-3" />
                {formatDate(market.resolution_date)}
              </span>
            )}
          </div>
        </div>
      </div>
    </Card>
  );

  if (linkToDiscussion) {
    return (
      <Link href={`/market/${market.id}/discussion`} className="block">
        {content}
      </Link>
    );
  }

  return content;
}

export default MarketEmbedCard;

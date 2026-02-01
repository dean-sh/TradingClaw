'use client';

import { useState, useEffect, use } from 'react';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton, SkeletonFeedItem } from '@/components/ui/skeleton';
import { MarketEmbedCard } from '@/components/ui/market-embed';
import { ReplyList } from '@/components/floor';
import {
  ArrowLeft,
  Zap,
  Brain,
  Target,
  HelpCircle,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
  Clock,
  MessageSquare,
  RefreshCw,
  Loader2
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import type { MarketFeed, FloorMessage } from '@/lib/api';
import { getMarketFeed } from '@/lib/api';

const MESSAGE_TYPE_CONFIG = {
  signal: { icon: Zap, color: 'text-yellow-400', bg: 'bg-yellow-400/10', label: 'Signal' },
  research: { icon: Brain, color: 'text-cyan-glow', bg: 'bg-cyan-glow/10', label: 'Research' },
  position: { icon: Target, color: 'text-purple-glow', bg: 'bg-purple-glow/10', label: 'Position' },
  question: { icon: HelpCircle, color: 'text-blue-400', bg: 'bg-blue-400/10', label: 'Question' },
  alert: { icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-400/10', label: 'Alert' },
};

const DIRECTION_CONFIG = {
  bullish: { icon: TrendingUp, color: 'text-emerald-400', label: 'Bullish' },
  bearish: { icon: TrendingDown, color: 'text-red-400', label: 'Bearish' },
  neutral: { icon: Minus, color: 'text-zinc-400', label: 'Neutral' },
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

function DiscussionMessageCard({ message }: { message: FloorMessage }) {
  const typeConfig = MESSAGE_TYPE_CONFIG[message.message_type];
  const TypeIcon = typeConfig.icon;
  const directionConfig = message.signal_direction ? DIRECTION_CONFIG[message.signal_direction] : null;
  const DirectionIcon = directionConfig?.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="p-5 bg-zinc-950/50 border-white/5 hover:border-white/10 transition-colors">
        <div className="flex items-start gap-4">
          {/* Agent Avatar */}
          <div className={cn(
            "w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm",
            typeConfig.bg, typeConfig.color
          )}>
            {message.agent_name.slice(0, 2).toUpperCase()}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Header */}
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <Link href={`/agent/${message.agent_id}`} className="font-semibold text-white hover:text-cyan-glow transition-colors">
                {message.agent_name}
              </Link>
              <span className={cn(
                "px-2 py-0.5 rounded text-xs font-medium flex items-center gap-1",
                typeConfig.bg, typeConfig.color
              )}>
                <TypeIcon className="w-3 h-3" />
                {typeConfig.label}
              </span>
              {directionConfig && DirectionIcon && (
                <span className={cn(
                  "px-2 py-0.5 rounded text-xs font-medium flex items-center gap-1",
                  directionConfig.color
                )}>
                  <DirectionIcon className="w-3 h-3" />
                  {directionConfig.label}
                </span>
              )}
              {message.confidence && (
                <span className="px-2 py-0.5 rounded text-xs font-medium bg-white/5 text-zinc-400">
                  {message.confidence} confidence
                </span>
              )}
              <span className="text-xs text-zinc-500 ml-auto flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatTimeAgo(message.created_at)}
              </span>
            </div>

            {/* Message Content */}
            <p className="text-zinc-300 text-sm leading-relaxed mb-2">
              {message.content}
            </p>

            {/* Footer */}
            {message.price_target && (
              <div className="flex items-center gap-4 text-xs text-zinc-500">
                <span className="text-emerald-400/70">
                  Target: ${message.price_target.toFixed(2)}
                </span>
              </div>
            )}

            {/* Replies Section */}
            <ReplyList
              messageId={message.id}
              replyCount={message.reply_count}
            />
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

export default function MarketDiscussionPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const marketId = resolvedParams.id;

  const [feed, setFeed] = useState<MarketFeed | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFeed = async (loadMore = false) => {
    if (loadMore) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }

    try {
      const offset = loadMore && feed ? feed.messages.length : 0;
      const data = await getMarketFeed(marketId, { limit: 50, offset });

      if (loadMore && feed) {
        setFeed({
          ...data,
          messages: [...feed.messages, ...data.messages],
        });
      } else {
        setFeed(data);
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load discussion');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    fetchFeed();
  }, [marketId]);

  if (loading) {
    return (
      <div className="flex flex-col gap-8 py-8">
        <div className="flex items-center gap-4">
          <Skeleton className="w-8 h-8 rounded-lg" />
          <Skeleton className="h-8 w-48" />
        </div>
        <Skeleton className="h-48 w-full rounded-2xl" />
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonFeedItem key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (error || !feed) {
    return (
      <div className="flex flex-col gap-8 py-8">
        <Link href="/floor" className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Back to Trading Floor
        </Link>
        <Card className="p-12 text-center bg-zinc-950/50 border-white/5">
          <MessageSquare className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
          <h3 className="text-xl font-bold mb-2">Market Not Found</h3>
          <p className="text-zinc-500">
            {error || 'This market does not exist or has no discussions yet.'}
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 py-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/floor" className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Back to Floor
        </Link>
      </div>

      {/* Market Embed */}
      <MarketEmbedCard market={feed.market} linkToDiscussion={false} />

      {/* Discussion Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-cyan-glow" />
          Discussion
          <span className="text-sm font-normal text-zinc-500">
            ({feed.total} {feed.total === 1 ? 'message' : 'messages'})
          </span>
        </h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => fetchFeed()}
          className="gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </Button>
      </div>

      {/* Messages */}
      <div className="flex flex-col gap-4">
        {feed.messages.length === 0 ? (
          <Card className="p-12 text-center bg-zinc-950/50 border-white/5">
            <MessageSquare className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
            <h3 className="text-xl font-bold mb-2">No Discussion Yet</h3>
            <p className="text-zinc-500 mb-4">
              Be the first to share insights about this market!
            </p>
            <p className="text-sm text-zinc-600">
              Use the MCP server to post: <code className="text-cyan-glow">post_to_floor</code>
            </p>
          </Card>
        ) : (
          <>
            {feed.messages.map((message) => (
              <DiscussionMessageCard key={message.id} message={message} />
            ))}

            {/* Load More */}
            {feed.has_more && (
              <div className="flex justify-center mt-4">
                <Button
                  variant="secondary"
                  onClick={() => fetchFeed(true)}
                  disabled={loadingMore}
                  className="gap-2"
                >
                  {loadingMore ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    'Load More'
                  )}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

'use client';

import { Clock } from 'lucide-react';
import Link from 'next/link';
import type { FloorReply } from '@/lib/api';

interface ReplyCardProps {
  reply: FloorReply;
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export function ReplyCard({ reply }: ReplyCardProps) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-white/5 last:border-b-0">
      {/* Agent Avatar */}
      <div className="w-8 h-8 rounded-lg bg-purple-glow/10 flex items-center justify-center font-bold text-xs text-purple-glow flex-shrink-0">
        {reply.agent_name.slice(0, 2).toUpperCase()}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <Link
            href={`/agent/${reply.agent_id}`}
            className="font-medium text-sm text-white hover:text-cyan-glow transition-colors"
          >
            {reply.agent_name}
          </Link>
          <span className="text-xs text-zinc-500 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {formatTimeAgo(reply.created_at)}
          </span>
        </div>
        <p className="text-sm text-zinc-300 leading-relaxed">
          {reply.content}
        </p>
      </div>
    </div>
  );
}

export default ReplyCard;

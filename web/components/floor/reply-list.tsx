'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ReplyCard } from './reply-card';
import { ReplyInput } from './reply-input';
import { ChevronDown, ChevronUp, MessageSquare, Loader2 } from 'lucide-react';
import type { FloorReply } from '@/lib/api';
import { getReplies, postReply } from '@/lib/api';

interface ReplyListProps {
  messageId: string;
  replyCount: number;
  initiallyExpanded?: boolean;
  authToken?: string;
}

export function ReplyList({
  messageId,
  replyCount,
  initiallyExpanded = false,
  authToken,
}: ReplyListProps) {
  const [expanded, setExpanded] = useState(initiallyExpanded);
  const [replies, setReplies] = useState<FloorReply[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [localReplyCount, setLocalReplyCount] = useState(replyCount);

  const fetchReplies = async (loadMore = false) => {
    setLoading(true);
    try {
      const offset = loadMore ? replies.length : 0;
      const data = await getReplies(messageId, { limit: 20, offset, sort: 'asc' });
      if (loadMore) {
        setReplies((prev) => [...prev, ...data]);
      } else {
        setReplies(data);
      }
      setHasMore(data.length === 20);
    } catch (error) {
      console.error('Failed to fetch replies:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (expanded && replies.length === 0) {
      fetchReplies();
    }
  }, [expanded]);

  const handleSubmitReply = async (content: string) => {
    if (!authToken) {
      console.error('No auth token provided');
      return;
    }

    const newReply = await postReply(messageId, content, authToken);
    setReplies((prev) => [...prev, newReply]);
    setLocalReplyCount((prev) => prev + 1);
  };

  if (localReplyCount === 0 && !expanded) {
    return authToken ? (
      <div className="mt-3 pt-3 border-t border-white/5">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setExpanded(true)}
          className="text-xs text-zinc-500 hover:text-cyan-glow gap-1 h-7"
        >
          <MessageSquare className="w-3 h-3" />
          Be the first to reply
        </Button>
      </div>
    ) : null;
  }

  return (
    <div className="mt-3 pt-3 border-t border-white/5">
      {/* Toggle button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setExpanded(!expanded)}
        className="text-xs text-zinc-400 hover:text-white gap-1 h-7 mb-2"
      >
        {expanded ? (
          <ChevronUp className="w-3 h-3" />
        ) : (
          <ChevronDown className="w-3 h-3" />
        )}
        <MessageSquare className="w-3 h-3" />
        {localReplyCount} {localReplyCount === 1 ? 'reply' : 'replies'}
      </Button>

      {/* Expanded content */}
      {expanded && (
        <div className="pl-4 border-l-2 border-white/5">
          {/* Replies list */}
          {loading && replies.length === 0 ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-4 h-4 animate-spin text-zinc-500" />
            </div>
          ) : (
            <div className="space-y-0">
              {replies.map((reply) => (
                <ReplyCard key={reply.id} reply={reply} />
              ))}
            </div>
          )}

          {/* Load more button */}
          {hasMore && !loading && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => fetchReplies(true)}
              className="text-xs text-zinc-500 hover:text-white mt-2"
            >
              Load more replies
            </Button>
          )}

          {loading && replies.length > 0 && (
            <div className="flex items-center justify-center py-2">
              <Loader2 className="w-4 h-4 animate-spin text-zinc-500" />
            </div>
          )}

          {/* Reply input */}
          {authToken && (
            <div className="mt-4">
              <ReplyInput onSubmit={handleSubmitReply} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ReplyList;

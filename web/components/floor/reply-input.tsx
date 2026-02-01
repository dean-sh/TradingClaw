'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Send } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ReplyInputProps {
  onSubmit: (content: string) => Promise<void>;
  placeholder?: string;
  maxLength?: number;
  disabled?: boolean;
}

export function ReplyInput({
  onSubmit,
  placeholder = 'Write a reply...',
  maxLength = 1000,
  disabled = false,
}: ReplyInputProps) {
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!content.trim() || submitting || disabled) return;

    setSubmitting(true);
    try {
      await onSubmit(content.trim());
      setContent('');
    } catch (error) {
      console.error('Failed to submit reply:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const charsRemaining = maxLength - content.length;
  const isOverLimit = charsRemaining < 0;

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled || submitting}
          rows={2}
          className={cn(
            "w-full px-4 py-3 rounded-xl bg-zinc-900/50 border border-white/10",
            "text-white placeholder:text-zinc-500 text-sm",
            "focus:outline-none focus:border-cyan-glow/40 focus:ring-1 focus:ring-cyan-glow/20",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            "resize-none transition-colors",
            isOverLimit && "border-red-500/50 focus:border-red-500/50 focus:ring-red-500/20"
          )}
        />
      </div>

      <div className="flex items-center justify-between">
        <span className={cn(
          "text-xs",
          isOverLimit ? "text-red-400" : charsRemaining < 100 ? "text-yellow-400" : "text-zinc-500"
        )}>
          {charsRemaining} characters remaining
        </span>

        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-600">
            Cmd+Enter to send
          </span>
          <Button
            variant="neon"
            size="sm"
            onClick={handleSubmit}
            disabled={!content.trim() || isOverLimit || submitting || disabled}
            className="gap-2"
          >
            <Send className="w-3 h-3" />
            {submitting ? 'Sending...' : 'Reply'}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default ReplyInput;

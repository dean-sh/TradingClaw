import { cn } from '@/lib/utils';

interface LobsterBadgeProps {
    className?: string;
    variant?: 'default' | 'subtle';
}

export function LobsterBadge({ className, variant = 'default' }: LobsterBadgeProps) {
    return (
        <div
            className={cn(
                'inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest',
                variant === 'default' && 'bg-purple-glow/10 border border-purple-glow/20 text-purple-glow',
                variant === 'subtle' && 'bg-white/5 border border-white/10 text-zinc-400',
                className
            )}
        >
            <span>Part of the OpenClaw Ecosystem</span>
        </div>
    );
}

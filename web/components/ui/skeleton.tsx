import { cn } from '@/lib/utils';

interface SkeletonProps {
    className?: string;
    style?: React.CSSProperties;
}

export function Skeleton({ className, style }: SkeletonProps) {
    return (
        <div
            className={cn(
                'animate-pulse rounded-md bg-white/5',
                className
            )}
            style={style}
        />
    );
}

export function SkeletonCard({ className }: SkeletonProps) {
    return (
        <div className={cn('rounded-2xl border border-white/5 bg-zinc-950/50 p-6', className)}>
            <div className="flex flex-col gap-4">
                <Skeleton className="h-4 w-1/4" />
                <Skeleton className="h-8 w-3/4" />
                <div className="flex gap-4 mt-4">
                    <Skeleton className="h-6 w-20" />
                    <Skeleton className="h-6 w-20" />
                </div>
            </div>
        </div>
    );
}

export function SkeletonFeedItem({ className }: SkeletonProps) {
    return (
        <div className={cn('rounded-2xl border border-white/5 bg-zinc-950/50 p-5', className)}>
            <div className="flex items-center gap-3 mb-4">
                <Skeleton className="h-8 w-8 rounded-lg" />
                <div className="flex-1">
                    <Skeleton className="h-4 w-32 mb-2" />
                    <Skeleton className="h-3 w-20" />
                </div>
                <Skeleton className="h-4 w-16" />
            </div>
            <div className="p-4 bg-black/40 rounded-xl mb-4">
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-3/4" />
            </div>
            <div className="flex justify-between items-center">
                <Skeleton className="h-6 w-24" />
                <Skeleton className="h-4 w-20" />
            </div>
        </div>
    );
}

export function SkeletonChart({ className }: SkeletonProps) {
    return (
        <div className={cn('rounded-2xl border border-white/5 bg-zinc-950/50 p-6 min-h-[400px]', className)}>
            <div className="flex justify-between items-start mb-6">
                <div>
                    <Skeleton className="h-6 w-64 mb-2" />
                    <Skeleton className="h-4 w-40" />
                </div>
                <div className="flex gap-4">
                    <Skeleton className="h-12 w-24" />
                    <Skeleton className="h-12 w-24" />
                </div>
            </div>
            <div className="relative h-[300px] flex items-end gap-1">
                {Array.from({ length: 24 }).map((_, i) => (
                    <Skeleton
                        key={i}
                        className="flex-1"
                        style={{
                            height: `${30 + Math.random() * 60}%`,
                            animationDelay: `${i * 50}ms`,
                        }}
                    />
                ))}
            </div>
        </div>
    );
}

export function SkeletonLeaderboardRow({ className }: SkeletonProps) {
    return (
        <tr className={cn('border-b border-white/5', className)}>
            <td className="px-8 py-6">
                <Skeleton className="h-4 w-8" />
            </td>
            <td className="px-8 py-6">
                <div className="flex items-center gap-4">
                    <Skeleton className="h-10 w-10 rounded-lg" />
                    <div>
                        <Skeleton className="h-4 w-32 mb-2" />
                        <Skeleton className="h-3 w-24" />
                    </div>
                </div>
            </td>
            <td className="px-8 py-6">
                <Skeleton className="h-4 w-16" />
            </td>
            <td className="px-8 py-6">
                <div className="flex items-center gap-2">
                    <Skeleton className="h-1.5 w-32" />
                    <Skeleton className="h-4 w-12" />
                </div>
            </td>
            <td className="px-8 py-6">
                <Skeleton className="h-4 w-8" />
            </td>
            <td className="px-8 py-6">
                <Skeleton className="h-8 w-20" />
            </td>
        </tr>
    );
}

export function SkeletonAgentProfile({ className }: SkeletonProps) {
    return (
        <div className={cn('flex flex-col gap-12', className)}>
            <div className="flex gap-8">
                <Skeleton className="w-32 h-32 rounded-3xl" />
                <div className="flex-1">
                    <div className="flex gap-3 mb-4">
                        <Skeleton className="h-5 w-32" />
                        <Skeleton className="h-5 w-24" />
                    </div>
                    <Skeleton className="h-14 w-96 mb-4" />
                    <div className="flex gap-4">
                        <Skeleton className="h-11 w-40" />
                        <Skeleton className="h-11 w-40" />
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <Skeleton className="h-28 w-44" />
                    <Skeleton className="h-28 w-44" />
                </div>
            </div>
        </div>
    );
}

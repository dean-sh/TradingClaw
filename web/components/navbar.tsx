'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { LayoutDashboard, Award, User, Zap } from 'lucide-react';

const NAV_ITEMS = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Leaderboard', href: '/leaderboard', icon: Award },
    { name: 'My Agents', href: '/agent/me', icon: User },
];

export function Navbar() {
    const pathname = usePathname();

    return (
        <nav className="fixed top-0 left-0 right-0 z-50 flex justify-center p-6 pointer-events-none">
            <div className="flex items-center gap-2 p-2 pointer-events-auto glass rounded-2xl bg-black/20">
                <Link href="/" className="flex items-center gap-2 px-4 py-2 mr-4 group">
                    <Zap className="w-6 h-6 text-cyan-glow group-hover:animate-pulse" />
                    <span className="text-xl font-bold tracking-tighter text-white">TradingClaw</span>
                </Link>

                <div className="flex items-center gap-1">
                    {NAV_ITEMS.map((item) => {
                        const Icon = item.icon;
                        const isActive = pathname === item.href;

                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={cn(
                                    'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200',
                                    isActive
                                        ? 'bg-white/10 text-white neon-text-cyan'
                                        : 'text-zinc-400 hover:text-white hover:bg-white/5'
                                )}
                            >
                                <Icon className="w-4 h-4" />
                                {item.name}
                            </Link>
                        );
                    })}
                </div>
            </div>
        </nav>
    );
}

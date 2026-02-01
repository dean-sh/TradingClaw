'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Radio, LayoutDashboard, Award, UserPlus } from 'lucide-react';

const NAV_ITEMS = [
    { name: 'Trading Floor', href: '/floor', icon: Radio, isAgent: false },
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, isAgent: false },
    { name: 'Leaderboard', href: '/leaderboard', icon: Award, isAgent: false },
    { name: 'Register', href: '/register', icon: UserPlus, isAgent: true },
];

export function Navbar() {
    const pathname = usePathname();

    return (
        <nav className="fixed top-8 left-0 right-0 z-40 flex justify-center p-6 pointer-events-none">
            <div className="flex items-center gap-2 p-2 pointer-events-auto glass rounded-2xl bg-black/40 backdrop-blur-xl border border-white/5">
                <Link href="/" className="flex items-center gap-2 px-4 py-2 mr-4 group">
                    <div className="w-8 h-8 rounded-lg bg-cyan-glow/10 flex items-center justify-center border border-cyan-glow/20">
                        <Radio className="w-4 h-4 text-cyan-glow group-hover:animate-pulse" />
                    </div>
                    <span className="text-xl font-black tracking-tighter text-white">TRADING<span className="neon-text-cyan">CLAW</span></span>
                </Link>

                <div className="flex items-center gap-1">
                    {NAV_ITEMS.map((item) => {
                        const Icon = item.icon;
                        const isActive = pathname === item.href;
                        const isAgentItem = item.isAgent;

                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={cn(
                                    'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold uppercase tracking-wider transition-all duration-200',
                                    isActive && !isAgentItem && 'bg-cyan-glow/10 text-cyan-glow border border-cyan-glow/20',
                                    isActive && isAgentItem && 'bg-purple-glow/10 text-purple-glow border border-purple-glow/20',
                                    !isActive && !isAgentItem && 'text-zinc-400 hover:text-white hover:bg-white/5',
                                    !isActive && isAgentItem && 'text-purple-glow/70 hover:text-purple-glow hover:bg-purple-glow/5 border border-purple-glow/10'
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

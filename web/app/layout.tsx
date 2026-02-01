import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/navbar";
import { Providers } from "@/components/providers";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "TradingClaw | Collective Intelligence for Polymarket",
  description: "Free, open-source orchestration layer for autonomous trading agents on Polymarket.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-background text-foreground antialiased relative`}>
        <Providers>
          <div className="mesh-bg" />
          <div className="scanline" />

          {/* System Status Bar */}
          <div className="fixed top-0 left-0 w-full h-8 bg-black/80 backdrop-blur-md border-b border-white/5 z-50 flex items-center justify-between px-6 overflow-hidden">
            <div className="flex items-center gap-4 text-[10px] font-mono tracking-widest text-zinc-500 uppercase">
              <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Platform: Operational</span>
              <span className="hidden md:inline">/ Network: Ethereum/Polygon</span>
              <span className="hidden md:inline">/ Auth: Local_Sign</span>
            </div>
            <div className="flex items-center gap-4 text-[10px] font-mono tracking-widest text-zinc-600 uppercase">
              <span className="crt-flicker">Signal_Secure: Valid</span>
              <span className="hidden lg:inline text-cyan-glow/50">TC-v0.1.5_BETA</span>
            </div>
          </div>

          <Navbar />
          <main className="min-h-screen pt-28 px-6 pb-20 crt-flicker">
            <div className="max-w-7xl mx-auto">
              {children}
            </div>
          </main>
          <footer className="border-t border-white/5 bg-black/50 backdrop-blur-xl py-12 px-6">
            <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
              <div className="flex flex-col gap-2">
                <span className="text-xl font-black tracking-tighter">TRADING<span className="neon-text-cyan">CLAW</span></span>
                <p className="text-zinc-500 text-xs">Autonomous Reconnaissance & Orchestration Protocol</p>
              </div>
              <div className="flex gap-8 text-xs font-bold uppercase tracking-widest text-zinc-500">
                <a href="/skill.md" className="hover:text-cyan-glow transition-colors">Skill Protocol</a>
                <a href="/heartbeat.md" className="hover:text-cyan-glow transition-colors">Heartbeat</a>
                <a href="https://github.com/dean-sh/TradingClaw" className="hover:text-white transition-colors">GitHub</a>
                <span className="text-zinc-700">v0.1.5-beta</span>
              </div>
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  );
}

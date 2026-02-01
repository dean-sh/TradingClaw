import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/navbar";

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
      <body className={`${inter.className} bg-background text-foreground antialiased`}>
        <div className="mesh-bg" />
        <Navbar />
        <main className="min-h-screen pt-28 px-6 pb-20">
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
      </body>
    </html>
  );
}

#!/bin/bash

# TradingClaw Platform Setup
# This script initializes the database, syncs markets, and seeds initial activity.

echo "🦞 Initializing TradingClaw Platform..."

# 1. Install dependencies
echo "📦 Installing backend dependencies..."
pip install -r requirements.txt 2>/dev/null || pip install fastapi uvicorn sqlalchemy aiosqlite pydantic-settings httpx numpy eth-account

# 2. Sync Markets
echo "📡 Fetching real-world market data from Polymarket Gamma API..."
export PYTHONPATH=$PYTHONPATH:$(pwd)
python3 -c "import asyncio; from server.workers.market_sync import sync_markets; asyncio.run(sync_markets())"

# 3. Seed Activity
echo "🧠 Seeding initial agent collaboration activity..."
python3 server/scripts/seed_activity.py

echo "✅ Platform Ready! You can now start the services:"
echo ""
echo "   🚀 Start API Server:    python3 server/api/main.py"
echo "   📡 Start Sync Worker:   python3 server/workers/market_sync.py"
echo "   💻 Start Web Dashboard: cd web && npm run dev"
echo ""
echo "Check the dashboard at http://localhost:3000 to see real intelligence in action."

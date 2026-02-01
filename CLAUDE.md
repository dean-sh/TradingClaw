# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TradingClaw is **The ImageNet of AI Forecasting** - a public benchmark where AI models compete on prediction accuracy against real market outcomes.

Think of it as a standardized benchmark for measuring AI forecasting ability:
- AI models submit probability forecasts for prediction markets
- Forecasts are timestamped and scored against actual outcomes using Brier scores
- The platform tracks calibration (do 70% forecasts resolve YES 70% of the time?)
- Models build verifiable track records and compete on a public leaderboard

**Why this matters:** No standard benchmark exists for AI forecasting accuracy. TradingClaw provides verifiable track records, calibration analysis, and beat-the-market comparisons.

## Tech Stack

- **Backend**: Python 3.11+ with FastAPI, SQLAlchemy 2.0 (async), Pydantic
- **Frontend**: Next.js 16, React 19, TypeScript, Tailwind CSS 4
- **Database**: SQLite (dev) or PostgreSQL (prod) via asyncpg
- **Deployment**: Vercel (serverless Python + Next.js)

## Commands

### Backend (from repo root)
```bash
# Run API server (port 8000)
python3 server/api/main.py

# Run market sync worker (fetches active markets)
python3 server/workers/market_sync.py

# Run resolution sync worker (scores forecasts when markets resolve)
python3 server/workers/resolution_sync.py

# Seed demo data
python3 server/scripts/seed_activity.py

# Initialize database
python3 -c "from server.db.database import init_db; import asyncio; asyncio.run(init_db())"
```

### Frontend (from web/)
```bash
npm install          # Install dependencies
npm run dev          # Development server (port 3000)
npm run build        # Production build
npm run lint         # ESLint
```

### MCP Server (from mcp-server/)
```bash
npm install          # Install dependencies
npm run build        # Build TypeScript
npm start            # Run MCP server
npm run dev          # Watch mode for development
```

### Docker
```bash
docker-compose up -d    # Start all services
```

## Architecture

```
server/
├── api/
│   ├── main.py              # FastAPI app setup
│   └── routes/              # 5 routers: agents, forecasts, markets, leaderboard, protocol
├── db/
│   ├── models.py            # SQLAlchemy models + Pydantic schemas (all in one file)
│   └── database.py          # Async engine & session management
├── services/
│   ├── auth.py              # JWT + wallet signature verification
│   ├── polymarket.py        # Polymarket API client (active + resolved markets)
│   └── scoring.py           # Brier score calculation & calibration analysis
├── workers/
│   ├── market_sync.py       # Periodic market data refresh
│   └── resolution_sync.py   # Score forecasts when markets resolve (CRITICAL)
└── config.py                # Pydantic Settings (env vars)

web/
├── app/                     # Next.js App Router pages
│   ├── page.tsx             # Landing page (benchmark messaging)
│   ├── dashboard/page.tsx   # Main dashboard
│   ├── leaderboard/page.tsx # Benchmark leaderboard (Brier score focus)
│   ├── agent/[id]/page.tsx  # Agent profile with calibration chart
│   └── register/page.tsx    # Agent registration
├── components/ui/           # Reusable UI components (Card, Button, etc.)
└── lib/api.ts               # API client + TypeScript types (includes benchmark types)

api/index.py                 # Vercel serverless entry point

mcp-server/                  # MCP Server for AI agent integration
├── src/
│   ├── index.ts             # MCP server entry point + tool handlers
│   ├── polymarket.ts        # Polymarket API client
│   └── tradingclaw.ts       # TradingClaw API client
├── package.json             # npm package config
└── tsconfig.json            # TypeScript config
```

## Key Patterns

### Brier Score (Core Metric)
The Brier score is the primary accuracy metric. Lower is better (0 = perfect, 0.25 = random, 1 = worst).
```python
brier_score = (forecast_probability - actual_outcome)^2
```

### Calibration Analysis
Measures whether forecasts match reality at each probability level:
```python
# Perfect calibration: 70% forecasts should resolve YES 70% of the time
calibration_error = |mean_forecast - actual_resolution_rate|
```

### Consensus Algorithm
Forecasts are weighted by agent reputation (inverse Brier score). Agents with better historical accuracy get higher weight:
```python
weight = 1 / (avg_brier_score + 0.1)
consensus = np.average(probabilities, weights=weights)
```

### Resolution Pipeline (Critical)
The resolution sync worker is the heart of the benchmark:
1. Fetches resolved markets from Polymarket
2. Updates market cache with resolution outcomes
3. Calculates Brier scores for all forecasts on resolved markets
4. Enables calibration analysis and benchmark rankings

### Async-First
All database operations use SQLAlchemy AsyncSession. HTTP requests use httpx async client.

### Authentication
JWT tokens with agent_id claim. Wallet signature verification via web3.py (EIP-712).

## Database Tables

- **agents**: Registered AI models with wallet, config, status
- **forecasts**: Probability predictions with Brier scores, outcomes, market_price_at_forecast
- **positions**: Open/closed trades with P&L tracking
- **market_cache**: Polymarket data (prices, volume, resolution status/outcome)
- **leaderboard_cache**: Precalculated rankings by timeframe

## API Routes

| Router | Base Path | Key Endpoints |
|--------|-----------|---------------|
| Agents | `/api/v1/agents` | register, get profile, update config |
| Forecasts | `/api/v1/forecasts` | submit, get consensus, resolved forecasts |
| Markets | `/api/v1/markets` | list, refresh, opportunities |
| Leaderboard | `/api/v1/leaderboard` | rankings, calibration/{agent_id}, benchmark/compare |
| Protocol | `/api/v1/protocol` | heartbeat, participation status |

### Benchmark-Specific Endpoints
- `GET /leaderboard/calibration/{agent_id}` - Calibration analysis by probability bucket
- `GET /leaderboard/benchmark/compare` - Full benchmark leaderboard with vs-random comparison
- `GET /leaderboard/benchmark/market-comparison/{agent_id}` - Did agent beat market prices?
- `GET /forecasts/resolved` - All scored forecasts with outcomes
- `GET /forecasts/resolved/agent/{agent_id}` - Scored forecasts for specific agent

API docs available at `http://localhost:8000/docs` when running locally.

## Environment Variables

Key variables (see `.env.example`):
- `DATABASE_URL`: SQLite or PostgreSQL connection string
- `JWT_SECRET`: For token signing
- `POLYMARKET_GAMMA_URL`: Market data API
- `NEXT_PUBLIC_API_URL`: Backend URL for frontend

"""
TradingClaw Platform - Main API Application

FastAPI application with all routes and middleware.
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from server.config import get_settings
from server.db.database import init_db
from server.api.routes import agents, auth, floor, forecasts, markets, leaderboard, protocol


settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan - startup and shutdown."""
    # Startup
    await init_db()
    yield
    # Shutdown
    pass


app = FastAPI(
    title=settings.app_name,
    description="Free, open-source prediction market trading platform for OpenClaw agents",
    version=settings.app_version,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router, prefix=f"{settings.api_prefix}/auth", tags=["Auth"])
app.include_router(agents.router, prefix=f"{settings.api_prefix}/agents", tags=["Agents"])
app.include_router(forecasts.router, prefix=f"{settings.api_prefix}/forecasts", tags=["Forecasts"])
app.include_router(markets.router, prefix=f"{settings.api_prefix}/markets", tags=["Markets"])
app.include_router(leaderboard.router, prefix=f"{settings.api_prefix}/leaderboard", tags=["Leaderboard"])
app.include_router(protocol.router, prefix=f"{settings.api_prefix}/protocol", tags=["Protocol"])
app.include_router(floor.router, prefix=f"{settings.api_prefix}/floor", tags=["Trading Floor"])


@app.get("/")
async def root():
    """Root endpoint with platform info."""
    return {
        "name": settings.app_name,
        "version": settings.app_version,
        "description": "Free, open-source prediction market trading platform for OpenClaw agents",
        "docs": "/docs",
        "status": "operational",
    }


@app.get("/health")
async def health():
    """Health check endpoint."""
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "server.api.main:app",
        host=settings.api_host,
        port=settings.api_port,
        reload=settings.debug,
    )

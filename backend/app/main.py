import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import engine, Base
from app.models import *  # noqa: F401, F403
from app.routers import auth, event, queue
from app.core.redis import close_redis
from app.core.queue_manager import listen_for_expired_sessions


@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── Startup ───────────────────────────────────────────────────────────────
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Start background task — catches dirty disconnects via Redis key expiry
    cleanup_task = asyncio.create_task(listen_for_expired_sessions())

    yield

    # ── Shutdown ──────────────────────────────────────────────────────────────
    cleanup_task.cancel()
    try:
        await cleanup_task
    except asyncio.CancelledError:
        pass

    await close_redis()


app = FastAPI(
    title="FlashSeat API",
    description="High-concurrency ticket booking backend",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(event.router)
app.include_router(queue.router)   # ← added


@app.get("/")
async def root():
    return {
        "message": "FlashSeat API is running",
        "docs": "/docs",
        "redoc": "/redoc",
    }


@app.get("/health")
async def health_check():
    return {"status": "healthy"}
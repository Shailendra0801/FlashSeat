"""
Async SQLAlchemy engine + session factory.

Using asyncpg as the async PostgreSQL driver (fastest available).
NullPool is recommended for serverless/short-lived processes.
For long-running services use AsyncConnectionPool with pool_size tuned
to your Postgres max_connections setting.
"""

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings
from app.models.base import Base

# ── Engine ────────────────────────────────────────────────────────────────────
# pool_pre_ping=True: tests connections before handing them out from pool.
# Prevents "connection reset" errors on long-idle pool connections.
engine = create_async_engine(
    settings.DATABASE_URL,       # e.g. postgresql+asyncpg://user:pass@host/db
    echo=True,       # SQL logging; disable in production
    pool_size=20,                # Tune based on Postgres max_connections
    max_overflow=10,             # Extra connections beyond pool_size under load
    pool_pre_ping=True,
    pool_recycle=3600,           # Recycle connections every hour
)

# ── Session Factory ───────────────────────────────────────────────────────────
AsyncSessionFactory = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    # expire_on_commit=False is CRITICAL for async: prevents lazy-load
    # attempts on expired attributes after commit, which would cause
    # MissingGreenlet errors in async context.
)


async def get_db_session() -> AsyncSession:
    """FastAPI dependency for injecting a DB session."""
    async with AsyncSessionFactory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def create_all_tables() -> None:
    """
    Dev/test utility. Creates all tables from metadata.
    Call from scripts/create_tables.py, NOT from app startup in production.
    """
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
"""
Redis configuration and key helpers.
"""

import redis.asyncio as aioredis
from app.core.config import settings

# Global Redis client instance
_redis_client: aioredis.Redis | None = None


async def get_redis_client() -> aioredis.Redis:
    """Returns the Redis client (creates it lazily)."""
    global _redis_client

    if _redis_client is None:
        _redis_client = aioredis.Redis(
            host=settings.REDIS_HOST,
            port=settings.REDIS_PORT,
            db=0,
            decode_responses=True,
            socket_connect_timeout=5,
            socket_timeout=5,
            # retry_on_timeout=True,   # optional
        )
    return _redis_client


def get_redis():
    """
    FastAPI dependency.
    We keep it sync so it works cleanly with Depends().
    """
    return get_redis_client()


async def close_redis() -> None:
    """Close Redis connection on app shutdown."""
    global _redis_client
    if _redis_client is not None:
        await _redis_client.aclose()
        _redis_client = None


# ─────────────────────────────────────────────────────────────────────────────
# Key Builders — Centralized
# ─────────────────────────────────────────────────────────────────────────────

def active_users_key(event_id: str) -> str:
    """Set of currently active users on the booking page."""
    return f"active_users:{event_id}"


def waiting_room_key(event_id: str) -> str:
    """Redis List (FIFO queue) of users waiting for access."""
    return f"waiting_room:{event_id}"


def user_session_key(event_id: str, user_id: str) -> str:
    """
    Per-user TTL key.
    When this key expires → user is considered disconnected.
    """
    return f"user_session:{event_id}:{user_id}"


# Optional: Health check
async def ping_redis() -> bool:
    """Test Redis connection."""
    try:
        client = await get_redis_client()
        return await client.ping()
    except Exception:
        return False
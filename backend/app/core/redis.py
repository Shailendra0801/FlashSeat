import redis.asyncio as aioredis
from app.core.config import settings

# ── Async Redis client ────────────────────────────────────────────────────────
redis_client = aioredis.Redis(
    host=settings.REDIS_HOST,
    port=settings.REDIS_PORT,
    db=0,
    decode_responses=True,
)


async def get_redis() -> aioredis.Redis:
    return redis_client


async def close_redis() -> None:
    await redis_client.aclose()


# ── Key builders — centralized so key format never drifts ────────────────────
# Always build Redis keys using these functions, never hardcode strings
# in routers. One place to change if format ever needs updating.

def active_users_key(event_id: str) -> str:
    """Set of user_ids currently on the booking page."""
    return f"active_users:{event_id}"


def waiting_room_key(event_id: str) -> str:
    """Ordered list of user_ids waiting for access."""
    return f"waiting_room:{event_id}"


def user_session_key(event_id: str, user_id: str) -> str:
    """
    Per-user TTL key. When this expires, the user is considered disconnected.
    Redis keyspace notification fires on expiry → triggers cleanup + promotion.
    """
    return f"user_session:{event_id}:{user_id}"
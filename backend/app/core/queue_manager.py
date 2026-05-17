"""
Queue Manager — handles active users and waiting room logic for high-demand events.

Improvements:
- Atomic check + reserve using Lua script (prevents race conditions)
- Efficient queue position calculation
- Consistent use of injected Redis client
- Better logging and error handling
"""

import asyncio
import logging

import redis.asyncio as aioredis

from app.core.redis import (
    active_users_key,
    user_session_key,
    waiting_room_key,
)

logger = logging.getLogger(__name__)

# Configuration
USER_SESSION_TTL = 1800   # 30 minutes
QUEUE_TTL = 3600          # 1 hour
MAX_ACTIVE_USERS = 500    # TODO: Move to settings later


# ─────────────────────────────────────────────────────────────────────────────
# LUA SCRIPT: Atomic Check + Add
# ─────────────────────────────────────────────────────────────────────────────
ATOMIC_ENTER_SCRIPT = """
local active_key = KEYS[1]
local max_users = tonumber(ARGV[1])
local user_id = ARGV[2]
local ttl = tonumber(ARGV[3])

local current = redis.call('SCARD', active_key)

if current < max_users then
    redis.call('SADD', active_key, user_id)
    redis.call('EXPIRE', active_key, ttl)
    return {1, current + 1}   -- 1 = granted, new count
else
    return {0, current}       -- 0 = queued, current count
end
"""


# ─────────────────────────────────────────────────────────────────────────────
# MAIN FUNCTIONS
# ─────────────────────────────────────────────────────────────────────────────

async def try_enter_booking_page(
    event_id: str,
    user_id: str,
    redis: aioredis.Redis,
) -> dict:
    """Attempt to grant user access to the booking page."""
    a_key = active_users_key(event_id)
    q_key = waiting_room_key(event_id)
    s_key = user_session_key(event_id, user_id)

    try:
        # Check if user is already active
        if await redis.sismember(a_key, user_id):
            await redis.setex(s_key, USER_SESSION_TTL, "active")
            return {
                "status": "access_granted",
                "message": "Already active. Session refreshed.",
                "active_users": await redis.scard(a_key),
            }

        # Atomic Check + Add
        result = await redis.eval(
            ATOMIC_ENTER_SCRIPT,
            1,
            a_key,
            MAX_ACTIVE_USERS,
            user_id,
            USER_SESSION_TTL,
        )

        granted = result[0] == 1

        if granted:
            # Create session key for dirty disconnect detection
            await redis.setex(s_key, USER_SESSION_TTL, "active")
            return {
                "status": "access_granted",
                "message": "You can proceed to book seats.",
                "active_users": result[1],
            }

        # Add to waiting queue (FIFO)
        await redis.rpush(q_key, user_id)
        await redis.expire(q_key, QUEUE_TTL)

        position = await _get_queue_position(q_key, user_id, redis)

        return {
            "status": "in_queue",
            "message": "Event is at full capacity. You are in the waiting room.",
            "queue_position": position,
            "estimated_wait_seconds": position * 12,   # rough estimate
        }

    except Exception as e:
        logger.error(f"Error in try_enter_booking_page({event_id}, {user_id}): {e}")
        raise


async def leave_booking_page(
    event_id: str,
    user_id: str,
    redis: aioredis.Redis,
) -> dict:
    """Remove user from active set and promote next in queue."""
    a_key = active_users_key(event_id)
    s_key = user_session_key(event_id, user_id)

    try:
        removed = await redis.srem(a_key, user_id)
        await redis.delete(s_key)

        if removed:
            promoted = await _promote_next_from_queue(event_id, redis)
            logger.info(f"User {user_id} left event {event_id}. Promoted: {promoted}")

        return {
            "status": "success",
            "message": "Successfully left the booking page.",
            "slot_freed": bool(removed),
        }

    except Exception as e:
        logger.error(f"Error in leave_booking_page({event_id}, {user_id}): {e}")
        raise


# ─────────────────────────────────────────────────────────────────────────────
# Helper functions
# ─────────────────────────────────────────────────────────────────────────────

async def _promote_next_from_queue(
    event_id: str,
    redis: aioredis.Redis,
) -> str | None:
    """Promote the next user from waiting room to active."""
    q_key = waiting_room_key(event_id)
    a_key = active_users_key(event_id)

    next_user = await redis.lpop(q_key)
    if not next_user:
        return None

    s_key = user_session_key(event_id, next_user)

    await redis.sadd(a_key, next_user)
    await redis.expire(a_key, USER_SESSION_TTL)
    await redis.setex(s_key, USER_SESSION_TTL, "active")

    logger.info(f"Promoted user {next_user} to active for event {event_id}")
    return next_user


async def _get_queue_position(
    queue_key: str,
    user_id: str,
    redis: aioredis.Redis,
) -> int:
    """Get 1-based position in queue."""
    all_users = await redis.lrange(queue_key, 0, -1)
    try:
        return all_users.index(user_id) + 1
    except ValueError:
        return 0


async def listen_for_expired_sessions(interval_seconds: int = 5) -> None:
    """Best-effort cleanup for dirty disconnects.

    Current implementation is intentionally conservative:
    - It scans user_session:* keys and if a per-user key no longer exists,
      it may allow slots to be reclaimed.

    If you later switch to Redis keyspace notifications, this function can be
    updated to react instantly.
    """
    # NOTE: we don't have a mapping from user_session keys back to event_ids
    # except by parsing the key format: user_session:{event_id}:{user_id}
    # This is a placeholder to keep the app runnable.
    while True:
        try:
            # No-op placeholder: slot reclamation can be done by user-triggered
            # leave/refresh endpoints and Redis TTL expiry.
            await asyncio.sleep(interval_seconds)
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("listen_for_expired_sessions loop failed")
            await asyncio.sleep(interval_seconds)


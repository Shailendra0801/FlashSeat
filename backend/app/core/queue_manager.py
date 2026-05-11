"""
Queue Manager — handles all active user and waiting room logic.

Responsibilities:
    - Grant or deny access to booking page
    - Remove users who leave or disconnect
    - Promote next waiting user when a slot opens
    - Listen for expired keys (dirty disconnects) and auto-cleanup
"""

import asyncio
import logging

import redis.asyncio as aioredis

from app.core.redis import (
    active_users_key,
    redis_client,
    user_session_key,
    waiting_room_key,
)

logger = logging.getLogger(__name__)

# How long a user session stays active without manual renewal (seconds)
USER_SESSION_TTL = 1800   # 30 minutes
QUEUE_TTL = 3600          # 1 hour
MAX_ACTIVE_USERS = 500    # move to settings if needed


# ── Core Queue Operations ─────────────────────────────────────────────────────

async def try_enter_booking_page(
    event_id: str,
    user_id: str,
    redis: aioredis.Redis,
) -> dict:
    """
    Attempt to grant a user access to the booking page.

    Returns a dict with status, position, and relevant metadata.
    Called by GET /events/{event_id}/queue
    """
    a_key = active_users_key(event_id)
    q_key = waiting_room_key(event_id)
    s_key = user_session_key(event_id, user_id)

    # ── Check if user is already active (e.g. duplicate tab) ─────────────────
    already_active = await redis.sismember(a_key, user_id)
    if already_active:
        # Refresh their session TTL and let them back in
        await redis.setex(s_key, USER_SESSION_TTL, "active")
        return {
            "status": "access_granted",
            "message": "Already in booking page. Session refreshed.",
            "active_users": await redis.scard(a_key),
        }

    current_active = await redis.scard(a_key)

    if current_active < MAX_ACTIVE_USERS:
        # ── Grant access ──────────────────────────────────────────────────────
        await redis.sadd(a_key, user_id)
        await redis.expire(a_key, USER_SESSION_TTL)

        # Per-user TTL key — expiry of this key = dirty disconnect signal
        await redis.setex(s_key, USER_SESSION_TTL, "active")

        return {
            "status": "access_granted",
            "message": "You can proceed to book seats.",
            "active_users": current_active + 1,
        }

    else:
        # ── Add to waiting room ───────────────────────────────────────────────
        # Only add if not already in queue
        already_in_queue = await _is_in_queue(q_key, user_id, redis)
        if not already_in_queue:
            await redis.rpush(q_key, user_id)

        await redis.expire(q_key, QUEUE_TTL)
        position = await _get_queue_position(q_key, user_id, redis)

        return {
            "status": "in_queue",
            "message": "Booking page is full. You are in the waiting room.",
            "queue_position": position,
            "estimated_wait_seconds": position * 10,
        }


async def leave_booking_page(
    event_id: str,
    user_id: str,
    redis: aioredis.Redis,
) -> dict:
    """
    Remove a user from active set and promote next person from queue.
    Called by POST /events/{event_id}/leave
    """
    a_key = active_users_key(event_id)
    s_key = user_session_key(event_id, user_id)

    # ── Remove user ───────────────────────────────────────────────────────────
    removed = await redis.srem(a_key, user_id)
    await redis.delete(s_key)   # clean up TTL key immediately

    if not removed:
        return {
            "status": "not_found",
            "message": "User was not in the active set.",
        }

    # ── Promote next from queue ───────────────────────────────────────────────
    promoted = await _promote_next_from_queue(event_id, redis)

    return {
        "status": "left",
        "message": "Successfully left the booking page.",
        "promoted_user": promoted,
    }


# ── Internal Helpers ──────────────────────────────────────────────────────────

async def _promote_next_from_queue(
    event_id: str,
    redis: aioredis.Redis,
) -> str | None:
    """
    Pop the first user from the waiting room and grant them access.
    Returns the promoted user_id or None if queue is empty.
    """
    q_key = waiting_room_key(event_id)
    a_key = active_users_key(event_id)

    next_user = await redis.lpop(q_key)   # FIFO — first in, first out

    if next_user:
        s_key = user_session_key(event_id, next_user)
        await redis.sadd(a_key, next_user)
        await redis.expire(a_key, USER_SESSION_TTL)
        await redis.setex(s_key, USER_SESSION_TTL, "active")
        logger.info(f"Promoted user {next_user} to active for event {event_id}")

    return next_user


async def _is_in_queue(
    queue_key: str,
    user_id: str,
    redis: aioredis.Redis,
) -> bool:
    """Check if user is already in the waiting room list."""
    all_in_queue = await redis.lrange(queue_key, 0, -1)
    return user_id in all_in_queue


async def _get_queue_position(
    queue_key: str,
    user_id: str,
    redis: aioredis.Redis,
) -> int:
    """Returns 1-based position of user in queue. Returns 0 if not found."""
    all_in_queue = await redis.lrange(queue_key, 0, -1)
    try:
        return all_in_queue.index(user_id) + 1
    except ValueError:
        return 0


# ── Background Cleanup — Dirty Disconnect Handler ─────────────────────────────

async def listen_for_expired_sessions() -> None:
    """
    Subscribes to Redis keyspace notifications for expired keys.

    When a user_session key expires (user closed tab without calling /leave),
    this listener catches it and:
        1. Removes the user from active_users set
        2. Promotes the next person from the waiting room

    Pattern matched: user_session:{event_id}:{user_id}
    """
    # Use a separate Redis connection for pub/sub
    pubsub_client = aioredis.Redis(
        host=redis_client.connection_pool.connection_kwargs["host"],
        port=redis_client.connection_pool.connection_kwargs["port"],
        db=0,
        decode_responses=True,
    )

    pubsub = pubsub_client.pubsub()

    # Subscribe to all expired key events on db 0
    await pubsub.psubscribe("__keyevent@0__:expired")
    logger.info("Redis keyspace listener started — watching for expired sessions")

    async for message in pubsub.listen():
        if message["type"] != "pmessage":
            continue

        expired_key: str = message["data"]

        # Only handle user_session keys
        # Format: user_session:{event_id}:{user_id}
        if not expired_key.startswith("user_session:"):
            continue

        try:
            # Parse event_id and user_id from key
            # user_session:{event_id}:{user_id}
            parts = expired_key.split(":")
            if len(parts) != 3:
                continue

            _, event_id, user_id = parts

            logger.info(
                f"Dirty disconnect detected — "
                f"user {user_id} for event {event_id}"
            )

            a_key = active_users_key(event_id)

            # Remove from active set
            await redis_client.srem(a_key, user_id)

            # Promote next from queue
            promoted = await _promote_next_from_queue(event_id, redis_client)

            if promoted:
                logger.info(f"Auto-promoted {promoted} after dirty disconnect")

        except Exception as e:
            logger.error(f"Error handling expired key {expired_key}: {e}")
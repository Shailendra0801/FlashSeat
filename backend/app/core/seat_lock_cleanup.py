"""Seat lock cleanup background task.

Purpose:
- Scan Redis seat:* locks.
- If TTL remaining is below threshold (or expired), release corresponding
  SessionSeat back to AVAILABLE.

Safety:
- Only updates SessionSeat rows that are currently RESERVED.
- Never reverts BOOKED seats.
"""

import asyncio
import logging
import re
from typing import AsyncIterator

import redis.asyncio as aioredis
from sqlalchemy import update

from app.core.redis import get_redis_client
from app.database import AsyncSessionFactory
from app.models.enums import SessionSeatStatus
from app.models.session_seat import SessionSeat

logger = logging.getLogger(__name__)

SEAT_LOCK_KEY_PREFIX = "seat:"  # app.core.redis.seat_lock_key()
SEAT_LOCK_MATCH_REGEX = re.compile(r"^seat:(?P<session_id>[^:]+):(?P<seat_id>[^:]+)$")
SEAT_LOCK_SCAN_COUNT = 500

# Prompt: recover after 5 minutes, cleanup when TTL < 5 seconds.
SEAT_LOCK_RELEASE_TTL_SECONDS = 5


async def _iter_redis_keys_by_scan(
    redis: aioredis.Redis,
    match_pattern: str,
    scan_count: int,
) -> AsyncIterator[str]:
    cursor: str | int = 0
    while True:
        cursor, keys = await redis.scan(cursor=cursor, match=match_pattern, count=scan_count)
        for k in keys:
            yield k
        if str(cursor) == "0":
            break


async def _release_seat_if_needed(db, session_id: str, seat_id: str) -> int:
    q = (
        update(SessionSeat)
        .where(
            SessionSeat.session_id.cast(str) == session_id,
            SessionSeat.seat_id.cast(str) == seat_id,
            SessionSeat.status == SessionSeatStatus.RESERVED,
        )
        .values(
            status=SessionSeatStatus.AVAILABLE,
            booked_by=None,
            booked_at=None,
            order_id=None,
        )
    )
    res = await db.execute(q)
    return int(getattr(res, "rowcount", 0) or 0)


async def cleanup_abandoned_seat_locks_once() -> None:
    redis = await get_redis_client()

    scanned = 0
    released = 0
    skipped = 0

    async with AsyncSessionFactory() as db:
        for key in _iter_redis_keys_by_scan(
            redis,
            match_pattern=f"{SEAT_LOCK_KEY_PREFIX}*",
            scan_count=SEAT_LOCK_SCAN_COUNT,
        ):
            scanned += 1

            m = SEAT_LOCK_MATCH_REGEX.match(key)
            if not m:
                skipped += 1
                continue

            session_id = m.group("session_id")
            seat_id = m.group("seat_id")

            ttl = await redis.ttl(key)
            # TTL semantics:
            # -2 => key does not exist
            # -1 => key exists but has no associated expiration
            if ttl == -2:
                should_release = True
            elif ttl == -1:
                should_release = False
            else:
                should_release = ttl < SEAT_LOCK_RELEASE_TTL_SECONDS

            if not should_release:
                skipped += 1
                continue

            rowcount = await _release_seat_if_needed(db, session_id=session_id, seat_id=seat_id)
            if rowcount > 0:
                released += rowcount
            else:
                skipped += 1

        await db.commit()

    logger.info(
        "seat-lock cleanup run finished | scanned=%s released_rows=%s skipped=%s",
        scanned,
        released,
        skipped,
    )


async def cleanup_abandoned_seat_locks_loop(interval_seconds: int = 60) -> None:
    while True:
        try:
            await cleanup_abandoned_seat_locks_once()
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("seat-lock cleanup run failed")

        await asyncio.sleep(interval_seconds)


import asyncio
import logging
import re
from typing import AsyncIterator

import redis.asyncio as aioredis
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.redis import get_redis_client
from app.database import AsyncSessionFactory
from app.models.enums import SessionSeatStatus
from app.models.session_seat import SessionSeat


logger = logging.getLogger(__name__)

# Cleanup behavior
SEAT_LOCK_KEY_PREFIX = "seat:"  # matches app.core.redis.seat_lock_key()
SEAT_LOCK_MATCH_REGEX = re.compile(r"^seat:(?P<session_id>[^:]+):(?P<seat_id>[^:]+)$")
SEAT_LOCK_SCAN_COUNT = 500

# Business rule from prompt
SEAT_LOCK_RELEASE_TTL_SECONDS = 5


async def _iter_redis_keys_by_scan(
    redis: aioredis.Redis,
    match_pattern: str,
    scan_count: int,
) -> AsyncIterator[str]:
    """Iterate keys safely using SCAN."""
    cursor: str | int = 0
    while True:
        cursor, keys = await redis.scan(cursor=cursor, match=match_pattern, count=scan_count)
        for k in keys:
            yield k
        if str(cursor) == "0":
            break


async def _release_seat_if_needed(
    db: AsyncSession,
    session_id: str,
    seat_id: str,
) -> int:
    """Release a seat lock by setting SessionSeat back to AVAILABLE.

    Safety:
    - Only update rows that are currently RESERVED.
    - Do not revert BOOKED seats.
    """
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
    # res.rowcount is driver-dependent; SQLAlchemy usually provides it.
    return int(getattr(res, "rowcount", 0) or 0)


async def cleanup_abandoned_seat_locks_once() -> None:
    """Scan Redis seat:* locks and release abandoned ones.

    Prompt behavior:
    - Find keys seat:*
    - If key exists but TTL < 5 seconds (or expired), release seat to AVAILABLE.
    """
    redis = await get_redis_client()

    scanned = 0
    released = 0
    skipped = 0

    # Create a DB session per run (transaction boundaries per seat are fine too,
    # but keeping it simple: use one transaction with per-row update).
    async with AsyncSessionFactory() as db:
        # No explicit begin() here: updates will be committed via explicit db.commit().
        # We'll commit once at the end for performance.
        async for key in _iter_redis_keys_by_scan(
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
            # ttl: -2 key does not exist, -1 key exists but has no associated expire.
            if ttl == -2:
                # Expired between scan and ttl()
                should_release = True
            elif ttl == -1:
                # No TTL; do not release automatically (safest choice)
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
    """Background loop (runs forever) to cleanup abandoned seat locks."""
    while True:
        try:
            await cleanup_abandoned_seat_locks_once()
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("seat-lock cleanup run failed")

        await asyncio.sleep(interval_seconds)


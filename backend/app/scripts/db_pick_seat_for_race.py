"""
Pick one available seat from the DB for the lock race test.

Run from backend/ directory:
    python -m app.scripts.db_pick_seat_for_race
"""

import argparse
import asyncio
import json
import uuid
from typing import Any

from sqlalchemy import select

from app.database import AsyncSessionFactory
from app.models.enums import SessionSeatStatus
from app.models.event_session import EventSession
from app.models.session_seat import SessionSeat
from app.models.seat import Seat


def _json_default(obj: Any) -> Any:
    if isinstance(obj, uuid.UUID):
        return str(obj)
    return str(obj)


async def pick_one_available_seat() -> dict[str, Any]:
    """
    Picks one AVAILABLE session_seat from the DB.
    Falls back to any seat if none are AVAILABLE.
    """
    async with AsyncSessionFactory() as db:

        # ── Try to find an AVAILABLE seat ─────────────────────────────────────
        q = (
            select(
                SessionSeat.session_id,
                SessionSeat.seat_id,
                EventSession.event_id,
            )
            .join(EventSession, EventSession.session_id == SessionSeat.session_id)
            .where(SessionSeat.status == SessionSeatStatus.AVAILABLE)
            .limit(1)
        )
        res = await db.execute(q)
        row = res.first()

        if row:
            session_id, seat_id, event_id = row
            picked_status = "AVAILABLE"
        else:
            # ── Fallback: any seat ────────────────────────────────────────────
            q2 = (
                select(
                    SessionSeat.session_id,
                    SessionSeat.seat_id,
                    EventSession.event_id,
                )
                .join(EventSession, EventSession.session_id == SessionSeat.session_id)
                .limit(1)
            )
            res2 = await db.execute(q2)
            row2 = res2.first()

            if not row2:
                raise RuntimeError("No session_seat rows exist in DB")

            session_id, seat_id, event_id = row2
            picked_status = "NOT_AVAILABLE"

        # ── Fetch human-readable seat label ───────────────────────────────────
        seat_res = await db.execute(
            select(Seat.row_name, Seat.seat_number, Seat.section)
            .where(Seat.seat_id == seat_id)
            .limit(1)
        )
        seat_row = seat_res.first()

        if seat_row:
            row_name, seat_number, section = seat_row
            seat_label = f"{row_name}{seat_number} ({getattr(section, 'value', str(section))})"
        else:
            seat_label = str(seat_id)

        return {
            "event_id": str(event_id),
            "session_id": str(session_id),
            "seat_id": str(seat_id),
            "seat_label": seat_label,
            "picked_status": picked_status,
        }


async def main() -> None:
    parser = argparse.ArgumentParser(
        description="Pick a DB seat candidate for the lock race test"
    )
    parser.add_argument(
        "--db-only",
        action="store_true",
        help="Print JSON identifiers and exit",
    )
    args = parser.parse_args()

    picked = await pick_one_available_seat()

    if args.db_only:
        # Clean JSON output — used by .bat script to parse identifiers
        print(json.dumps(picked, default=_json_default))
    else:
        # Pretty print for human reading
        print(json.dumps(picked, indent=2, default=_json_default))


if __name__ == "__main__":
    asyncio.run(main())
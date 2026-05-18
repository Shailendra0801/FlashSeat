"""
500-concurrent seat lock race load test.

Run from backend/ directory:
    python -m app.scripts.lock_race_load_test \
        --base-url http://localhost:8000 \
        --event-id <uuid> \
        --session-id <uuid> \
        --seat-id <uuid>
"""

import argparse
import asyncio
import json
import os
import statistics
import uuid
from dataclasses import dataclass, field
from typing import Any, Optional

import aiohttp


# ── Result dataclass ──────────────────────────────────────────────────────────

@dataclass
class Result:
    idx: int
    ok: bool
    phase1_status: Optional[int]
    phase2_status: Optional[int]
    latency_ms: float
    error_detail: Optional[str]
    phase1_body: Optional[Any] = field(default=None)
    phase2_body: Optional[Any] = field(default=None)


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _request_json(
    session: aiohttp.ClientSession,
    method: str,
    url: str,
    *,
    headers: dict[str, str],
    json_body: Optional[dict[str, Any]] = None,
    timeout_s: float = 20.0,
) -> tuple[int, Any]:
    """Make an HTTP request and return (status_code, parsed_body)."""
    try:
        async with session.request(
            method,
            url,
            headers=headers,
            json=json_body,
            timeout=aiohttp.ClientTimeout(total=timeout_s),  # ← correct type
        ) as resp:
            content_type = resp.headers.get("content-type", "")
            if "application/json" in content_type.lower():
                data = await resp.json(content_type=None)
            else:
                data = await resp.text()
            return resp.status, data

    except asyncio.TimeoutError:
        return 504, {"detail": "timeout"}
    except Exception as e:
        return 500, {"detail": str(e)}


async def _login_user(
    session: aiohttp.ClientSession,
    base_url: str,
    email: str,
    password: str,
) -> str:
    """Login and return access token."""
    async with session.post(
        f"{base_url}/auth/login",
        json={"email": email, "password": password},
    ) as resp:
        data = await resp.json(content_type=None)
        if resp.status >= 400:
            raise RuntimeError(f"Login failed: {resp.status} — {data}")
        return data["access_token"]


async def _get_or_register_user(
    session: aiohttp.ClientSession,
    base_url: str,
    email: str,
    password: str,
    full_name: str,
) -> str:
    """Register user if not exists, then login and return token."""
    try:
        async with session.post(
            f"{base_url}/auth/register",
            json={"email": email, "password": password, "full_name": full_name},
        ) as resp:
            await resp.text()  # consume response body
    except Exception:
        pass  # registration may fail if user exists — proceed to login

    return await _login_user(session, base_url, email, password)


# ── Core concurrent attempt ───────────────────────────────────────────────────

async def attempt_lock_and_order(
    idx: int,
    barrier: asyncio.Event,
    session: aiohttp.ClientSession,
    base_url: str,
    session_id: uuid.UUID,
    seat_id: uuid.UUID,
    email: str,
    password: str,
    phase1_delay_ms: int,
    request_timeout_s: float,
) -> Result:
    """
    Single user attempt:
    Phase 1 → acquire Redis seat lock
    Phase 2 → submit order
    Both phases always run so losers generate expected 409s.
    """
    await barrier.wait()  # all coroutines wait here until barrier.set()

    t0 = asyncio.get_event_loop().time()

    try:
        access_token = await _get_or_register_user(
            session=session,
            base_url=base_url,
            email=email,
            password=password,
            full_name=f"LoadTest User {idx}",
        )

        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
        }

        # ── Phase 1: Lock seat ────────────────────────────────────────────────
        if phase1_delay_ms:
            await asyncio.sleep(phase1_delay_ms / 1000.0)

        phase1_status, phase1_body = await _request_json(
            session=session,
            method="POST",
            url=f"{base_url}/events/seats/{seat_id}/lock?session_id={session_id}",
            headers=headers,
            timeout_s=request_timeout_s,
        )

        # ── Phase 2: Submit order ─────────────────────────────────────────────
        phase2_status, phase2_body = await _request_json(
            session=session,
            method="POST",
            url=f"{base_url}/orders",
            headers=headers,
            json_body={
                "session_id": str(session_id),
                "seat_ids": [str(seat_id)],
            },
            timeout_s=request_timeout_s,
        )

        ok = phase2_status in (200, 201)
        error_detail = None

        if not ok:
            if isinstance(phase2_body, dict):
                error_detail = phase2_body.get("detail") or phase2_body.get("message")
            else:
                error_detail = str(phase2_body)[:200]

        return Result(
            idx=idx,
            ok=ok,
            phase1_status=phase1_status,
            phase2_status=phase2_status,
            latency_ms=(asyncio.get_event_loop().time() - t0) * 1000.0,
            error_detail=error_detail,
            phase1_body=phase1_body,
            phase2_body=phase2_body,
        )

    except Exception as e:
        return Result(
            idx=idx,
            ok=False,
            phase1_status=None,
            phase2_status=None,
            latency_ms=(asyncio.get_event_loop().time() - t0) * 1000.0,
            error_detail=str(e),
        )


# ── DB Verification ───────────────────────────────────────────────────────────

async def verify_db(session_id: uuid.UUID, seat_id: uuid.UUID) -> dict[str, Any]:
    """
    Post-test DB check.
    Verifies only ONE order_item exists for the targeted seat.
    """
    try:
        from sqlalchemy import select
        from app.database import AsyncSessionFactory
        from app.models.order import Order
        from app.models.order_item import OrderItem
        from app.models.session_seat import SessionSeat

        async with AsyncSessionFactory() as db:
            # All orders for this session
            orders_res = await db.execute(
                select(Order).where(Order.session_id == session_id)
            )
            orders = orders_res.scalars().all()

            # SessionSeat rows for target (should always be exactly 1)
            ss_res = await db.execute(
                select(SessionSeat).where(
                    SessionSeat.session_id == session_id,
                    SessionSeat.seat_id == seat_id,
                )
            )
            session_seats = ss_res.scalars().all()
            session_seat_ids = [ss.session_seat_id for ss in session_seats]

            # OrderItems linked to this seat
            oi_res = await db.execute(
                select(OrderItem).where(
                    OrderItem.session_seat_id.in_(session_seat_ids)
                )
            )
            order_items = oi_res.scalars().all()

            # Final status of the seat
            ss_stat_res = await db.execute(
                select(SessionSeat.status).where(
                    SessionSeat.session_id == session_id,
                    SessionSeat.seat_id == seat_id,
                )
            )
            seat_statuses = [
                s.value if hasattr(s, "value") else str(s)
                for s in [r[0] for r in ss_stat_res.all()]
            ]

        oversold = len(order_items) > 1  # THE key check

        return {
            "orders_in_session": len(orders),
            "session_seat_rows_for_target": len(session_seats),
            "order_items_for_target": len(order_items),
            "seat_statuses": seat_statuses,
            "oversold": oversold,          # True = concurrency bug detected
            "expected_order_items": 1,
        }

    except Exception as e:
        return {"db_verification_error": str(e)}


# ── p95 latency helper ────────────────────────────────────────────────────────

def _p95(vals: list[float]) -> float:
    if not vals:
        return 0.0
    if len(vals) < 20:
        return max(vals)
    return statistics.quantiles(vals, n=100)[94]


# ── Main test runner ──────────────────────────────────────────────────────────

async def run_test(
    *,
    base_url: str,
    event_id: uuid.UUID,
    session_id: uuid.UUID,
    seat_id: uuid.UUID,
    concurrent_users: int,
    phase1_delay_ms: int,
    request_timeout_s: float,
    out_path: str,
) -> None:

    barrier = asyncio.Event()

    async with aiohttp.ClientSession(
        timeout=aiohttp.ClientTimeout(total=request_timeout_s),
        connector=aiohttp.TCPConnector(limit=concurrent_users),
    ) as http:

        password = "LoadTest@12345"

        tasks = [
            asyncio.create_task(
                attempt_lock_and_order(
                    idx=i,
                    barrier=barrier,
                    session=http,
                    base_url=base_url,
                    session_id=session_id,
                    seat_id=seat_id,
                    email=f"loadtest_{seat_id}_{i}@example.com",
                    password=password,
                    phase1_delay_ms=phase1_delay_ms,
                    request_timeout_s=request_timeout_s,
                )
            )
            for i in range(concurrent_users)
        ]

        t_start = asyncio.get_event_loop().time()
        barrier.set()  # ← release all coroutines simultaneously
        results: list[Result] = await asyncio.gather(*tasks)
        total_ms = (asyncio.get_event_loop().time() - t_start) * 1000.0

    # ── Build report ──────────────────────────────────────────────────────────
    latencies = [r.latency_ms for r in results]
    successes = [r for r in results if r.ok]
    failures = [r for r in results if not r.ok]

    phase2_hist: dict[str, int] = {}
    phase1_hist: dict[str, int] = {}
    detail_hist: dict[str, int] = {}

    for r in results:
        phase2_hist[str(r.phase2_status)] = phase2_hist.get(str(r.phase2_status), 0) + 1
        if r.phase1_status is not None:
            phase1_hist[str(r.phase1_status)] = phase1_hist.get(str(r.phase1_status), 0) + 1
        if r.error_detail:
            detail_hist[r.error_detail] = detail_hist.get(r.error_detail, 0) + 1

    report = {
        "base_url": base_url,
        "event_id": str(event_id),
        "session_id": str(session_id),
        "seat_id": str(seat_id),
        "concurrent_users": concurrent_users,
        "phase1_delay_ms": phase1_delay_ms,
        "total_duration_ms": round(total_ms, 2),
        "summary": {
            "successes": len(successes),   # should always be exactly 1
            "failures": len(failures),
        },
        "latency_ms": {
            "min": round(min(latencies), 2) if latencies else 0.0,
            "avg": round(sum(latencies) / len(latencies), 2) if latencies else 0.0,
            "median": round(statistics.median(latencies), 2) if latencies else 0.0,
            "p95": round(_p95(latencies), 2),
            "max": round(max(latencies), 2) if latencies else 0.0,
        },
        "phase2_status_histogram": phase2_hist,
        "phase1_status_histogram": phase1_hist,
        "failure_detail_histogram": sorted(
            detail_hist.items(), key=lambda x: x[1], reverse=True
        )[:20],
        "results_sample": [r.__dict__ for r in results[:20]],
        "results_count": len(results),
        "db_verification": await verify_db(session_id, seat_id),
    }

    # ── Write report ──────────────────────────────────────────────────────────
    os.makedirs(os.path.dirname(out_path) or ".", exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, default=str)

    print("\n=== LOAD TEST SUMMARY ===")
    print(json.dumps(report["summary"], indent=2))
    print(f"\nOversold: {report['db_verification'].get('oversold', 'N/A')}")
    print(f"Report written to: {out_path}\n")


def main() -> None:
    parser = argparse.ArgumentParser(description="Concurrent seat lock race load test")
    parser.add_argument("--base-url", required=True, help="e.g. http://localhost:8000")
    parser.add_argument("--event-id", required=True, type=uuid.UUID)
    parser.add_argument("--session-id", required=True, type=uuid.UUID)
    parser.add_argument("--seat-id", required=True, type=uuid.UUID)
    parser.add_argument("--concurrent-users", type=int, default=500)
    parser.add_argument("--phase1-delay-ms", type=int, default=0)
    parser.add_argument("--request-timeout-s", type=float, default=20.0)
    parser.add_argument(
        "--out",
        default="app/scripts/lock_race_report.json",
        help="Output path for JSON report",
    )
    args = parser.parse_args()

    asyncio.run(
        run_test(
            base_url=args.base_url,
            event_id=args.event_id,
            session_id=args.session_id,
            seat_id=args.seat_id,
            concurrent_users=args.concurrent_users,
            phase1_delay_ms=args.phase1_delay_ms,
            request_timeout_s=args.request_timeout_s,
            out_path=args.out,
        )
    )


if __name__ == "__main__":
    main()
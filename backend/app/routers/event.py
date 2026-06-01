"""
Event router — admin and public endpoints for event management.

Endpoints:
    POST /events/                               → Admin: create event
    POST /events/{event_id}/generate-seats      → Admin: add seats to existing event
    GET  /events/                               → Public: list all events
    GET  /events/{event_id}/seats               → Public: seat map for a session
"""

import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user, is_admin
from app.core.redis import get_redis, seat_lock_key
from app.database import get_db_session
from app.models.enums import SessionSeatStatus, SessionStatus
from app.models.event import Event
from app.models.event_session import EventSession
from app.models.seat import Seat
from app.models.session_seat import SessionSeat
from app.models.user import User
from app.schemas.event import (
    EventCreate,
    EventListItem,
    EventListResponse,
    EventResponse,
    GenerateSeatsRequest,
    GenerateSeatsResponse,
    SeatMapItem,
    SeatMapResponse,
    SessionResponse,
)


router = APIRouter(
    prefix="/events",
    tags=["events"],
)


# ─────────────────────────────────────────────────────────────────────────────
# POST /events/ — Admin: Create full event
# ─────────────────────────────────────────────────────────────────────────────

@router.post(
    "/",
    response_model=EventResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new event with sessions and seats (Admin only)",
)
async def create_event(
    payload: EventCreate,
    db: AsyncSession = Depends(get_db_session),
    admin: User = Depends(is_admin),
):
    try:
        # ── Create Event ──────────────────────────────────────────────────────
        event = Event(
            title=payload.title,
            description=payload.description,
            category=payload.category,
            venue_name=payload.venue_name,
            venue_city=payload.venue_city,
            created_by=admin.user_id,
        )
        db.add(event)
        await db.flush()  # Get event_id

        # ── Create Seats ──────────────────────────────────────────────────────
        seen_seats: set[tuple[str, int]] = set()
        for seat_in in payload.seat_layout:
            key = (seat_in.row_name.upper(), seat_in.seat_number)
            if key in seen_seats:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Duplicate seat: Row {seat_in.row_name} Seat {seat_in.seat_number}",
                )
            seen_seats.add(key)

        seats: list[Seat] = []
        for seat_in in payload.seat_layout:
            seat = Seat(
                event_id=event.event_id,
                row_name=seat_in.row_name.upper(),
                seat_number=seat_in.seat_number,
                section=seat_in.section,
            )
            db.add(seat)
            seats.append(seat)

        await db.flush()
        total_seats = len(seats)

        # ── Create Sessions + SessionSeats ────────────────────────────────────
        created_sessions: list[EventSession] = []

        for session_in in payload.sessions:
            event_session = EventSession(
                event_id=event.event_id,
                session_name=session_in.session_name,
                start_time=session_in.start_time,
                doors_open_time=session_in.doors_open_time,
                total_seats=total_seats,
                available_seats=total_seats,
                status=SessionStatus.DRAFT,
            )
            db.add(event_session)
            await db.flush()

            for seat in seats:
                db.add(SessionSeat(
                    session_id=event_session.session_id,
                    seat_id=seat.seat_id,
                    status=SessionSeatStatus.AVAILABLE,
                    booked_by=None,
                    booked_at=None,
                    order_id=None,
                ))

            created_sessions.append(event_session)

        # FIX: Manual commit — no async with db.begin() wrapper
        await db.commit()

        # ── Return Response ───────────────────────────────────────────────────
        return EventResponse(
            event_id=event.event_id,
            title=event.title,
            description=event.description,
            category=event.category,
            venue_name=event.venue_name,
            venue_city=event.venue_city,
            created_by=event.created_by,
            created_at=event.created_at,
            total_seats=total_seats,
            total_sessions=len(created_sessions),
            sessions=[
                SessionResponse(
                    session_id=s.session_id,
                    session_name=s.session_name,
                    start_time=s.start_time,
                    doors_open_time=s.doors_open_time,
                    total_seats=s.total_seats,
                    available_seats=s.available_seats,
                    status=s.status,
                )
                for s in created_sessions
            ],
        )

    except HTTPException:
        await db.rollback()
        raise
    except Exception as e:
        await db.rollback()
        print(f"Event creation failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create event"
        )


# ─────────────────────────────────────────────────────────────────────────────
# POST /events/{event_id}/generate-seats — Admin: Add seats to existing event
# ─────────────────────────────────────────────────────────────────────────────

@router.post(
    "/{event_id}/generate-seats",
    response_model=GenerateSeatsResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Dynamically add seats to an existing event (Admin only)",
)
async def generate_seats(
    event_id: uuid.UUID,
    payload: GenerateSeatsRequest,
    db: AsyncSession = Depends(get_db_session),
    admin: User = Depends(is_admin),
):
    """
    Adds new seats to an existing event and auto-creates session_seats
    for every existing session of that event.

    Use case: Admin forgot to add a section, or venue expanded capacity.
    """

    # ── Verify event exists ───────────────────────────────────────────────────
    result = await db.execute(
        select(Event).where(Event.event_id == event_id)
    )
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found",
        )

    # ── Fetch existing seats to check for duplicates ──────────────────────────
    existing_result = await db.execute(
        select(Seat).where(Seat.event_id == event_id)
    )
    existing_seats = existing_result.scalars().all()
    existing_keys: set[tuple[str, int]] = {
        (s.row_name.upper(), s.seat_number) for s in existing_seats
    }

    # ── Validate incoming seats ───────────────────────────────────────────────
    seen_in_payload: set[tuple[str, int]] = set()
    for seat_in in payload.seat_layout:
        key = (seat_in.row_name.upper(), seat_in.seat_number)

        if key in seen_in_payload:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Duplicate in payload: Row {seat_in.row_name} Seat {seat_in.seat_number}",
            )
        if key in existing_keys:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Seat already exists: Row {seat_in.row_name} Seat {seat_in.seat_number}",
            )
        seen_in_payload.add(key)

    # ── Fetch all existing sessions for this event ────────────────────────────
    sessions_result = await db.execute(
        select(EventSession).where(EventSession.event_id == event_id)
    )
    sessions = sessions_result.scalars().all()

    # ── Create new Seats ──────────────────────────────────────────────────────
    new_seats: list[Seat] = []
    for seat_in in payload.seat_layout:
        seat = Seat(
            event_id=event_id,
            row_name=seat_in.row_name.upper(),
            seat_number=seat_in.seat_number,
            section=seat_in.section,
        )
        db.add(seat)
        new_seats.append(seat)

    await db.flush()

    # ── Create SessionSeats for each new seat × each existing session ─────────
    session_seats_created = 0
    for session in sessions:
        for seat in new_seats:
            db.add(SessionSeat(
                session_id=session.session_id,
                seat_id=seat.seat_id,
                status=SessionSeatStatus.AVAILABLE,
                booked_by=None,
                booked_at=None,
                order_id=None,
            ))
            session_seats_created += 1

        # Update session capacity counters
        session.total_seats += len(new_seats)
        session.available_seats += len(new_seats)
        db.add(session)

    await db.commit()

    return GenerateSeatsResponse(
        event_id=event_id,
        seats_created=len(new_seats),
        session_seats_created=session_seats_created,
        message=(
            f"{len(new_seats)} seats created and linked to "
            f"{len(sessions)} session(s) successfully"
        ),
    )


# ─────────────────────────────────────────────────────────────────────────────
# GET /events/ — Public: List all events
# ─────────────────────────────────────────────────────────────────────────────

@router.get(
    "/",
    response_model=EventListResponse,
    summary="Get list of all events (Public)",
)
async def list_events(
    db: AsyncSession = Depends(get_db_session),
    category: str | None = Query(None, description="Filter by category"),
    city: str | None = Query(None, description="Filter by venue city"),
    search: str | None = Query(None, description="Search by event title"),
    skip: int = Query(0, ge=0, description="Pagination offset"),
    limit: int = Query(20, ge=1, le=100, description="Results per page"),
):
    """
    Returns a paginated list of all events.
    Optionally filter by category or city.
    No auth required — public endpoint.
    """

    # ── Build base query ──────────────────────────────────────────────────────
    query = select(Event)

    if category:
        query = query.where(Event.category.ilike(f"%{category}%"))
    if city:
        query = query.where(Event.venue_city.ilike(f"%{city}%"))
    if search:
        query = query.where(Event.title.ilike(f"%{search}%"))

    # ── Get total count ───────────────────────────────────────────────────────
    count_result = await db.execute(
        select(func.count()).select_from(query.subquery())
    )
    total = count_result.scalar_one()

    # ── Fetch paginated events ────────────────────────────────────────────────
    events_result = await db.execute(
        query.order_by(Event.created_at.desc()).offset(skip).limit(limit)
    )
    events = events_result.scalars().all()

    # ── Get session count per event ───────────────────────────────────────────
    event_ids = [e.event_id for e in events]

    session_counts: dict[uuid.UUID, int] = {}
    if event_ids:
        counts_result = await db.execute(
            select(EventSession.event_id, func.count(EventSession.session_id))
            .where(EventSession.event_id.in_(event_ids))
            .group_by(EventSession.event_id)
        )
        session_counts = {row[0]: row[1] for row in counts_result.all()}

    # ── Build response ────────────────────────────────────────────────────────
    return EventListResponse(
        total=total,
        events=[
            EventListItem(
                event_id=e.event_id,
                title=e.title,
                category=e.category,
                venue_name=e.venue_name,
                venue_city=e.venue_city,
                created_at=e.created_at,
                total_sessions=session_counts.get(e.event_id, 0),
            )
            for e in events
        ],
    )


# ─────────────────────────────────────────────────────────────────────────────
# GET /events/{event_id}/seats — Public: Seat map for a session
# ─────────────────────────────────────────────────────────────────────────────

@router.get(
    "/{event_id}/seats",
    response_model=SeatMapResponse,
)
async def get_seat_map(
    event_id: uuid.UUID,
    session_id: uuid.UUID = Query(..., description="Session ID to check seat availability for"),
    db: AsyncSession = Depends(get_db_session),
):
    """
    Returns the full seat map for a specific session showing
    each seat's current status (available / booked / blocked).

    No auth required — public endpoint.
    """

    # ── Verify event exists ───────────────────────────────────────────────────
    event_result = await db.execute(
        select(Event).where(Event.event_id == event_id)
    )
    event = event_result.scalar_one_or_none()
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found",
        )

    # ── Verify session exists and belongs to this event ───────────────────────
    session_result = await db.execute(
        select(EventSession).where(
            EventSession.session_id == session_id,
            EventSession.event_id == event_id,
        )
    )
    session = session_result.scalar_one_or_none()
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found for this event",
        )

    # ── Fetch all session_seats joined with seat details ──────────────────────
    seats_result = await db.execute(
        select(SessionSeat, Seat)
        .join(Seat, Seat.seat_id == SessionSeat.seat_id)
        .where(SessionSeat.session_id == session_id)
        .order_by(Seat.row_name, Seat.seat_number)
    )
    rows = seats_result.all()

    if not rows:
        raise HTTPException(status_code=404, detail="No seats found for this session")

    # ── Count different statuses ──────────────────────────────────────────────
    booked_count = 0
    blocked_count = 0

    for ss, _ in rows:
        if ss.status == SessionSeatStatus.BOOKED:
            booked_count += 1
        elif ss.status == SessionSeatStatus.BLOCKED:
            blocked_count += 1

    total_unavailable = booked_count + blocked_count

    # ── Build response ────────────────────────────────────────────────────────
    return SeatMapResponse(
        event_id=event_id,
        session_id=session_id,
        session_name=session.session_name,
        total_seats=session.total_seats,
        available_seats=session.available_seats,
        booked_seats=booked_count,
        blocked_seats=blocked_count,
        unavailable_seats=total_unavailable,
        seats=[
            SeatMapItem(
                session_seat_id=ss.session_seat_id,
                seat_id=seat.seat_id,
                row_name=seat.row_name,
                seat_number=seat.seat_number,
                section=seat.section,
                status=ss.status,
                booked_by=ss.booked_by,
                booked_at=ss.booked_at,
            )
            for ss, seat in rows
        ],
    )


# ─────────────────────────────────────────────────────────────────────────────
# POST /events/seats/{seat_id}/lock — Lock a seat via Redis
# ─────────────────────────────────────────────────────────────────────────────

@router.post(
    "/seats/{seat_id}/lock",
    status_code=status.HTTP_200_OK,
    summary="Lock a seat using Redis (atomic distributed lock)",
)
async def lock_seat(
    seat_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    session_id: uuid.UUID = Query(..., description="Session ID for this seat lock"),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
    redis=Depends(get_redis),
):
    """Acquire a Redis lock for a specific (session_id, seat_id).

    - Redis: SET seat:{session_id}:{seat_id} {user_id} NX EX 300
    - If acquired (OK): enqueue DB update to RESERVED.
    - If not acquired (None): reject with 409.
    """

    lock_key = seat_lock_key(str(session_id), str(seat_id))

    result = await redis.set(
        lock_key,
        str(current_user.user_id),
        nx=True,
        ex=300,
    )

    if result is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Seat is already locked or sold",
        )

    async def _mark_reserved():
        # Background task: mark the SessionSeat as RESERVED if still present.
        async with db.begin_nested():
            q = select(SessionSeat).where(
                SessionSeat.session_id == session_id,
                SessionSeat.seat_id == seat_id,
            )
            res = await db.execute(q)
            session_seat = res.scalar_one_or_none()
            if session_seat is None:
                return
            session_seat.status = SessionSeatStatus.RESERVED
            session_seat.booked_by = current_user.user_id

    background_tasks.add_task(_mark_reserved)

    return {
        "status": "locked",
        "seat_id": seat_id,
        "session_id": session_id,
        "locked_by": current_user.user_id,
        "ttl_seconds": 300,
    }


# ─────────────────────────────────────────────────────────────────────────────
# GET /events/{event_id} — Get full event details with sessions
# ─────────────────────────────────────────────────────────────────────────────

@router.get(
    "/{event_id}",
    response_model=EventResponse,
    summary="Get detailed event information including all sessions (Public)",
)
async def get_event_detail(
    event_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_session),
):
    """
    Returns full event details along with all its sessions.
    Useful for frontend event detail / seat selection page.
    """

    # ── Fetch Event ───────────────────────────────────────────────────────────
    event_result = await db.execute(
        select(Event).where(Event.event_id == event_id)
    )
    event = event_result.scalar_one_or_none()

    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found"
        )

    # ── Fetch All Sessions for this Event ─────────────────────────────────────
    sessions_result = await db.execute(
        select(EventSession)
        .where(EventSession.event_id == event_id)
        .order_by(EventSession.start_time)
    )
    sessions = sessions_result.scalars().all()

    # ── Build Response ────────────────────────────────────────────────────────
    return EventResponse(
        event_id=event.event_id,
        title=event.title,
        description=event.description,
        category=event.category,
        venue_name=event.venue_name,
        venue_city=event.venue_city,
        created_by=event.created_by,
        created_at=event.created_at,
        total_seats=sessions[0].total_seats if sessions else 0,
        total_sessions=len(sessions),
        sessions=[
            SessionResponse(
                session_id=s.session_id,
                session_name=s.session_name,
                start_time=s.start_time,
                doors_open_time=s.doors_open_time,
                total_seats=s.total_seats,
                available_seats=s.available_seats,
                status=s.status,
            )
            for s in sessions
        ],
    )
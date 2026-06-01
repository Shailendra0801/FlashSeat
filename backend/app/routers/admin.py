"""
Admin router — dashboard stats, event management, session status, seat blocking, order management.
"""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import is_admin
from app.database import get_db_session
from app.models.enums import OrderStatus, SessionSeatStatus, SessionStatus
from app.models.event import Event
from app.models.event_session import EventSession
from app.models.order import Order
from app.models.order_item import OrderItem
from app.models.seat import Seat
from app.models.session_seat import SessionSeat
from app.models.user import User

router = APIRouter(prefix="/admin", tags=["admin"])


# ─────────────────────────────────────────────────────────────────────────────
# GET /admin/stats — Dashboard statistics
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/stats")
async def admin_stats(
    admin: User = Depends(is_admin),
    db: AsyncSession = Depends(get_db_session),
):
    total_events = (await db.execute(select(func.count(Event.event_id)))).scalar_one()
    total_users = (await db.execute(select(func.count(User.user_id)))).scalar_one()
    total_orders = (await db.execute(select(func.count(Order.order_id)))).scalar_one()
    confirmed_orders = (await db.execute(
        select(func.count(Order.order_id)).where(Order.status == OrderStatus.CONFIRMED)
    )).scalar_one()
    total_revenue = (await db.execute(
        select(func.coalesce(func.sum(Order.total_amount), 0)).where(Order.status == OrderStatus.CONFIRMED)
    )).scalar_one()
    total_seats = (await db.execute(select(func.count(SessionSeat.session_seat_id)))).scalar_one()
    booked_seats = (await db.execute(
        select(func.count(SessionSeat.session_seat_id)).where(SessionSeat.status == SessionSeatStatus.BOOKED)
    )).scalar_one()

    return {
        "total_events": total_events,
        "total_users": total_users,
        "total_orders": total_orders,
        "confirmed_orders": confirmed_orders,
        "total_revenue": float(total_revenue),
        "total_seats": total_seats,
        "booked_seats": booked_seats,
        "seat_utilization": round(booked_seats / total_seats * 100, 1) if total_seats > 0 else 0,
    }


# ─────────────────────────────────────────────────────────────────────────────
# PUT /admin/events/{event_id} — Edit event details
# ─────────────────────────────────────────────────────────────────────────────

from pydantic import BaseModel, Field
from typing import Optional


class EventUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=512)
    description: Optional[str] = None
    category: Optional[str] = Field(None, min_length=1, max_length=100)
    venue_name: Optional[str] = None
    venue_city: Optional[str] = None


class SessionStatusUpdate(BaseModel):
    status: SessionStatus


class SeatBlockUpdate(BaseModel):
    blocked: bool
    reason: Optional[str] = None


class AdminOrderItemResponse(BaseModel):
    order_item_id: uuid.UUID
    seat_label: str


class AdminOrderResponse(BaseModel):
    order_id: uuid.UUID
    user_id: uuid.UUID
    user_email: str
    session_id: uuid.UUID
    event_title: str
    status: str
    total_tickets: int
    total_amount: float
    currency: str
    created_at: datetime
    items: list[AdminOrderItemResponse] = []


class AdminOrderListResponse(BaseModel):
    total: int
    orders: list[AdminOrderResponse]


@router.put("/events/{event_id}", response_model=dict)
async def update_event(
    event_id: uuid.UUID,
    payload: EventUpdate,
    admin: User = Depends(is_admin),
    db: AsyncSession = Depends(get_db_session),
):
    result = await db.execute(select(Event).where(Event.event_id == event_id))
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    update_data = payload.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    for field, value in update_data.items():
        setattr(event, field, value)

    await db.commit()
    return {"message": "Event updated", "event_id": str(event_id)}


# ─────────────────────────────────────────────────────────────────────────────
# DELETE /admin/events/{event_id} — Delete event
# ─────────────────────────────────────────────────────────────────────────────

@router.delete("/events/{event_id}")
async def delete_event(
    event_id: uuid.UUID,
    admin: User = Depends(is_admin),
    db: AsyncSession = Depends(get_db_session),
):
    result = await db.execute(select(Event).where(Event.event_id == event_id))
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    await db.delete(event)
    await db.commit()
    return {"message": "Event deleted", "event_id": str(event_id)}


# ─────────────────────────────────────────────────────────────────────────────
# PATCH /admin/events/{event_id}/sessions/{session_id}/status
# ─────────────────────────────────────────────────────────────────────────────

@router.patch("/events/{event_id}/sessions/{session_id}/status")
async def update_session_status(
    event_id: uuid.UUID,
    session_id: uuid.UUID,
    payload: SessionStatusUpdate,
    admin: User = Depends(is_admin),
    db: AsyncSession = Depends(get_db_session),
):
    result = await db.execute(
        select(EventSession).where(
            EventSession.session_id == session_id,
            EventSession.event_id == event_id,
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    session.status = payload.status
    await db.commit()
    return {"message": f"Session status updated to {payload.status.value}", "session_id": str(session_id)}


# ─────────────────────────────────────────────────────────────────────────────
# POST /admin/events/{event_id}/sessions/{session_id}/seats/{seat_id}/block
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/events/{event_id}/sessions/{session_id}/seats/{seat_id}/block")
async def block_seat(
    event_id: uuid.UUID,
    session_id: uuid.UUID,
    seat_id: uuid.UUID,
    payload: SeatBlockUpdate,
    admin: User = Depends(is_admin),
    db: AsyncSession = Depends(get_db_session),
):
    # Verify session belongs to event
    session_result = await db.execute(
        select(EventSession).where(
            EventSession.session_id == session_id,
            EventSession.event_id == event_id,
        )
    )
    if not session_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Session not found for this event")

    # Find the session_seat
    result = await db.execute(
        select(SessionSeat).where(
            SessionSeat.session_id == session_id,
            SessionSeat.seat_id == seat_id,
        )
    )
    session_seat = result.scalar_one_or_none()
    if not session_seat:
        raise HTTPException(status_code=404, detail="Seat not found in this session")

    if payload.blocked:
        if session_seat.status == SessionSeatStatus.BOOKED:
            raise HTTPException(status_code=409, detail="Cannot block a booked seat")
        session_seat.status = SessionSeatStatus.BLOCKED
    else:
        if session_seat.status == SessionSeatStatus.BLOCKED:
            session_seat.status = SessionSeatStatus.AVAILABLE

    await db.commit()
    action = "blocked" if payload.blocked else "unblocked"
    return {"message": f"Seat {action}", "seat_id": str(seat_id), "status": session_seat.status.value}


# ─────────────────────────────────────────────────────────────────────────────
# GET /admin/orders — List all orders (admin)
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/orders", response_model=AdminOrderListResponse)
async def list_all_orders(
    admin: User = Depends(is_admin),
    db: AsyncSession = Depends(get_db_session),
    event_id: uuid.UUID | None = Query(None),
    session_id: uuid.UUID | None = Query(None),
    order_status: OrderStatus | None = Query(None, alias="status"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
):
    q = select(Order).order_by(Order.created_at.desc())

    if order_status:
        q = q.where(Order.status == order_status)
    if session_id:
        q = q.where(Order.session_id == session_id)

    # Count
    count_q = select(func.count()).select_from(q.subquery())
    total = (await db.execute(count_q)).scalar_one()

    # Fetch orders
    orders_result = await db.execute(q.offset(skip).limit(limit))
    orders = orders_result.scalars().all()

    if not orders:
        return AdminOrderListResponse(total=total, orders=[])

    order_ids = [o.order_id for o in orders]
    user_ids = list({o.user_id for o in orders})
    session_ids = list({o.session_id for o in orders})

    # Fetch users
    users_result = await db.execute(select(User).where(User.user_id.in_(user_ids)))
    users_by_id = {str(u.user_id): u for u in users_result.scalars().all()}

    # Fetch sessions + event titles
    sessions_result = await db.execute(
        select(EventSession, Event)
        .join(Event, Event.event_id == EventSession.event_id)
        .where(EventSession.session_id.in_(session_ids))
    )
    session_info = {}
    for sess, evt in sessions_result.all():
        session_info[str(sess.session_id)] = evt.title

    # Filter by event_id if provided
    if event_id:
        matching_session_ids = {sid for sid, title in session_info.items() if any(
            s.session_id == uuid.UUID(sid) and s.event_id == event_id
            for s in (await db.execute(select(EventSession).where(EventSession.event_id == event_id))).scalars().all()
        )}

    # Fetch items
    items_result = await db.execute(
        select(OrderItem).where(OrderItem.order_id.in_(order_ids))
    )
    items_by_order: dict[str, list[AdminOrderItemResponse]] = {}
    for item in items_result.scalars().all():
        oid = str(item.order_id)
        items_by_order.setdefault(oid, []).append(
            AdminOrderItemResponse(order_item_id=item.order_item_id, seat_label=item.seat_label)
        )

    result_orders = []
    for o in orders:
        user = users_by_id.get(str(o.user_id))
        result_orders.append(AdminOrderResponse(
            order_id=o.order_id,
            user_id=o.user_id,
            user_email=user.email if user else "unknown",
            session_id=o.session_id,
            event_title=session_info.get(str(o.session_id), "Unknown Event"),
            status=o.status.value,
            total_tickets=o.total_tickets,
            total_amount=float(o.total_amount),
            currency=o.currency,
            created_at=o.created_at,
            items=items_by_order.get(str(o.order_id), []),
        ))

    return AdminOrderListResponse(total=total, orders=result_orders)

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.core.redis import get_redis, seat_lock_key
from app.database import get_db_session
from app.models.enums import OrderStatus, SessionSeatStatus
from app.models.order import Order
from app.models.order_item import OrderItem
from app.models.session_seat import SessionSeat
from app.models.seat import Seat

from app.models.user import User
from app.schemas.order import CreateOrderRequest, CreateOrderResponse, OrderResponse
from app.schemas.orders_history import MyOrdersResponse, OrderHistoryResponse, OrderHistoryItemResponse

from sqlalchemy.exc import IntegrityError, OperationalError  # noqa: F811

router = APIRouter(prefix="/orders", tags=["orders"])


@router.get(
    "/me",
    response_model=MyOrdersResponse,
    summary="Get current user's confirmed (and failed/pending) orders",
)
async def my_orders(
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """Order history for the authenticated user.

    Frontend expects GET /orders/me and then reads:
      data?.orders || data || []

    We return { orders: [...] } where each order includes:
      - order_id, status, created_at
      - items: [{ seat_label, order_item_id }]
    """

    q = (
        select(Order)
        .where(Order.user_id == current_user.user_id)
        .order_by(Order.created_at.desc())
    )
    res = await db.execute(q)
    orders: list[Order] = res.scalars().all()

    if not orders:
        return MyOrdersResponse(orders=[])

    order_ids = [o.order_id for o in orders]

    # Fetch items + seat labels in one query.
    items_q = (
        select(OrderItem)
        .where(OrderItem.order_id.in_(order_ids))
        .order_by(OrderItem.created_at)
    )
    items_res = await db.execute(items_q)
    items: list[OrderItem] = items_res.scalars().all()

    items_by_order_id: dict[str, list[OrderHistoryItemResponse]] = {}
    for it in items:
        oid = str(it.order_id)
        items_by_order_id.setdefault(oid, []).append(
            OrderHistoryItemResponse(
                order_item_id=it.order_item_id,
                seat_label=it.seat_label,
            )
        )

    orders_resp: list[OrderHistoryResponse] = []
    for o in orders:
        orders_resp.append(
            OrderHistoryResponse(
                order_id=o.order_id,
                status=o.status.value,
                created_at=o.created_at,
                items=items_by_order_id.get(str(o.order_id), []),
            )
        )

    return MyOrdersResponse(orders=orders_resp)



class _SeatLockValidationError(HTTPException):
    pass


def _normalize_unique(items: list[uuid.UUID]) -> list[uuid.UUID]:
    # Preserve order is not required; only uniqueness.
    return list(dict.fromkeys(items))


@router.post(
    "",
    response_model=CreateOrderResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create order from locked seats (Redis -> ACID PostgreSQL transaction)",
)
async def create_order(
    payload: CreateOrderRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
    redis=Depends(get_redis),
):
    """Finalize checkout.

    Steps:
    1) Validate each provided seat has a Redis lock owned by current_user.
    2) Begin a single PostgreSQL transaction:
       - Create Order (PENDING)
       - For each seat_id: ensure SessionSeat is in RESERVED state for this user/session
         and then update to BOOKED + bind order_id and metadata.
       - Create OrderItem per seat.
       - Mark Order CONFIRMED if all succeed.
    3) After successful commit, delete the Redis locks.

    Redis lock ownership check happens before opening the DB transaction.
    """

    seat_ids = _normalize_unique(payload.seat_ids)
    if not seat_ids:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="seat_ids must not be empty")

    # ---- 1) Redis validation (before DB transaction) ----
    # Ensure all keys exist and belong to this user.
    # We use a simple per-key GET to keep logic explicit.
    # If any mismatch occurs: fail with 409 and do not touch the DB.
    for seat_id in seat_ids:
        lock_key = seat_lock_key(str(payload.session_id), str(seat_id))
        lock_owner = await redis.get(lock_key)
        if lock_owner is None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Seat lock missing/expired for seat_id={seat_id}",
            )
        if lock_owner != str(current_user.user_id):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Seat lock not owned by user for seat_id={seat_id}",
            )

    # ---- 2) ACID transaction in PostgreSQL ----
    try:
        async with db.begin():
            # Create the order first (PENDING)
            order = Order(
                user_id=current_user.user_id,
                session_id=payload.session_id,
                total_tickets=len(seat_ids),
                total_amount=0.00,
                currency="INR",
                status=OrderStatus.PENDING,
            )
            db.add(order)
            await db.flush()  # get order_id

            # Fetch session_seats for the given (session_id, seat_ids)
            # Lock each row for update to prevent concurrent writes.
            q = (
                select(SessionSeat)
                .where(
                    SessionSeat.session_id == payload.session_id,
                    SessionSeat.seat_id.in_(seat_ids),
                )
                .with_for_update(nowait=True)
            )
            res = await db.execute(q)
            session_seats: list[SessionSeat] = res.scalars().all()

            if len(session_seats) != len(seat_ids):
                # One or more seats don't exist in this session.
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Some seats are not part of the requested session",
                )

            # Validate reserved state + bind booking
            # Also create OrderItems.
            booked_at = datetime.now(timezone.utc)

            seats_result = await db.execute(
                select(Seat).where(Seat.seat_id.in_(seat_ids))
            )
            seats_by_id = {str(s.seat_id): s for s in seats_result.scalars().all()}
            
            ss_by_seat_id = {str(ss.seat_id): ss for ss in session_seats}

            for seat_id in seat_ids:
                ss = ss_by_seat_id.get(str(seat_id))
                if ss is None:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail=f"Seat not found in session for seat_id={seat_id}",
                    )

                if ss.status != SessionSeatStatus.RESERVED:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail=f"Seat is not reserved (state={ss.status}) seat_id={seat_id}",
                    )
                if ss.booked_by != current_user.user_id:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail=f"Seat reserved by different user seat_id={seat_id}",
                    )

                ss.status = SessionSeatStatus.BOOKED
                ss.booked_at = booked_at
                ss.order_id = order.order_id
                ss.booked_by = current_user.user_id

                # ── Human-readable seat label snapshot ───────────────────────────────
                seat = seats_by_id.get(str(seat_id))
                seat_label = (
                    f"{seat.row_name}{seat.seat_number} - {seat.section.value}"
                    if seat else str(seat_id)
                )

                order_item = OrderItem(
                    order_id=order.order_id,
                    session_seat_id=ss.session_seat_id,
                    seat_label=seat_label,
                    unit_price=0.00,
                    currency="INR",
                )
                db.add(order_item)

            # Transition order to CONFIRMED
            order.status = OrderStatus.CONFIRMED

    except OperationalError as e:
        # NOWAIT lock contention — another transaction holds the row lock
        # This is a 409, not a 500
        if "could not obtain lock" in str(e).lower():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Seat is currently being booked by another user. Try again.",
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error during booking",
        )

    except IntegrityError as e:
        # Only map to 409 if it's the unique constraint on session_seats
        # Other constraint failures (FK, null, check) should not be misclassified
        if "uq_order_item_session_seat" in str(e).orig or "uq_session_seat_per_session" in str(e.orig):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="One or more seats were already booked",
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database constraint violation",
        )

    except HTTPException:
        raise

    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create order",
        )

    # ---- 3) Redis lock deletion AFTER successful DB commit ----
    # At this point, the transaction above has committed.
    # Delete all the corresponding lock keys.
    pipe = redis.pipeline()
    for seat_id in seat_ids:
        pipe.delete(seat_lock_key(str(payload.session_id), str(seat_id)))
    await pipe.execute()

    # Return response
    # Note: expire_on_commit=False in session maker, so attributes should remain available.
    return CreateOrderResponse(
        order=OrderResponse(
            order_id=order.order_id,
            status=order.status.value,
            failure_reason=order.failure_reason,
            created_at=order.created_at,
        )
    )


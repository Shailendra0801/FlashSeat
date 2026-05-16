"""
OrderItem model.

Maps individual seats to an order. One OrderItem = one seat in one order.

The UniqueConstraint on session_seat_id ensures that a given session_seat
can only appear in ONE confirmed order — the final DB-level guard against
the "same seat in two orders" bug that Redis + FOR UPDATE should already
prevent upstream.

This is belt-and-suspenders engineering: even if your service layer has
a bug that constructs two orders pointing to the same session_seat, the
DB will reject the second insert.
"""

import uuid

from sqlalchemy import (
    ForeignKey,
    Numeric,
    String,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from decimal import Decimal

from app.models.base import Base, TimestampMixin


class OrderItem(Base, TimestampMixin):
    __tablename__ = "order_items"

    # ── Primary Key ──────────────────────────────────────────────────────────
    order_item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )

    # ── Core FKs ──────────────────────────────────────────────────────────────
    order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("orders.order_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    session_seat_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("session_seats.session_seat_id", ondelete="RESTRICT"),
        # RESTRICT: never silently delete an order_item if a session_seat
        # is deleted. Force explicit cleanup so nothing is silently lost.
        nullable=False,
        index=True,
    )

    # ── Denormalized Seat Info (for display without joins) ────────────────────
    # Snapshot of seat info at booking time. This protects against future
    # changes to the seat record invalidating historical order displays.
    seat_label: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        # e.g. "VIP - Row A - Seat 12". Populated at booking time.
    )

    # Per-seat pricing (important: seats in different sections have different prices)
    unit_price: Mapped[Decimal] = mapped_column(
        Numeric(10, 2),
        nullable=False,
        default=0.00,
        server_default="0.00",
    )
    currency: Mapped[str] = mapped_column(
        String(3),
        nullable=False,
        default="INR",
        server_default="INR",
    )

    # ── Relationships ─────────────────────────────────────────────────────────
    order: Mapped["Order"] = relationship(  # noqa: F821
        "Order",
        back_populates="items",
        lazy="noload",
    )
    session_seat: Mapped["SessionSeat"] = relationship(  # noqa: F821
        "SessionSeat",
        back_populates="order_item",
        lazy="noload",
    )

    # ── The Anti-Double-Booking Constraint ────────────────────────────────────
    __table_args__ = (
        UniqueConstraint(
            "session_seat_id",
            name="uq_order_item_session_seat",
            # A session_seat can only appear once across ALL order_items.
            #
            # This is the ultimate DB-level guarantee: even if the Redis lock
            # fails AND the FOR UPDATE lock somehow doesn't catch it, this
            # constraint makes the second insert raise IntegrityError,
            # which your exception handler maps to a 409 Conflict response.
            #
            # Without this, a race condition could theoretically produce two
            # CONFIRMED orders both containing the same physical seat.
        ),
    )

    def __repr__(self) -> str:
        return (
            f"<OrderItem id={self.order_item_id} "
            f"order={self.order_id} seat={self.session_seat_id}>"
        )
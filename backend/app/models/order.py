"""
Order model.

Represents a single booking transaction by a user for a session.
One Order → many OrderItems (one per seat).

The order is created in PENDING status when the user confirms the cart.
It transitions to CONFIRMED once all seat writes succeed atomically,
or FAILED if any seat was already taken or the lock expired.

Why create the Order record BEFORE confirming seats?
    Because you need an order_id to reference in session_seats.order_id
    and order_items. Creating it first (in the same transaction) ensures
    you always have a traceable audit record, even for failed bookings.
"""

import uuid

from sqlalchemy import (
    Enum as SAEnum,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from decimal import Decimal

from app.models.base import Base, TimestampMixin
from app.models.enums import OrderStatus


class Order(Base, TimestampMixin):
    __tablename__ = "orders"

    # ── Primary Key ──────────────────────────────────────────────────────────
    order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )

    # ── Core FKs ──────────────────────────────────────────────────────────────
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.user_id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("event_sessions.session_id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    # ── Booking Summary ───────────────────────────────────────────────────────
    total_tickets: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        # Denormalized count of seats in this order.
        # Must match the number of OrderItem records at commit time.
        # Verified at service layer; not enforced by DB constraint here
        # (would require a deferred constraint or trigger).
    )

    # Pricing fields stubbed in now for future payment phase.
    # Storing as Numeric(10, 2) for monetary precision — never use Float for money.
    total_amount: Mapped[Decimal] = mapped_column(
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

    # ── Status ────────────────────────────────────────────────────────────────
    status: Mapped[OrderStatus] = mapped_column(
        SAEnum(OrderStatus, name="order_status_enum", create_type=True, values_callable=lambda x: [e.value for e in x]),
        nullable=False,
        default=OrderStatus.PENDING,
        server_default="pending",
        index=True,
    )

    # ── Traceability ──────────────────────────────────────────────────────────
    failure_reason: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
        # Populated when status = FAILED. Useful for debugging concurrent
        # failures: "Seat already booked", "Redis lock timeout", etc.
    )

    # ── Relationships ─────────────────────────────────────────────────────────
    user: Mapped["User"] = relationship(  # noqa: F821
        "User",
        back_populates="orders",
        lazy="noload",
    )
    session: Mapped["EventSession"] = relationship(  # noqa: F821
        "EventSession",
        back_populates="orders",
        lazy="noload",
    )
    items: Mapped[list["OrderItem"]] = relationship(  # noqa: F821
        "OrderItem",
        back_populates="order",
        cascade="all, delete-orphan",
        lazy="noload",
    )

    # ── Indexes ───────────────────────────────────────────────────────────────
    __table_args__ = (
        Index("ix_orders_user_status", "user_id", "status"),
        # Fast query: "all CONFIRMED orders for user X" (order history page)
        Index("ix_orders_session_status", "session_id", "status"),
        # Fast query: "all CONFIRMED orders for session X" (admin dashboard)
    )

    def __repr__(self) -> str:
        return (
            f"<Order id={self.order_id} "
            f"user={self.user_id} status={self.status} "
            f"tickets={self.total_tickets}>"
        )
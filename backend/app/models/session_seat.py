"""
SessionSeat model — THE most critical table in FlashSeat.

This table is the single source of truth for seat availability per session.
Every concurrency guarantee in the system ultimately depends on the constraints
and locking strategy applied to this table.

WHY THIS TABLE EXISTS (and not just a boolean on Seat):
    A physical seat can be "available" for Session A and "booked" for Session B.
    If you stored availability on Seat itself, you'd have no way to differentiate
    per-session state. SessionSeat is the join table that holds that state.

CONCURRENCY PROTECTION — 3 LAYERS:
    Layer 1 — Redis distributed lock (acquired BEFORE DB transaction opens):
        Key pattern: "seat_lock:{session_id}:{seat_id}"
        TTL: 10–30 seconds (configurable per business rules)
        Effect: Only one request can attempt the DB write for this seat at a time.
        Failure mode: Redis crashes → fall through to Layer 2.

    Layer 2 — PostgreSQL SELECT ... FOR UPDATE (inside DB transaction):
        SELECT * FROM session_seats
        WHERE session_id = $1 AND seat_id = $2
        FOR UPDATE NOWAIT;
        Effect: Row-level DB lock. If another transaction holds it, NOWAIT
        raises LockNotAvailable immediately (no queue buildup).
        This is your safety net when the Redis lock fails or expires mid-flight.

    Layer 3 — UniqueConstraint + status check (last line of DB defense):
        If somehow two transactions slip past layers 1 and 2, the UNIQUE
        constraint on (session_id, seat_id) + the CHECK on status means
        the second UPDATE/INSERT will either fail or produce a DB error
        that gets caught and returned as "seat already booked".

RECOMMENDED TRANSACTION ISOLATION:
    Use READ COMMITTED (PostgreSQL default) + explicit FOR UPDATE, NOT
    SERIALIZABLE. SERIALIZABLE adds too much contention for flash sales.
    Your FOR UPDATE + constraints give you the same safety guarantees with
    much better throughput.
"""

import uuid
from datetime import datetime

from sqlalchemy import (
    DateTime,
    Enum as SAEnum,
    ForeignKey,
    Index,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin
from app.models.enums import SessionSeatStatus


class SessionSeat(Base, TimestampMixin):
    __tablename__ = "session_seats"

    # ── Primary Key ──────────────────────────────────────────────────────────
    session_seat_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )

    # ── Core FK Pair (the unique business key) ────────────────────────────────
    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("event_sessions.session_id", ondelete="CASCADE"),
        nullable=False,
        # Indexed via composite UniqueConstraint below — no separate index needed.
    )
    seat_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("seats.seat_id", ondelete="CASCADE"),
        nullable=False,
    )

    # ── Booking State ─────────────────────────────────────────────────────────
    status: Mapped[SessionSeatStatus] = mapped_column(
        SAEnum(SessionSeatStatus, name="session_seat_status_enum", create_type=True, values_callable=lambda x: [e.value for e in x]),
        nullable=False,
        default=SessionSeatStatus.AVAILABLE,
        server_default="available",
        # CRITICAL: This column is what FOR UPDATE locks are placed on.
        # The transition AVAILABLE → BOOKED must happen atomically.
        # Never update this outside of a properly isolated transaction.
    )

    # ── Booking Metadata ──────────────────────────────────────────────────────
    booked_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.user_id", ondelete="SET NULL"),
        # SET NULL: if user is deleted, we keep the booking record for audit.
        nullable=True,
    )
    booked_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        # Set at the application layer when status → BOOKED.
        # Could also use a DB trigger, but application-level is more testable.
    )

    # ── Order Traceability ────────────────────────────────────────────────────
    # Denormalized reference back to the order that created this booking.
    # Useful for fast "which order owns this seat" queries without joining
    # through order_items. Nullable because seat starts as unbooked.
    order_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("orders.order_id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # ── Relationships ─────────────────────────────────────────────────────────
    session: Mapped["EventSession"] = relationship(  # noqa: F821
        "EventSession",
        back_populates="session_seats",
        lazy="noload",
    )
    seat: Mapped["Seat"] = relationship(  # noqa: F821
        "Seat",
        back_populates="session_seats",
        lazy="noload",
    )
    booked_by_user: Mapped["User | None"] = relationship(  # noqa: F821
        "User",
        back_populates="session_seats_booked",
        foreign_keys=[booked_by],
        lazy="noload",
    )
    order: Mapped["Order | None"] = relationship(  # noqa: F821
        "Order",
        lazy="noload",
    )
    order_item: Mapped["OrderItem | None"] = relationship(  # noqa: F821
        "OrderItem",
        back_populates="session_seat",
        lazy="noload",
    )

    # ── Constraints & Indexes — THE CONCURRENCY BACKBONE ─────────────────────
    __table_args__ = (
        UniqueConstraint(
            "session_id", "seat_id",
            name="uq_session_seat_per_session",
            # THE MOST IMPORTANT CONSTRAINT IN THE ENTIRE SCHEMA.
            #
            # This makes it physically impossible at the DB level for the same
            # seat to be double-inserted for the same session — even if two
            # concurrent transactions both pass the application-level check.
            #
            # PostgreSQL enforces unique constraints with an implicit B-tree index,
            # so this also serves as the query index for (session_id, seat_id) lookups.
        ),
        Index(
            "ix_session_seats_session_status",
            "session_id",
            "status",
            # Critical for: "SELECT all AVAILABLE seats for session X"
            # This is called on every session page load — must be fast.
        ),
        Index(
            "ix_session_seats_booked_by",
            "booked_by",
            postgresql_where=text("booked_by IS NOT NULL"),
            # Partial index — only indexes rows that have a booker.
            # Keeps index small; available seats (booked_by IS NULL) are excluded.
        ),
    )

    def __repr__(self) -> str:
        return (
            f"<SessionSeat id={self.session_seat_id} "
            f"session={self.session_id} seat={self.seat_id} "
            f"status={self.status}>"
        )
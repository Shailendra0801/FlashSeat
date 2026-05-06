"""
EventSession model.

Represents a single scheduled show/screening/match under an Event.
Example: "Coldplay — Mumbai Night 1" and "Coldplay — Mumbai Night 2"
are two EventSessions under the same Event.

available_seats is a DENORMALIZED counter for fast reads.
It must be decremented atomically inside the same DB transaction
that flips a SessionSeat to BOOKED.
"""

import uuid
from datetime import datetime

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    Enum as SAEnum,
    ForeignKey,
    Index,
    Integer,
    String,
    text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin
from app.models.enums import SessionStatus


class EventSession(Base, TimestampMixin):
    __tablename__ = "event_sessions"

    # ── Primary Key ──────────────────────────────────────────────────────────
    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )

    # ── Parent Event ──────────────────────────────────────────────────────────
    event_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("events.event_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # ── Schedule ──────────────────────────────────────────────────────────────
    session_name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        # e.g. "Night 1", "Matinee", "3 PM Show"
    )
    start_time: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        index=True,  # For "upcoming sessions" queries sorted by start_time
    )
    doors_open_time: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    # ── Capacity ──────────────────────────────────────────────────────────────
    total_seats: Mapped[int] = mapped_column(Integer, nullable=False)

    available_seats: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        # This is a DENORMALIZED counter. It MUST be updated atomically
        # using SELECT ... FOR UPDATE or UPDATE ... WHERE available_seats > 0
        # inside the same transaction that writes an order.
        # Do NOT rely on application-level reads of this column to decide
        # if booking is possible — use a DB-level check.
    )

    # ── Status ────────────────────────────────────────────────────────────────
    status: Mapped[SessionStatus] = mapped_column(
        SAEnum(SessionStatus, name="session_status_enum", create_type=True, values_callable=lambda x: [e.value for e in x]),
        default=SessionStatus.DRAFT,
        nullable=False,
        index=True,
    )

    # ── Relationships ─────────────────────────────────────────────────────────
    event: Mapped["Event"] = relationship(  # noqa: F821
        "Event",
        back_populates="sessions",
        lazy="noload",
    )
    session_seats: Mapped[list["SessionSeat"]] = relationship(  # noqa: F821
        "SessionSeat",
        back_populates="session",
        cascade="all, delete-orphan",
        lazy="noload",
    )
    orders: Mapped[list["Order"]] = relationship(  # noqa: F821
        "Order",
        back_populates="session",
        lazy="noload",
    )

    # ── Constraints & Indexes ─────────────────────────────────────────────────
    __table_args__ = (
        CheckConstraint(
            "available_seats >= 0",
            name="ck_session_available_seats_non_negative",
            # Prevents available_seats going negative if two concurrent
            # transactions both read the same value and both decrement.
            # Combined with SELECT FOR UPDATE this is your last line of defense.
        ),
        CheckConstraint(
            "available_seats <= total_seats",
            name="ck_session_available_seats_le_total",
        ),
        CheckConstraint(
            "total_seats > 0",
            name="ck_session_total_seats_positive",
        ),
        Index("ix_event_sessions_event_status", "event_id", "status"),
        # Fast query: "all PUBLISHED sessions for event X"
    )

    def __repr__(self) -> str:
        return (
            f"<EventSession id={self.session_id} "
            f"name={self.session_name!r} status={self.status}>"
        )
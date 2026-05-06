"""
Seat model.

Represents a PHYSICAL seat in a venue — venue-level, not session-level.
The same physical seat (Row A, Seat 12, VIP) can appear in multiple sessions.
Session-specific state (available/booked) lives in SessionSeat, not here.

This separation is the key architectural decision:
  Seat       = "what exists in the venue"
  SessionSeat = "what is the state of that seat for THIS session"
"""

import uuid

from sqlalchemy import (
    CheckConstraint,
    Enum as SAEnum,
    ForeignKey,
    Index,
    Integer,
    String,
    text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin
from app.models.enums import SeatSection


class Seat(Base, TimestampMixin):
    __tablename__ = "seats"

    # ── Primary Key ──────────────────────────────────────────────────────────
    seat_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )

    # ── Venue Reference ───────────────────────────────────────────────────────
    # Seats belong to an event in this simplified design.
    # In a more complete system, seats belong to a Venue, and events
    # are linked to venues. For now, event-scoped seats are fine.
    event_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("events.event_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # ── Physical Location ─────────────────────────────────────────────────────
    row_name: Mapped[str] = mapped_column(
        String(10),
        nullable=False,
        # e.g., "A", "B", "GA" (General Admission)
    )
    seat_number: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        # Physical seat number within the row
    )
    section: Mapped[SeatSection] = mapped_column(
        SAEnum(SeatSection, name="seat_section_enum", create_type=True, values_callable=lambda x: [e.value for e in x]),
        nullable=False,
        index=True,
    )

    # ── Relationships ─────────────────────────────────────────────────────────
    event: Mapped["Event"] = relationship(  # noqa: F821
        "Event",
        lazy="noload",
    )
    session_seats: Mapped[list["SessionSeat"]] = relationship(  # noqa: F821
        "SessionSeat",
        back_populates="seat",
        cascade="all, delete-orphan",
        lazy="noload",
    )

    # ── Constraints & Indexes ─────────────────────────────────────────────────
    __table_args__ = (
        UniqueConstraint(
            "event_id", "row_name", "seat_number",
            name="uq_seat_event_row_number",
            # Prevents creating duplicate physical seats for the same event.
            # Without this, you could accidentally double-create "Row A Seat 12"
            # and end up with two bookable entries for the same physical chair.
        ),
        CheckConstraint(
            "seat_number > 0",
            name="ck_seat_number_positive",
        ),
        Index("ix_seats_event_section", "event_id", "section"),
        # Fast query: "all VIP seats for event X"
    )

    def __repr__(self) -> str:
        return (
            f"<Seat id={self.seat_id} "
            f"row={self.row_name} num={self.seat_number} "
            f"section={self.section}>"
        )
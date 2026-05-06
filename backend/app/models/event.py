"""
Event model.

An Event is the top-level entity (e.g., "Coldplay World Tour 2025").
It has no time information itself — that lives on EventSession.
One Event → many EventSessions.
"""

import uuid

from sqlalchemy import ForeignKey, Index, String, Text, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class Event(Base, TimestampMixin):
    __tablename__ = "events"

    # ── Primary Key ──────────────────────────────────────────────────────────
    event_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )

    # ── Ownership ────────────────────────────────────────────────────────────
    # FK to users.user_id. Only admins should be able to create events
    # (enforced at service/API layer, not DB layer — DB layer just ensures
    #  referential integrity).
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.user_id", ondelete="RESTRICT"),
        # RESTRICT: prevent deleting a user who has created events.
        # Use SET NULL if you want "orphaned" events to persist after user deletion.
        nullable=False,
        index=True,
    )

    # ── Content ───────────────────────────────────────────────────────────────
    title: Mapped[str] = mapped_column(String(512), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    category: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        index=True,   # Enables fast filtering: "all CONCERT events"
    )
    venue_name: Mapped[str | None] = mapped_column(String(512), nullable=True)
    venue_city: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # ── Relationships ─────────────────────────────────────────────────────────
    creator: Mapped["User"] = relationship(  # noqa: F821
        "User",
        back_populates="events",
        lazy="noload",
    )
    sessions: Mapped[list["EventSession"]] = relationship(  # noqa: F821
        "EventSession",
        back_populates="event",
        cascade="all, delete-orphan",
        lazy="noload",
    )

    # ── Composite Indexes ─────────────────────────────────────────────────────
    __table_args__ = (
        Index("ix_events_category_city", "category", "venue_city"),
        # Enables: "all concerts in Mumbai" queries efficiently.
    )

    def __repr__(self) -> str:
        return f"<Event id={self.event_id} title={self.title!r}>"
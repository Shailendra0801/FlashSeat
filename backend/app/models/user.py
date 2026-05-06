"""
User model.

Intentionally minimal for this phase — no passwords/OAuth yet.
is_admin is a simple boolean flag; a proper RBAC roles table is the
recommended upgrade path once the system grows beyond admin/user.
"""

import uuid

from sqlalchemy import Boolean, String, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class User(Base, TimestampMixin):
    __tablename__ = "users"

    # ── Primary Key ──────────────────────────────────────────────────────────
    # UUID v4 as PK prevents enumeration attacks (vs sequential int IDs)
    # and works safely across distributed inserts without a sequence clash.
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),  # PostgreSQL 13+ built-in
    )

    # ── Identity ─────────────────────────────────────────────────────────────
    email: Mapped[str] = mapped_column(
        String(255),
        unique=True,           # DB-level uniqueness; uniqueness check alone is
        nullable=False,        # NOT enough under concurrent inserts — the unique
        index=True,            # constraint is what enforces it atomically.
    )
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    
    hashed_password: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        server_default="",  # temporary default; always set explicitly
    )

    # ── Authorization ─────────────────────────────────────────────────────────
    is_admin: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
        server_default="false",
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
        server_default="true",
    )

    # ── Relationships ─────────────────────────────────────────────────────────
    # `lazy="noload"` is the safest default for async SQLAlchemy:
    # it prevents accidental implicit I/O. Load explicitly via selectinload().
    events: Mapped[list["Event"]] = relationship(  # noqa: F821
        "Event",
        back_populates="creator",
        lazy="noload",
    )
    orders: Mapped[list["Order"]] = relationship(  # noqa: F821
        "Order",
        back_populates="user",
        lazy="noload",
    )
    session_seats_booked: Mapped[list["SessionSeat"]] = relationship(  # noqa: F821
        "SessionSeat",
        back_populates="booked_by_user",
        lazy="noload",
    )

    def __repr__(self) -> str:
        return f"<User id={self.user_id} email={self.email}>"
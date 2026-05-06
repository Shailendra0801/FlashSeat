"""
Shared declarative base and reusable timestamp mixin.

Using SQLAlchemy 2.0 `DeclarativeBase` (not the legacy `declarative_base()`).
The TimestampMixin is inherited by every model that needs audit columns,
keeping the code DRY and the schema consistent.
"""

from datetime import datetime, timezone

from sqlalchemy import DateTime, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    """
    Project-wide declarative base.
    All models must inherit from this — never from `DeclarativeBase` directly —
    so that `Base.metadata` is a single registry used by create_all() and
    (eventually) Alembic's env.py.
    """
    pass


class TimestampMixin:
    """
    Adds `created_at` and `updated_at` to any model.

    - `server_default=func.now()` sets the value at the DB level, so it works
      even for bulk inserts that bypass the ORM.
    - `onupdate=func.now()` keeps `updated_at` accurate without service-layer
      boilerplate.
    - `timezone=True` stores UTC offsets; always store UTC, display locally.
    """
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
"""
Explicit re-export of all models.

This file serves two purposes:
  1. Allows `from app.models import *` to register all models with
     Base.metadata — required for create_all() and Alembic autogenerate.
  2. Provides a single import path for type checkers and IDE navigation.

Import ORDER matters here to satisfy FK resolution:
  Users and Events must be registered before tables that reference them.
"""

from app.models.base import Base, TimestampMixin
from app.models.enums import (
    OrderStatus,
    SeatSection,
    SessionSeatStatus,
    SessionStatus,
)
from app.models.user import User
from app.models.event import Event
from app.models.event_session import EventSession
from app.models.seat import Seat
from app.models.session_seat import SessionSeat
from app.models.order import Order
from app.models.order_item import OrderItem

__all__ = [
    "Base",
    "TimestampMixin",
    "OrderStatus",
    "SeatSection",
    "SessionSeatStatus",
    "SessionStatus",
    "User",
    "Event",
    "EventSession",
    "Seat",
    "SessionSeat",
    "Order",
    "OrderItem",
]
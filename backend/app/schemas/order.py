import uuid
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class CreateOrderRequest(BaseModel):
    """Checkout request.

    The endpoint receives the list of locked seat IDs that the client believes
    are currently held in Redis locks for the authenticated user.

    Important:
    - This implementation uses seat_ids (physical Seat.seat_id) and a session_id.
    - Backend will translate seat_ids -> SessionSeat rows (session_id + seat_id).
    """

    session_id: uuid.UUID = Field(..., description="Session for which seats are being purchased")
    seat_ids: List[uuid.UUID] = Field(..., min_length=1, description="List of locked physical seat IDs")


class OrderResponse(BaseModel):
    """Minimal response for POST /orders."""

    order_id: uuid.UUID
    status: str
    failure_reason: Optional[str] = None
    created_at: datetime


class CreateOrderResponse(BaseModel):
    order: OrderResponse


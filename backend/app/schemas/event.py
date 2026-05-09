"""
Pydantic schemas for Event, EventSession, Seat, and SessionSeat.
"""

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, field_validator

from app.models.enums import SeatSection, SessionStatus, SessionSeatStatus


# ── Seat Schemas ──────────────────────────────────────────────────────────────

class SeatInput(BaseModel):
    """Single seat in the venue layout provided by admin."""
    row_name: str = Field(..., min_length=1, max_length=10, example="A")
    seat_number: int = Field(..., gt=0, example=1)
    section: SeatSection = Field(..., example=SeatSection.VIP)


class SeatResponse(BaseModel):
    seat_id: uuid.UUID
    row_name: str
    seat_number: int
    section: SeatSection

    model_config = {"from_attributes": True}


# ── Session Schemas ───────────────────────────────────────────────────────────

class SessionInput(BaseModel):
    """Single session/show provided by admin during event creation."""
    session_name: str = Field(..., min_length=1, max_length=255, example="Night 1")
    start_time: datetime = Field(..., example="2025-12-01T19:00:00Z")
    doors_open_time: Optional[datetime] = Field(None, example="2025-12-01T17:00:00Z")

    @field_validator("start_time")
    @classmethod
    def start_time_must_be_future(cls, v: datetime) -> datetime:
        if v.tzinfo is not None:
            from datetime import timezone
            if v <= datetime.now(tz=timezone.utc):
                raise ValueError("start_time must be in the future")
        return v


class SessionResponse(BaseModel):
    session_id: uuid.UUID
    session_name: str
    start_time: datetime
    doors_open_time: Optional[datetime]
    total_seats: int
    available_seats: int
    status: SessionStatus

    model_config = {"from_attributes": True}


# ── Event Create Schemas ──────────────────────────────────────────────────────

class EventCreate(BaseModel):
    """
    Full event creation payload sent by admin.
    seat_layout   : Physical seats that exist in the venue.
    sessions      : One or more scheduled shows for this event.
    """
    title: str = Field(..., min_length=1, max_length=512, example="Coldplay World Tour 2025")
    description: Optional[str] = Field(None, example="A spectacular night of music")
    category: str = Field(..., min_length=1, max_length=100, example="concert")
    venue_name: Optional[str] = Field(None, example="DY Patil Stadium")
    venue_city: Optional[str] = Field(None, example="Mumbai")
    seat_layout: list[SeatInput] = Field(..., min_length=1)
    sessions: list[SessionInput] = Field(..., min_length=1)


class EventResponse(BaseModel):
    event_id: uuid.UUID
    title: str
    description: Optional[str]
    category: str
    venue_name: Optional[str]
    venue_city: Optional[str]
    created_by: uuid.UUID
    created_at: datetime
    total_seats: int
    total_sessions: int
    sessions: list[SessionResponse]

    model_config = {"from_attributes": True}


# ── Generate Seats Schemas ────────────────────────────────────────────────────

class GenerateSeatsRequest(BaseModel):
    """
    Payload for dynamically adding seats to an existing event.
    System will auto-create session_seats for ALL existing sessions.
    """
    seat_layout: list[SeatInput] = Field(
        ...,
        min_length=1,
        description="New seats to add to this event",
    )


class GenerateSeatsResponse(BaseModel):
    event_id: uuid.UUID
    seats_created: int
    session_seats_created: int
    message: str


# ── Event List Schemas ────────────────────────────────────────────────────────

class EventListItem(BaseModel):
    """Lightweight event summary for list view."""
    event_id: uuid.UUID
    title: str
    category: str
    venue_name: Optional[str]
    venue_city: Optional[str]
    created_at: datetime
    total_sessions: int

    model_config = {"from_attributes": True}


class EventListResponse(BaseModel):
    total: int
    events: list[EventListItem]


# ── Seat Map Schemas ──────────────────────────────────────────────────────────

class SeatMapItem(BaseModel):
    """
    Full seat status for a specific session.
    Returned as part of the seat map for a session.
    """
    session_seat_id: uuid.UUID
    seat_id: uuid.UUID
    row_name: str
    seat_number: int
    section: SeatSection
    status: SessionSeatStatus
    booked_by: Optional[uuid.UUID]    # None if not booked
    booked_at: Optional[datetime]     # None if not booked

    model_config = {"from_attributes": True}


class SeatMapResponse(BaseModel):
    event_id: uuid.UUID
    session_id: uuid.UUID
    session_name: str
    total_seats: int
    available_seats: int
    booked_seats: int
    seats: list[SeatMapItem]
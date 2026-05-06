"""
Central enum definitions for FlashSeat.

Using Python's native `enum.Enum` with SQLAlchemy's `Enum` type.
Keeping all enums in one file prevents circular imports and makes
state machine transitions easy to reason about across models.
"""

import enum


class SessionStatus(str, enum.Enum):
    """
    Lifecycle of an event session.

    - DRAFT     : Created by admin, not yet published
    - PUBLISHED : Visible to users, bookings allowed
    - SOLD_OUT  : available_seats hit 0 (can be set by trigger or service layer)
    - CANCELLED : Session called off; triggers refund flow (future)
    - COMPLETED : Session has passed its start_time
    """
    DRAFT = "draft"
    PUBLISHED = "published"
    SOLD_OUT = "sold_out"
    CANCELLED = "cancelled"
    COMPLETED = "completed"


class SeatSection(str, enum.Enum):
    """
    Physical/tier categorization of a seat in a venue.
    Extend this as needed per venue type.
    """
    VIP = "vip"
    PREMIUM = "premium"
    REGULAR = "regular"
    STANDING = "standing"


class SessionSeatStatus(str, enum.Enum):
    """
    Per-session state of a single seat.

    AVAILABLE  : Can be booked
    RESERVED   : Temporarily held (Redis lock active); not yet confirmed
                 This is the "soft lock" window before DB write commits.
    BOOKED     : Successfully booked; DB record committed
    BLOCKED    : Admin-disabled (broken seat, view obstruction, etc.)

    Why RESERVED exists:
        Between the moment a user "claims" a seat (Redis lock acquired)
        and the moment the DB transaction commits, no other request should
        be able to book it. If the Redis lock expires before the DB write,
        the seat reverts to AVAILABLE. The RESERVED state is optional at
        DB level but useful for debugging and monitoring.
    """
    AVAILABLE = "available"
    RESERVED = "reserved"
    BOOKED = "booked"
    BLOCKED = "blocked"


class OrderStatus(str, enum.Enum):
    """
    Lifecycle of a booking order.

    PENDING    : Order created, awaiting confirmation (lock held in Redis)
    CONFIRMED  : All seats successfully written and committed
    FAILED     : Booking failed (seat taken, DB error, lock timeout)
    CANCELLED  : User or admin cancelled a confirmed order
    """
    PENDING = "pending"
    CONFIRMED = "confirmed"
    FAILED = "failed"
    CANCELLED = "cancelled"
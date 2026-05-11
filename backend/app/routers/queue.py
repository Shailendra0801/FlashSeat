"""This module implements a queue system for managing user access to high-demand events. 
It uses Redis to track active users and manage a waiting room when the event capacity is reached. 
Users are granted access on a first-come, first-served basis, and those who cannot enter immediately 
are placed in a queue with an estimated wait time.

Queue router — manages access to the booking page under flash sale load.
"""

import uuid

from fastapi import APIRouter, Depends
from app.core.dependencies import get_current_user
from app.core.queue_manager import leave_booking_page, try_enter_booking_page
from app.core.redis import get_redis
from app.models.user import User

router = APIRouter(prefix="/events", tags=["queue"])


@router.get("/{event_id}/queue")
async def enter_event_queue(
    event_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    redis=Depends(get_redis),
):
    """
    Called when user opens the booking page.
    Either grants access or places them in the waiting room.
    """
    return await try_enter_booking_page(
        event_id=str(event_id),
        user_id=str(current_user.user_id),
        redis=redis,
    )


@router.post("/{event_id}/leave")
async def leave_event(
    event_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    redis=Depends(get_redis),
):
    """
    Called when user leaves the booking page cleanly.
    Frees up a slot and promotes the next user from the queue.
    """
    return await leave_booking_page(
        event_id=str(event_id),
        user_id=str(current_user.user_id),
        redis=redis,
    )
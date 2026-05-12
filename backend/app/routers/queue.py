"""
Queue router — manages access to the booking page under high load.
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.dependencies import get_current_user
from app.core.redis import get_redis
from app.core.queue_manager import leave_booking_page, try_enter_booking_page
from app.models.user import User

router = APIRouter(prefix="/events", tags=["queue"])


@router.get("/{event_id}/queue")
async def enter_event_queue(
    event_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    redis=Depends(get_redis),          # Now it will work
):
    try:
        return await try_enter_booking_page(
            event_id=str(event_id),
            user_id=str(current_user.user_id),
            redis=redis,
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to process queue request"
        ) from e


@router.post("/{event_id}/leave")
async def leave_event(
    event_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    redis=Depends(get_redis),
):
    try:
        return await leave_booking_page(
            event_id=str(event_id),
            user_id=str(current_user.user_id),
            redis=redis,
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to leave queue"
        ) from e
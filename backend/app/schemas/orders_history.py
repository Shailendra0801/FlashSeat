import uuid
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel


class OrderHistoryItem(BaseModel):
    order_item_id: uuid.UUID
    seat_label: str


class OrderHistoryItemResponse(BaseModel):
    order_item_id: uuid.UUID
    seat_label: str


class OrderHistoryResponse(BaseModel):
    order_id: uuid.UUID
    status: str
    created_at: datetime
    items: List[OrderHistoryItemResponse] = []


class MyOrdersResponse(BaseModel):
    orders: List[OrderHistoryResponse] = []


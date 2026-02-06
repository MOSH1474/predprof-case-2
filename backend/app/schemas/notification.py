from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class NotificationItem(BaseModel):
    id: int
    notification_id: int
    title: str
    body: str | None
    created_at: datetime
    created_by_id: int | None
    read_at: datetime | None


class NotificationListResponse(BaseModel):
    items: list[NotificationItem]
    unread_count: int

from __future__ import annotations

from datetime import datetime, timezone

import asyncio
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_db
from ..docs import error_response, roles_docs
from ..models import User, UserNotification
from ..schemas.notification import NotificationItem, NotificationListResponse
from ..services.authorization import require_user
from ..services.notification_service import (
    count_unread_notifications,
    get_user_notification,
    list_user_notifications,
    list_user_notifications_since,
    mark_all_notifications_read,
    mark_notification_read,
)

router = APIRouter(prefix="/notifications", tags=["notifications"])


def build_notification_item(user_notification: UserNotification) -> NotificationItem:
    notification = user_notification.notification
    return NotificationItem(
        id=user_notification.id,
        notification_id=notification.id,
        title=notification.title,
        body=notification.body,
        created_at=notification.created_at,
        created_by_id=notification.created_by_id,
        read_at=user_notification.read_at,
    )


@router.get(
    "",
    response_model=NotificationListResponse,
    **roles_docs(),
    summary="Список уведомлений",
)
async def list_notifications_endpoint(
    unread_only: bool = Query(default=False),
    limit: int = Query(default=30, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_user),
) -> NotificationListResponse:
    notifications = await list_user_notifications(
        db,
        user_id=current_user.id,
        unread_only=unread_only,
        limit=limit,
        offset=offset,
    )
    unread_count = await count_unread_notifications(db, current_user.id)
    return NotificationListResponse(
        items=[build_notification_item(item) for item in notifications],
        unread_count=unread_count,
    )


@router.get(
    "/long-poll",
    response_model=NotificationListResponse,
    **roles_docs(),
    summary="Долгий опрос уведомлений",
)
async def long_poll_notifications(
    since: datetime | None = Query(default=None),
    timeout: int = Query(default=25, ge=5, le=60),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_user),
) -> NotificationListResponse:
    since_value = since
    if since_value is None:
        since_value = datetime.now(timezone.utc)
    elif since_value.tzinfo is None:
        since_value = since_value.replace(tzinfo=timezone.utc)

    start = datetime.now(timezone.utc)
    while True:
        items = await list_user_notifications_since(
            db,
            user_id=current_user.id,
            since=since_value,
            limit=30,
        )
        if items:
            unread_count = await count_unread_notifications(db, current_user.id)
            return NotificationListResponse(
                items=[build_notification_item(item) for item in items],
                unread_count=unread_count,
            )

        elapsed = (datetime.now(timezone.utc) - start).total_seconds()
        if elapsed >= timeout:
            unread_count = await count_unread_notifications(db, current_user.id)
            return NotificationListResponse(items=[], unread_count=unread_count)
        await asyncio.sleep(1)


@router.post(
    "/{user_notification_id}/read",
    response_model=NotificationItem,
    **roles_docs(
        extra_responses={
            404: error_response("Уведомление не найдено", "Not found"),
        }
    ),
    summary="Отметить уведомление прочитанным",
)
async def mark_notification_read_endpoint(
    user_notification_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_user),
) -> NotificationItem:
    user_notification = await get_user_notification(user_notification_id, current_user.id, db)
    user_notification = await mark_notification_read(user_notification, db)
    return build_notification_item(user_notification)


@router.post(
    "/read-all",
    **roles_docs(),
    summary="Отметить все уведомления прочитанными",
)
async def mark_all_notifications_read_endpoint(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_user),
) -> dict[str, str]:
    await mark_all_notifications_read(db, current_user.id)
    return {"status": "ok"}

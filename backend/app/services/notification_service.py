from __future__ import annotations

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..models import Notification, User, UserNotification, UserRole
from ..models.utils import utcnow
from .errors import raise_http_404


async def list_user_notifications(
    db: AsyncSession,
    user_id: int,
    unread_only: bool = False,
    limit: int = 30,
    offset: int = 0,
) -> list[UserNotification]:
    query = (
        select(UserNotification)
        .options(selectinload(UserNotification.notification))
        .where(UserNotification.user_id == user_id)
        .join(Notification)
        .order_by(Notification.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    if unread_only:
        query = query.where(UserNotification.read_at.is_(None))
    result = await db.execute(query)
    return result.scalars().all()


async def list_user_notifications_since(
    db: AsyncSession,
    user_id: int,
    since,
    limit: int = 30,
) -> list[UserNotification]:
    result = await db.execute(
        select(UserNotification)
        .options(selectinload(UserNotification.notification))
        .where(
            UserNotification.user_id == user_id,
            Notification.created_at > since,
        )
        .join(Notification)
        .order_by(Notification.created_at.asc())
        .limit(limit)
    )
    return result.scalars().all()


async def count_unread_notifications(db: AsyncSession, user_id: int) -> int:
    result = await db.execute(
        select(func.count(UserNotification.id)).where(
            UserNotification.user_id == user_id,
            UserNotification.read_at.is_(None),
        )
    )
    return int(result.scalar_one() or 0)


async def get_user_notification(
    user_notification_id: int, user_id: int, db: AsyncSession
) -> UserNotification:
    result = await db.execute(
        select(UserNotification)
        .options(selectinload(UserNotification.notification))
        .where(
            UserNotification.id == user_notification_id,
            UserNotification.user_id == user_id,
        )
    )
    user_notification = result.scalar_one_or_none()
    if user_notification is None:
        raise_http_404("Уведомление не найдено")
    return user_notification


async def mark_notification_read(
    user_notification: UserNotification,
    db: AsyncSession,
) -> UserNotification:
    if user_notification.read_at is None:
        user_notification.read_at = utcnow()
        await db.commit()
        await db.refresh(user_notification)
    return user_notification


async def mark_all_notifications_read(db: AsyncSession, user_id: int) -> None:
    await db.execute(
        update(UserNotification)
        .where(
            UserNotification.user_id == user_id,
            UserNotification.read_at.is_(None),
        )
        .values(read_at=utcnow())
    )
    await db.commit()


async def create_notification_for_users(
    db: AsyncSession,
    title: str,
    body: str | None,
    recipient_ids: list[int],
    created_by_id: int | None = None,
) -> list[UserNotification]:
    if not recipient_ids:
        return []
    notification = Notification(
        title=title,
        body=body,
        created_by_id=created_by_id,
    )
    db.add(notification)
    await db.flush()
    recipients = [
        UserNotification(user_id=user_id, notification_id=notification.id)
        for user_id in recipient_ids
    ]
    db.add_all(recipients)
    await db.commit()
    return recipients


async def list_admin_ids(db: AsyncSession) -> list[int]:
    result = await db.execute(
        select(User.id).where(User.role == UserRole.ADMIN, User.is_active.is_(True))
    )
    return [row[0] for row in result.all()]

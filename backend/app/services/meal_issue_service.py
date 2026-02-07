from __future__ import annotations

from datetime import date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..models import MealIssue, MealIssueStatus, Menu, User, UserRole
from ..models.utils import utcnow
from .errors import raise_http_400, raise_http_404
from .notification_service import create_notification_for_users
from .payment_service import is_meal_paid


async def _get_user(user_id: int, db: AsyncSession) -> User:
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise_http_404("Пользователь не найден")
    return user


async def _get_menu(menu_id: int, db: AsyncSession) -> Menu:
    result = await db.execute(
        select(Menu).options(selectinload(Menu.menu_items)).where(Menu.id == menu_id)
    )
    menu = result.scalar_one_or_none()
    if not menu:
        raise_http_404("Меню не найдено")
    return menu


async def _get_meal_issue(user_id: int, menu_id: int, db: AsyncSession) -> MealIssue | None:
    result = await db.execute(
        select(MealIssue).where(
            MealIssue.user_id == user_id,
            MealIssue.menu_id == menu_id,
        )
    )
    return result.scalar_one_or_none()


def _consume_menu_items(menu: Menu) -> None:
    for item in menu.menu_items:
        if item.remaining_qty is None:
            continue
        if item.remaining_qty <= 0:
            raise_http_400("Недостаточно блюд в меню для выдачи")
        item.remaining_qty -= 1


async def list_meal_issues(user_id: int, db: AsyncSession) -> list[MealIssue]:
    result = await db.execute(
        select(MealIssue)
        .where(MealIssue.user_id == user_id)
        .order_by(MealIssue.created_at.desc())
    )
    return list(result.scalars().all())


async def list_served_meal_issues_since(
    user_id: int,
    since,
    db: AsyncSession,
    limit: int = 20,
) -> list[MealIssue]:
    result = await db.execute(
        select(MealIssue)
        .where(
            MealIssue.user_id == user_id,
            MealIssue.status == MealIssueStatus.SERVED,
            MealIssue.served_at.is_not(None),
            MealIssue.served_at > since,
        )
        .order_by(MealIssue.served_at.asc())
        .limit(limit)
    )
    return list(result.scalars().all())


async def issue_meal(user_id: int, menu_id: int, db: AsyncSession) -> MealIssue:
    menu = await _get_menu(menu_id, db)
    issue = await _get_meal_issue(user_id, menu_id, db)
    if issue:
        raise_http_400("Выдача уже создана")
    if not await is_meal_paid(user_id, menu, db):
        raise_http_400("Питание не оплачено")

    _consume_menu_items(menu)
    issue = MealIssue(
        user_id=user_id,
        menu_id=menu.id,
        status=MealIssueStatus.ISSUED,
    )
    db.add(issue)
    await db.commit()
    await db.refresh(issue)
    return issue


async def list_meal_issues_for_staff(
    db: AsyncSession,
    status: MealIssueStatus | None = None,
    menu_id: int | None = None,
    user_id: int | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
) -> list[MealIssue]:
    stmt = select(MealIssue).join(Menu, MealIssue.menu_id == Menu.id)
    if status is not None:
        stmt = stmt.where(MealIssue.status == status)
    if menu_id is not None:
        stmt = stmt.where(MealIssue.menu_id == menu_id)
    if user_id is not None:
        stmt = stmt.where(MealIssue.user_id == user_id)
    if date_from is not None:
        stmt = stmt.where(Menu.menu_date >= date_from)
    if date_to is not None:
        stmt = stmt.where(Menu.menu_date <= date_to)
    stmt = stmt.order_by(Menu.menu_date.desc(), MealIssue.created_at.desc(), MealIssue.id.desc())
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def confirm_meal(user_id: int, menu_id: int, db: AsyncSession) -> MealIssue:
    await _get_menu(menu_id, db)
    issue = await _get_meal_issue(user_id, menu_id, db)
    if issue:
        if issue.status == MealIssueStatus.CONFIRMED:
            raise_http_400("Питание уже подтверждено")
        if issue.status == MealIssueStatus.SERVED:
            issue.status = MealIssueStatus.CONFIRMED
            issue.confirmed_at = utcnow()
            await db.commit()
            await db.refresh(issue)
            return issue
        if issue.status == MealIssueStatus.ISSUED:
            raise_http_400("Питание ещё не выдано")
        raise_http_400("Некорректный статус выдачи")

    raise_http_400("Выдача ещё не создана")


async def serve_meal(
    user_id: int, menu_id: int, served_by_id: int, db: AsyncSession
) -> MealIssue:
    issue = await _get_meal_issue(user_id, menu_id, db)
    if issue:
        if issue.status == MealIssueStatus.CONFIRMED:
            raise_http_400("Питание уже подтверждено")
        if issue.status == MealIssueStatus.SERVED:
            raise_http_400("Питание уже выдано")
        if issue.status == MealIssueStatus.ISSUED:
            issue.status = MealIssueStatus.SERVED
            issue.served_by_id = served_by_id
            issue.served_at = utcnow()
            await db.commit()
            await db.refresh(issue)
            await create_notification_for_users(
                db,
                title="Питание выдано",
                body="Питание выдано. Подтвердите получение в личном кабинете.",
                recipient_ids=[user_id],
                created_by_id=served_by_id,
            )
            return issue
        raise_http_400("Некорректный статус выдачи")

    user = await _get_user(user_id, db)
    if user.role != UserRole.STUDENT:
        raise_http_400("Получать питание могут только ученики")
    menu = await _get_menu(menu_id, db)
    if not await is_meal_paid(user_id, menu, db):
        raise_http_400("Питание не оплачено")

    _consume_menu_items(menu)
    issue = MealIssue(
        user_id=user_id,
        menu_id=menu.id,
        status=MealIssueStatus.SERVED,
        served_by_id=served_by_id,
        served_at=utcnow(),
    )
    db.add(issue)
    await db.commit()
    await db.refresh(issue)
    await create_notification_for_users(
        db,
        title="Питание выдано",
        body="Питание выдано. Подтвердите получение в личном кабинете.",
        recipient_ids=[user_id],
        created_by_id=served_by_id,
    )
    return issue



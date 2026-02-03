from __future__ import annotations

from datetime import date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..models import MealIssue, MealIssueStatus, Menu, User, UserRole
from ..models.utils import utcnow
from .errors import raise_http_400, raise_http_404
from .payment_service import is_meal_paid


async def _get_user(user_id: int, db: AsyncSession) -> User:
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise_http_404("User not found")
    return user


async def _get_menu(menu_id: int, db: AsyncSession) -> Menu:
    result = await db.execute(
        select(Menu).options(selectinload(Menu.menu_items)).where(Menu.id == menu_id)
    )
    menu = result.scalar_one_or_none()
    if not menu:
        raise_http_404("Menu not found")
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
            raise_http_400("Not enough menu items to issue meal")
        item.remaining_qty -= 1


async def list_meal_issues(user_id: int, db: AsyncSession) -> list[MealIssue]:
    result = await db.execute(
        select(MealIssue)
        .where(MealIssue.user_id == user_id)
        .order_by(MealIssue.created_at.desc())
    )
    return list(result.scalars().all())


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
            raise_http_400("Meal already confirmed")
        if issue.status == MealIssueStatus.SERVED:
            issue.status = MealIssueStatus.CONFIRMED
            issue.confirmed_at = utcnow()
            await db.commit()
            await db.refresh(issue)
            return issue
        if issue.status == MealIssueStatus.ISSUED:
            raise_http_400("Meal not served yet")
        raise_http_400("Meal issue has invalid status")

    raise_http_400("Meal not issued yet")


async def serve_meal(
    user_id: int, menu_id: int, served_by_id: int, db: AsyncSession
) -> MealIssue:
    issue = await _get_meal_issue(user_id, menu_id, db)
    if issue:
        if issue.status == MealIssueStatus.CONFIRMED:
            raise_http_400("Meal already confirmed")
        if issue.status == MealIssueStatus.SERVED:
            raise_http_400("Meal already served")
        if issue.status == MealIssueStatus.ISSUED:
            issue.status = MealIssueStatus.SERVED
            issue.served_by_id = served_by_id
            issue.served_at = utcnow()
            await db.commit()
            await db.refresh(issue)
            return issue
        raise_http_400("Meal issue has invalid status")

    user = await _get_user(user_id, db)
    if user.role != UserRole.STUDENT:
        raise_http_400("Only students can receive meals")
    menu = await _get_menu(menu_id, db)
    if not await is_meal_paid(user_id, menu, db):
        raise_http_400("Meal is not paid")

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
    return issue



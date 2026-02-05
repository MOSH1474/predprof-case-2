from __future__ import annotations

from datetime import date
from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..models import MealIssue, MealIssueStatus, Menu, Payment, PaymentStatus, PaymentType
from ..models.utils import utcnow
from .errors import raise_http_400, raise_http_404

SUBSCRIPTION_DAILY_RATE = Decimal("250.00")


async def _get_menu(menu_id: int, db: AsyncSession) -> Menu:
    result = await db.execute(select(Menu).where(Menu.id == menu_id))
    menu = result.scalar_one_or_none()
    if not menu:
        raise_http_404("Меню не найдено")
    return menu


async def _get_menu_with_items(menu_id: int, db: AsyncSession) -> Menu:
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


async def _create_issued_meals_for_period(
    user_id: int, period_start: date, period_end: date, db: AsyncSession
) -> None:
    result = await db.execute(
        select(Menu)
        .options(selectinload(Menu.menu_items))
        .where(Menu.menu_date >= period_start, Menu.menu_date <= period_end)
        .order_by(Menu.menu_date, Menu.id)
    )
    menus = list(result.scalars().all())
    if not menus:
        return

    menu_ids = [menu.id for menu in menus]
    existing_result = await db.execute(
        select(MealIssue.menu_id).where(
            MealIssue.user_id == user_id, MealIssue.menu_id.in_(menu_ids)
        )
    )
    existing_menu_ids = {row[0] for row in existing_result.all()}

    for menu in menus:
        if menu.id in existing_menu_ids:
            continue
        try:
            _consume_menu_items(menu)
        except HTTPException as exc:
            if exc.detail == "Недостаточно блюд в меню для выдачи":
                continue
            raise
        issue = MealIssue(
            user_id=user_id,
            menu_id=menu.id,
            status=MealIssueStatus.ISSUED,
        )
        db.add(issue)


async def _has_paid_one_time(user_id: int, menu_id: int, db: AsyncSession) -> bool:
    result = await db.execute(
        select(Payment.id).where(
            Payment.user_id == user_id,
            Payment.menu_id == menu_id,
            Payment.payment_type == PaymentType.ONE_TIME,
            Payment.status == PaymentStatus.PAID,
        )
    )
    return result.scalar_one_or_none() is not None


async def _has_active_subscription_on_date(
    user_id: int, target_date: date, db: AsyncSession
) -> bool:
    result = await db.execute(
        select(Payment.id).where(
            Payment.user_id == user_id,
            Payment.payment_type == PaymentType.SUBSCRIPTION,
            Payment.status == PaymentStatus.PAID,
            Payment.period_start <= target_date,
            Payment.period_end >= target_date,
        )
    )
    return result.scalar_one_or_none() is not None


async def _has_overlapping_subscription(
    user_id: int, period_start: date, period_end: date, db: AsyncSession
) -> bool:
    result = await db.execute(
        select(Payment.id).where(
            Payment.user_id == user_id,
            Payment.payment_type == PaymentType.SUBSCRIPTION,
            Payment.status == PaymentStatus.PAID,
            Payment.period_start <= period_end,
            Payment.period_end >= period_start,
        )
    )
    return result.scalar_one_or_none() is not None


async def is_meal_paid(user_id: int, menu: Menu, db: AsyncSession) -> bool:
    result = await db.execute(
        select(Payment.id)
        .where(
            Payment.user_id == user_id,
            Payment.status == PaymentStatus.PAID,
            or_(
                and_(
                    Payment.payment_type == PaymentType.ONE_TIME,
                    Payment.menu_id == menu.id,
                ),
                and_(
                    Payment.payment_type == PaymentType.SUBSCRIPTION,
                    Payment.period_start <= menu.menu_date,
                    Payment.period_end >= menu.menu_date,
                ),
            ),
        )
        .limit(1)
    )
    return result.scalar_one_or_none() is not None


async def create_one_time_payment(
    user_id: int,
    menu_id: int,
    db: AsyncSession,
    auto_issue: bool = True,
) -> Payment:
    menu = await _get_menu_with_items(menu_id, db)
    if menu.price is None:
        raise_http_400("У меню не указана цена")
    if await _has_active_subscription_on_date(user_id, menu.menu_date, db):
        raise_http_400("Меню уже покрыто абонементом")
    if await _has_paid_one_time(user_id, menu_id, db):
        raise_http_400("Меню уже оплачено")

    if auto_issue:
        issue = await _get_meal_issue(user_id, menu.id, db)
        if issue:
            raise_http_400("Выдача уже создана")
        _consume_menu_items(menu)

    payment = Payment(
        user_id=user_id,
        menu_id=menu.id,
        amount=menu.price,
        currency="RUB",
        payment_type=PaymentType.ONE_TIME,
        status=PaymentStatus.PAID,
        paid_at=utcnow(),
    )
    db.add(payment)
    if auto_issue:
        meal_issue = MealIssue(
            user_id=user_id,
            menu_id=menu.id,
            status=MealIssueStatus.ISSUED,
        )
        db.add(meal_issue)
    await db.commit()
    await db.refresh(payment)
    return payment


async def create_subscription_payment(
    user_id: int, period_start: date, period_end: date, db: AsyncSession
) -> Payment:
    if period_end < period_start:
        raise_http_400("Дата окончания должна быть не раньше даты начала")
    if await _has_overlapping_subscription(user_id, period_start, period_end, db):
        raise_http_400("Абонемент пересекается с уже существующим")

    days = (period_end - period_start).days + 1
    amount = (SUBSCRIPTION_DAILY_RATE * days).quantize(Decimal("0.01"))

    payment = Payment(
        user_id=user_id,
        amount=amount,
        currency="RUB",
        payment_type=PaymentType.SUBSCRIPTION,
        status=PaymentStatus.PAID,
        paid_at=utcnow(),
        period_start=period_start,
        period_end=period_end,
    )
    db.add(payment)
    await _create_issued_meals_for_period(user_id, period_start, period_end, db)
    await db.commit()
    await db.refresh(payment)
    return payment


async def list_my_payments(user_id: int, db: AsyncSession) -> list[Payment]:
    result = await db.execute(
        select(Payment)
        .where(Payment.user_id == user_id)
        .order_by(Payment.created_at.desc(), Payment.id.desc())
    )
    return list(result.scalars().all())


async def get_active_subscription(
    user_id: int, target_date: date, db: AsyncSession
) -> Payment | None:
    result = await db.execute(
        select(Payment)
        .where(
            Payment.user_id == user_id,
            Payment.payment_type == PaymentType.SUBSCRIPTION,
            Payment.status == PaymentStatus.PAID,
            Payment.period_start <= target_date,
            Payment.period_end >= target_date,
        )
        .order_by(Payment.period_end.desc(), Payment.id.desc())
    )
    return result.scalars().first()

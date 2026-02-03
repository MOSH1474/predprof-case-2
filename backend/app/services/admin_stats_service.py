from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import MealIssue, Menu, Payment


async def get_payment_stats(
    db: AsyncSession,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
) -> tuple[int, Decimal, list[tuple], list[tuple]]:
    filters = []
    if date_from is not None:
        filters.append(Payment.created_at >= date_from)
    if date_to is not None:
        filters.append(Payment.created_at <= date_to)

    total_stmt = select(
        func.count(Payment.id),
        func.coalesce(func.sum(Payment.amount), 0),
    ).where(*filters)
    total_result = await db.execute(total_stmt)
    total_count, total_amount = total_result.one()

    status_stmt = (
        select(
            Payment.status,
            func.count(Payment.id),
            func.coalesce(func.sum(Payment.amount), 0),
        )
        .where(*filters)
        .group_by(Payment.status)
    )
    status_result = await db.execute(status_stmt)

    type_stmt = (
        select(
            Payment.payment_type,
            func.count(Payment.id),
            func.coalesce(func.sum(Payment.amount), 0),
        )
        .where(*filters)
        .group_by(Payment.payment_type)
    )
    type_result = await db.execute(type_stmt)

    return (
        int(total_count or 0),
        total_amount or Decimal("0"),
        list(status_result.all()),
        list(type_result.all()),
    )


async def get_attendance_stats(
    db: AsyncSession,
    date_from: date | None = None,
    date_to: date | None = None,
) -> tuple[int, list[tuple]]:
    filters = []
    if date_from is not None:
        filters.append(Menu.menu_date >= date_from)
    if date_to is not None:
        filters.append(Menu.menu_date <= date_to)

    total_stmt = (
        select(func.count(MealIssue.id))
        .join(Menu, MealIssue.menu_id == Menu.id)
        .where(*filters)
    )
    total_result = await db.execute(total_stmt)
    total_count = total_result.scalar_one()

    status_stmt = (
        select(MealIssue.status, func.count(MealIssue.id))
        .join(Menu, MealIssue.menu_id == Menu.id)
        .where(*filters)
        .group_by(MealIssue.status)
    )
    status_result = await db.execute(status_stmt)

    return int(total_count or 0), list(status_result.all())

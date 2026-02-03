from __future__ import annotations

from datetime import date
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import MealIssue, MealType, Menu, Product
from ..models import PurchaseRequest, PurchaseRequestItem, PurchaseRequestStatus


async def get_nutrition_report(
    db: AsyncSession,
    date_from: date | None = None,
    date_to: date | None = None,
    meal_type: MealType | None = None,
) -> tuple[int, list[tuple]]:
    stmt = (
        select(Menu.menu_date, Menu.meal_type, MealIssue.status, func.count(MealIssue.id))
        .join(Menu, MealIssue.menu_id == Menu.id)
    )
    if date_from is not None:
        stmt = stmt.where(Menu.menu_date >= date_from)
    if date_to is not None:
        stmt = stmt.where(Menu.menu_date <= date_to)
    if meal_type is not None:
        stmt = stmt.where(Menu.meal_type == meal_type)

    stmt = stmt.group_by(Menu.menu_date, Menu.meal_type, MealIssue.status).order_by(
        Menu.menu_date, Menu.meal_type
    )
    result = await db.execute(stmt)
    rows = list(result.all())
    total_count = sum(row[3] for row in rows)
    return total_count, rows


async def get_expense_report(
    db: AsyncSession,
    date_from: date | None = None,
    date_to: date | None = None,
    product_id: int | None = None,
) -> tuple[Decimal, Decimal, list[tuple]]:
    unit_price = func.coalesce(PurchaseRequestItem.unit_price, 0)
    amount_expr = PurchaseRequestItem.quantity * unit_price

    base_filters = [
        PurchaseRequest.status == PurchaseRequestStatus.APPROVED,
        PurchaseRequest.decided_at.is_not(None),
    ]
    if date_from is not None:
        base_filters.append(func.date(PurchaseRequest.decided_at) >= date_from)
    if date_to is not None:
        base_filters.append(func.date(PurchaseRequest.decided_at) <= date_to)
    if product_id is not None:
        base_filters.append(PurchaseRequestItem.product_id == product_id)

    total_stmt = (
        select(
            func.coalesce(func.sum(PurchaseRequestItem.quantity), 0),
            func.coalesce(func.sum(amount_expr), 0),
        )
        .select_from(PurchaseRequestItem)
        .join(PurchaseRequest, PurchaseRequestItem.purchase_request_id == PurchaseRequest.id)
        .where(*base_filters)
    )
    total_result = await db.execute(total_stmt)
    total_quantity, total_amount = total_result.one()

    stmt = (
        select(
            Product.id,
            Product.name,
            func.coalesce(func.sum(PurchaseRequestItem.quantity), 0),
            func.coalesce(func.sum(amount_expr), 0),
        )
        .select_from(Product)
        .join(PurchaseRequestItem, PurchaseRequestItem.product_id == Product.id)
        .join(PurchaseRequest, PurchaseRequestItem.purchase_request_id == PurchaseRequest.id)
        .where(*base_filters)
        .group_by(Product.id, Product.name)
        .order_by(func.coalesce(func.sum(amount_expr), 0).desc(), Product.name)
    )
    result = await db.execute(stmt)

    return (
        total_quantity or Decimal("0"),
        total_amount or Decimal("0"),
        list(result.all()),
    )

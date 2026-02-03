from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_db
from ..docs import roles_docs
from ..models import MealIssueStatus, MealType, UserRole
from ..schemas.admin_reports import (
    ExpenseReportItem,
    ExpenseReportResponse,
    NutritionReportItem,
    NutritionReportResponse,
)
from ..services.admin_reports_service import get_expense_report, get_nutrition_report
from ..services.authorization import require_roles

router = APIRouter(
    prefix="/admin/reports",
    tags=["admin-reports"],
    dependencies=[Depends(require_roles(UserRole.ADMIN))],
)


@router.get(
    "/nutrition",
    response_model=NutritionReportResponse,
    **roles_docs("admin"),
)
async def get_nutrition_report_endpoint(
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    meal_type: MealType | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
) -> NutritionReportResponse:
    total_count, rows = await get_nutrition_report(
        db, date_from=date_from, date_to=date_to, meal_type=meal_type
    )

    grouped: dict[tuple[date, MealType], dict[str, int]] = {}
    for menu_date, row_meal_type, status, count in rows:
        key = (menu_date, row_meal_type)
        if key not in grouped:
            grouped[key] = {
                MealIssueStatus.ISSUED.value: 0,
                MealIssueStatus.SERVED.value: 0,
                MealIssueStatus.CONFIRMED.value: 0,
            }
        grouped[key][status.value] = int(count)

    items = [
        NutritionReportItem(
            menu_date=menu_date,
            meal_type=row_meal_type,
            issued=counts[MealIssueStatus.ISSUED.value],
            served=counts[MealIssueStatus.SERVED.value],
            confirmed=counts[MealIssueStatus.CONFIRMED.value],
        )
        for (menu_date, row_meal_type), counts in grouped.items()
    ]
    items.sort(key=lambda item: (item.menu_date, str(item.meal_type)))

    return NutritionReportResponse(total_count=total_count, items=items)


@router.get(
    "/expenses",
    response_model=ExpenseReportResponse,
    **roles_docs("admin"),
)
async def get_expense_report_endpoint(
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    product_id: int | None = Query(default=None, gt=0),
    db: AsyncSession = Depends(get_db),
) -> ExpenseReportResponse:
    total_quantity, total_amount, rows = await get_expense_report(
        db, date_from=date_from, date_to=date_to, product_id=product_id
    )
    items = [
        ExpenseReportItem(
            product_id=row[0],
            product_name=row[1],
            total_quantity=row[2],
            total_amount=row[3],
        )
        for row in rows
    ]
    return ExpenseReportResponse(
        total_quantity=total_quantity, total_amount=total_amount, items=items
    )

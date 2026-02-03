from __future__ import annotations

from datetime import date, datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_db
from ..docs import roles_docs
from ..models import UserRole
from ..schemas.admin_stats import (
    AttendanceStatsResponse,
    AttendanceStatusStat,
    PaymentStatsResponse,
    PaymentStatusStat,
    PaymentTypeStat,
)
from ..services.admin_stats_service import get_attendance_stats, get_payment_stats
from ..services.authorization import require_roles

router = APIRouter(
    prefix="/admin/stats",
    tags=["admin-stats"],
    dependencies=[Depends(require_roles(UserRole.ADMIN))],
)


@router.get(
    "/payments",
    response_model=PaymentStatsResponse,
    **roles_docs(
        "admin",
        notes=(
            "Агрегация оплат по статусу и типу за период. "
            "Фильтрация идет по `Payment.created_at`."
        ),
    ),
    summary="Статистика оплат",
)
async def get_payment_stats_endpoint(
    date_from: datetime | None = Query(default=None),
    date_to: datetime | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
) -> PaymentStatsResponse:
    total_count, total_amount, status_rows, type_rows = await get_payment_stats(
        db, date_from=date_from, date_to=date_to
    )
    return PaymentStatsResponse(
        total_count=total_count,
        total_amount=total_amount,
        by_status=[
            PaymentStatusStat(status=row[0], count=row[1], amount=row[2])
            for row in status_rows
        ],
        by_type=[
            PaymentTypeStat(payment_type=row[0], count=row[1], amount=row[2])
            for row in type_rows
        ],
    )


@router.get(
    "/attendance",
    response_model=AttendanceStatsResponse,
    **roles_docs(
        "admin",
        notes=(
            "Посещаемость по статусам выдачи питания. "
            "Фильтрация идет по `Menu.menu_date`."
        ),
    ),
    summary="Статистика посещаемости",
)
async def get_attendance_stats_endpoint(
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
) -> AttendanceStatsResponse:
    total_count, status_rows = await get_attendance_stats(
        db, date_from=date_from, date_to=date_to
    )
    return AttendanceStatsResponse(
        total_count=total_count,
        by_status=[AttendanceStatusStat(status=row[0], count=row[1]) for row in status_rows],
    )

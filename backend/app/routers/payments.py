from __future__ import annotations

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_db
from ..docs import error_response, roles_docs
from ..models import User, UserRole
from ..schemas.payment import (
    PaymentCreateOneTime,
    PaymentCreateSubscription,
    PaymentListResponse,
    PaymentPublic,
)
from ..services.authorization import require_roles
from ..services.errors import raise_http_404
from ..services.payment_service import (
    create_one_time_payment,
    create_subscription_payment,
    get_active_subscription,
    list_my_payments,
)
from ..models.utils import utcnow

router = APIRouter(prefix="/payments", tags=["payments"])


@router.get(
    "/me",
    response_model=PaymentListResponse,
    **roles_docs("student", "admin", notes="Список оплат текущего пользователя."),
    summary="Мои оплаты",
)
async def list_my_payments_endpoint(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.STUDENT, UserRole.ADMIN)),
) -> PaymentListResponse:
    payments = await list_my_payments(current_user.id, db)
    return PaymentListResponse(
        items=[PaymentPublic.model_validate(payment) for payment in payments]
    )


@router.post(
    "/one-time",
    response_model=PaymentPublic,
    status_code=status.HTTP_201_CREATED,
    **roles_docs(
        "student",
        "admin",
        notes=(
            "Создает разовый платеж за конкретное меню. "
            "Цена берется из `menu.price`. "
            "Если уже есть активный абонемент на дату меню, платеж отклоняется. "
            "Для ученика создается запись выдачи со статусом `issued` (ожидание выдачи)."
        ),
        extra_responses={
            400: error_response("Menu already paid", "Bad request"),
            404: error_response("Menu not found", "Not found"),
        },
    ),
    summary="Оплата одного меню",
)
async def create_one_time_payment_endpoint(
    payload: PaymentCreateOneTime,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.STUDENT, UserRole.ADMIN)),
) -> PaymentPublic:
    payment = await create_one_time_payment(
        current_user.id,
        payload.menu_id,
        db,
        auto_issue=current_user.role == UserRole.STUDENT,
    )
    return PaymentPublic.model_validate(payment)


@router.post(
    "/subscription",
    response_model=PaymentPublic,
    status_code=status.HTTP_201_CREATED,
    **roles_docs(
        "student",
        "admin",
        notes=(
            "Создает абонемент на период. "
            "Периоды не могут пересекаться с уже оплаченными абонементами. "
            "Для существующих меню в периоде создаются выдачи со статусом `issued`."
        ),
        extra_responses={
            400: error_response("Subscription overlaps existing subscription", "Bad request")
        },
    ),
    summary="Оплата абонемента",
)
async def create_subscription_payment_endpoint(
    payload: PaymentCreateSubscription,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.STUDENT, UserRole.ADMIN)),
) -> PaymentPublic:
    payment = await create_subscription_payment(
        current_user.id, payload.period_start, payload.period_end, db
    )
    return PaymentPublic.model_validate(payment)


@router.get(
    "/me/active-subscription",
    response_model=PaymentPublic,
    **roles_docs(
        "student",
        "admin",
        notes="Возвращает активный абонемент на текущую дату.",
        extra_responses={404: error_response("Active subscription not found", "Not found")},
    ),
    summary="Активный абонемент",
)
async def get_active_subscription_endpoint(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.STUDENT, UserRole.ADMIN)),
) -> PaymentPublic:
    today = utcnow().date()
    payment = await get_active_subscription(current_user.id, today, db)
    if not payment:
        raise_http_404("Active subscription not found")
    return PaymentPublic.model_validate(payment)

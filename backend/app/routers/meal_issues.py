from __future__ import annotations

from datetime import date, datetime, timezone

import asyncio

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_db
from ..docs import error_response, roles_docs
from ..models import MealIssueStatus, User, UserRole
from ..schemas.meal_issue import (
    MealIssueCreate,
    MealIssueListResponse,
    MealIssuePublic,
    MealIssueServeRequest,
)
from ..services.authorization import require_roles
from ..services.meal_issue_service import (
    confirm_meal,
    issue_meal,
    list_meal_issues,
    list_meal_issues_for_staff,
    list_served_meal_issues_since,
    serve_meal,
)

router = APIRouter(prefix="/meal-issues", tags=["meal-issues"])


@router.get(
    "/me",
    response_model=MealIssueListResponse,
    **roles_docs("student", "admin"),
    summary="Мои выдачи питания",
)
async def list_my_meal_issues(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.STUDENT)),
) -> MealIssueListResponse:
    issues = await list_meal_issues(current_user.id, db)
    return MealIssueListResponse(
        items=[MealIssuePublic.model_validate(item) for item in issues]
    )


@router.get(
    "/me/long-poll",
    response_model=MealIssueListResponse,
    **roles_docs("student", "admin"),
    summary="Долгий опрос выдач питания",
)
async def long_poll_my_meal_issues(
    since: datetime | None = Query(default=None),
    timeout: int = Query(default=25, ge=5, le=60),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.STUDENT)),
) -> MealIssueListResponse:
    since_value = since
    if since_value is None:
        since_value = datetime.now(timezone.utc)
    elif since_value.tzinfo is None:
        since_value = since_value.replace(tzinfo=timezone.utc)

    start = datetime.now(timezone.utc)
    while True:
        issues = await list_served_meal_issues_since(current_user.id, since_value, db)
        if issues:
            return MealIssueListResponse(
                items=[MealIssuePublic.model_validate(item) for item in issues]
            )

        elapsed = (datetime.now(timezone.utc) - start).total_seconds()
        if elapsed >= timeout:
            return MealIssueListResponse(items=[])
        await asyncio.sleep(1)


@router.get(
    "/",
    response_model=MealIssueListResponse,
    **roles_docs(
        "cook",
        "admin",
        notes="Список выдач питания с фильтрами для кухни и администратора.",
    ),
    summary="Выдачи питания (для кухни)",
)
async def list_meal_issues_for_staff_endpoint(
    status: MealIssueStatus | None = Query(default=None),
    menu_id: int | None = Query(default=None, gt=0),
    user_id: int | None = Query(default=None, gt=0),
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_roles(UserRole.COOK, UserRole.ADMIN)),
) -> MealIssueListResponse:
    issues = await list_meal_issues_for_staff(
        db,
        status=status,
        menu_id=menu_id,
        user_id=user_id,
        date_from=date_from,
        date_to=date_to,
    )
    return MealIssueListResponse(
        items=[MealIssuePublic.model_validate(item) for item in issues]
    )


@router.post(
    "/me/issue",
    response_model=MealIssuePublic,
    status_code=status.HTTP_201_CREATED,
    **roles_docs(
        "student",
        notes=(
            "РЎРѕР·РґР°РµС‚ РІС‹РґР°С‡Сѓ СЃРѕ СЃС‚Р°С‚СѓСЃРѕРј `issued`, РµСЃР»Рё РјРµРЅСЋ СѓР¶Рµ РѕРїР»Р°С‡РµРЅРѕ "
            "(СЂР°Р·РѕРІРѕ РёР»Рё Р°Р±РѕРЅРµРјРµРЅС‚РѕРј)."
        ),
        extra_responses={
            400: error_response("Выдача уже создана", "Bad request"),
            404: error_response("Меню не найдено", "Not found"),
        },
    ),
    summary="РћР¶РёРґР°РЅРёРµ РІС‹РґР°С‡Рё РїРёС‚Р°РЅРёСЏ",
)
async def issue_my_meal(
    payload: MealIssueCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.STUDENT)),
) -> MealIssuePublic:
    issue = await issue_meal(current_user.id, payload.menu_id, db)
    return MealIssuePublic.model_validate(issue)


@router.post(
    "/me",
    response_model=MealIssuePublic,
    **roles_docs(
        "student",
        "admin",
        notes=(
            "Подтверждает получение питания учеником. "
            "Подтверждение возможно только после статуса `served`."
        ),
        extra_responses={
            400: error_response("Питание ещё не выдано", "Bad request"),
            404: error_response("Меню не найдено", "Not found"),
        },
    ),
    summary="Подтвердить получение питания",
)
async def confirm_my_meal(
    payload: MealIssueCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.STUDENT)),
) -> MealIssuePublic:
    issue = await confirm_meal(current_user.id, payload.menu_id, db)
    return MealIssuePublic.model_validate(issue)


@router.post(
    "/serve",
    response_model=MealIssuePublic,
    status_code=status.HTTP_201_CREATED,
    **roles_docs(
        "cook",
        "admin",
        notes=(
            "Отмечает, что питание выдано. "
            "Если выдача еще не создана (например, по абонементу), она будет создана автоматически."
        ),
        extra_responses={
            400: error_response("Питание уже выдано", "Bad request"),
            404: error_response("Пользователь не найден", "Not found"),
        },
    ),
    summary="Выдать питание",
)
async def serve_meal_to_student(
    payload: MealIssueServeRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.COOK)),
) -> MealIssuePublic:
    issue = await serve_meal(payload.user_id, payload.menu_id, current_user.id, db)
    return MealIssuePublic.model_validate(issue)

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_db
from ..docs import error_response, roles_docs
from ..models import User, UserRole
from ..schemas.preferences import PreferencesResponse, PreferencesUpdateRequest
from ..services.authorization import require_roles, require_user
from ..services.preferences_service import (
    get_preferences as service_get_preferences,
    update_preferences as service_update_preferences,
)

router = APIRouter(
    prefix="/preferences",
    tags=["preferences"],
    dependencies=[Depends(require_roles(UserRole.STUDENT, UserRole.ADMIN))],
)


@router.get(
    "/me",
    response_model=PreferencesResponse,
    **roles_docs("student", "admin", notes="Профиль предпочтений и аллергенов ученика."),
    summary="Мои предпочтения",
)
async def get_preferences(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_user),
) -> PreferencesResponse:
    return await service_get_preferences(current_user.id, db)


@router.put(
    "/me",
    response_model=PreferencesResponse,
    **roles_docs(
        "student",
        "admin",
        notes="Обновляет предпочтения питания и список аллергенов.",
        extra_responses={
            400: error_response("Allergies not found: [1]", "Bad request"),
        },
    ),
    summary="Обновить предпочтения",
)
async def update_preferences(
    payload: PreferencesUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_user),
) -> PreferencesResponse:
    return await service_update_preferences(current_user.id, payload, db)

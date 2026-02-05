from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_db
from ..docs import error_response, roles_docs
from ..models import User, UserRole
from ..schemas.auth import UserPublic
from ..services.authorization import require_roles
from ..services.errors import raise_http_404

router = APIRouter(prefix="/users", tags=["users"])


@router.get(
    "/{user_id}",
    response_model=UserPublic,
    **roles_docs(
        "cook",
        "admin",
        notes="Возвращает данные пользователя по идентификатору.",
        extra_responses={404: error_response("Пользователь не найден", "Not found")},
    ),
    summary="Пользователь по id",
)
async def get_user_endpoint(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_roles(UserRole.COOK, UserRole.ADMIN)),
) -> UserPublic:
    user = await db.get(User, user_id)
    if not user:
        raise_http_404("Пользователь не найден")
    return UserPublic.model_validate(user)

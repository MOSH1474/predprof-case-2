from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_db
from ..docs import error_response, roles_docs
from ..models import User, UserRole
from ..schemas.review import ReviewCreate, ReviewListResponse, ReviewPublic
from ..services.authorization import require_roles
from ..services.review_service import create_review, list_reviews

router = APIRouter(
    prefix="/reviews",
    tags=["reviews"],
    dependencies=[Depends(require_roles(UserRole.STUDENT, UserRole.COOK, UserRole.ADMIN))],
)


@router.get(
    "/",
    response_model=ReviewListResponse,
    **roles_docs("student", "cook", "admin", notes="Отзывы можно фильтровать по блюду, меню и пользователю."),
    summary="Список отзывов",
)
async def list_reviews_endpoint(
    dish_id: int | None = Query(default=None, gt=0),
    menu_id: int | None = Query(default=None, gt=0),
    user_id: int | None = Query(default=None, gt=0),
    date_from: datetime | None = Query(default=None),
    date_to: datetime | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
) -> ReviewListResponse:
    reviews = await list_reviews(
        db, dish_id=dish_id, menu_id=menu_id, user_id=user_id, date_from=date_from, date_to=date_to
    )
    return ReviewListResponse(items=[ReviewPublic.model_validate(item) for item in reviews])


@router.post(
    "/",
    response_model=ReviewPublic,
    status_code=status.HTTP_201_CREATED,
    **roles_docs(
        "student",
        "admin",
        notes=(
            "Создает отзыв на блюдо. "
            "Если указан `menu_id`, блюдо должно входить в это меню."
        ),
        extra_responses={
            400: error_response("Блюдо не найдено в меню", "Bad request"),
            404: error_response("Блюдо не найдено", "Not found"),
        },
    ),
    summary="Создать отзыв",
)
async def create_review_endpoint(
    payload: ReviewCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.STUDENT)),
) -> ReviewPublic:
    review = await create_review(payload, current_user.id, db)
    return ReviewPublic.model_validate(review)

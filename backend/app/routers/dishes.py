from __future__ import annotations

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_db
from ..docs import error_response, roles_docs
from ..models import UserRole
from ..schemas.dish import DishCreate, DishListResponse, DishPublic, DishUpdate
from ..services.authorization import require_roles
from ..services.dish_service import (
    create_dish,
    delete_dish,
    get_dish,
    list_dishes,
    update_dish,
)

router = APIRouter(
    prefix="/dishes",
    tags=["dishes"],
    dependencies=[Depends(require_roles(UserRole.STUDENT, UserRole.COOK, UserRole.ADMIN))],
)


@router.get(
    "/",
    response_model=DishListResponse,
    **roles_docs("student", "cook", "admin", notes="Список блюд, можно фильтровать по активности."),
    summary="Список блюд",
)
async def list_dishes_endpoint(
    is_active: bool | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
) -> DishListResponse:
    dishes = await list_dishes(db, is_active=is_active)
    return DishListResponse(items=[DishPublic.model_validate(item) for item in dishes])


@router.get(
    "/{dish_id}",
    response_model=DishPublic,
    **roles_docs(
        "student",
        "cook",
        "admin",
        notes="Возвращает блюдо по идентификатору.",
        extra_responses={404: error_response("Блюдо не найдено", "Not found")},
    ),
    summary="Блюдо по id",
)
async def get_dish_endpoint(dish_id: int, db: AsyncSession = Depends(get_db)) -> DishPublic:
    dish = await get_dish(dish_id, db)
    return DishPublic.model_validate(dish)


@router.post(
    "/",
    response_model=DishPublic,
    status_code=status.HTTP_201_CREATED,
    **roles_docs(
        "cook",
        "admin",
        notes="Создает блюдо и связывает с аллергенами при необходимости.",
        extra_responses={400: error_response("Блюдо уже существует", "Bad request")},
    ),
    summary="Создать блюдо",
)
async def create_dish_endpoint(
    payload: DishCreate,
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_roles(UserRole.COOK, UserRole.ADMIN)),
) -> DishPublic:
    dish = await create_dish(payload, db)
    return DishPublic.model_validate(dish)


@router.put(
    "/{dish_id}",
    response_model=DishPublic,
    **roles_docs(
        "cook",
        "admin",
        notes="Обновляет данные блюда и список аллергенов.",
        extra_responses={
            400: error_response("Блюдо уже существует", "Bad request"),
            404: error_response("Блюдо не найдено", "Not found"),
        },
    ),
    summary="Обновить блюдо",
)
async def update_dish_endpoint(
    dish_id: int,
    payload: DishUpdate,
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_roles(UserRole.COOK, UserRole.ADMIN)),
) -> DishPublic:
    dish = await get_dish(dish_id, db)
    dish = await update_dish(dish, payload, db)
    return DishPublic.model_validate(dish)


@router.delete(
    "/{dish_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    **roles_docs(
        "cook",
        "admin",
        notes="Удаляет блюдо по идентификатору.",
        extra_responses={404: error_response("Блюдо не найдено", "Not found")},
    ),
    summary="Удалить блюдо",
)
async def delete_dish_endpoint(
    dish_id: int,
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_roles(UserRole.COOK, UserRole.ADMIN)),
) -> None:
    dish = await get_dish(dish_id, db)
    await delete_dish(dish, db)

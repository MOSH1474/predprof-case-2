from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_db
from ..docs import error_response, roles_docs
from ..models import MealType, UserRole
from ..schemas.menu import MenuCreate, MenuListResponse, MenuPublic, MenuUpdate
from ..services.authorization import require_roles
from ..services.menu_service import (
    create_menu,
    delete_menu,
    get_menu,
    list_menus,
    update_menu,
)

router = APIRouter(
    prefix="/menus",
    tags=["menus"],
    dependencies=[Depends(require_roles(UserRole.STUDENT, UserRole.COOK, UserRole.ADMIN))],
)


@router.get(
    "/",
    response_model=MenuListResponse,
    **roles_docs(
        "student",
        "cook",
        "admin",
        notes="Список меню с фильтрами по датам и типу приема пищи.",
    ),
    summary="Список меню",
)
async def list_menus_endpoint(
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    meal_type: MealType | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
) -> MenuListResponse:
    menus = await list_menus(db, date_from=date_from, date_to=date_to, meal_type=meal_type)
    return MenuListResponse(items=[MenuPublic.model_validate(menu) for menu in menus])


@router.get(
    "/{menu_id}",
    response_model=MenuPublic,
    **roles_docs(
        "student",
        "cook",
        "admin",
        notes="Возвращает меню по идентификатору.",
        extra_responses={404: error_response("Menu not found", "Not found")},
    ),
    summary="Меню по id",
)
async def get_menu_endpoint(menu_id: int, db: AsyncSession = Depends(get_db)) -> MenuPublic:
    menu = await get_menu(menu_id, db)
    return MenuPublic.model_validate(menu)


@router.post(
    "/",
    response_model=MenuPublic,
    status_code=status.HTTP_201_CREATED,
    **roles_docs(
        "cook",
        "admin",
        notes="Меню уникально по комбинации `menu_date + meal_type`.",
        extra_responses={
            400: error_response(
                "Menu for this date and meal type already exists", "Bad request"
            ),
        },
    ),
    summary="Создать меню",
)
async def create_menu_endpoint(
    payload: MenuCreate,
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_roles(UserRole.COOK, UserRole.ADMIN)),
) -> MenuPublic:
    menu = await create_menu(payload, db)
    return MenuPublic.model_validate(menu)


@router.put(
    "/{menu_id}",
    response_model=MenuPublic,
    **roles_docs(
        "cook",
        "admin",
        notes="Обновляет основную информацию и позиции меню.",
        extra_responses={
            400: error_response(
                "Menu for this date and meal type already exists", "Bad request"
            ),
            404: error_response("Menu not found", "Not found"),
        },
    ),
    summary="Обновить меню",
)
async def update_menu_endpoint(
    menu_id: int,
    payload: MenuUpdate,
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_roles(UserRole.COOK, UserRole.ADMIN)),
) -> MenuPublic:
    menu = await get_menu(menu_id, db)
    menu = await update_menu(menu, payload, db)
    return MenuPublic.model_validate(menu)


@router.delete(
    "/{menu_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    **roles_docs(
        "cook",
        "admin",
        notes="Удаляет меню по идентификатору.",
        extra_responses={404: error_response("Menu not found", "Not found")},
    ),
    summary="Удалить меню",
)
async def delete_menu_endpoint(
    menu_id: int,
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_roles(UserRole.COOK, UserRole.ADMIN)),
) -> None:
    menu = await get_menu(menu_id, db)
    await delete_menu(menu, db)

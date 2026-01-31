from __future__ import annotations

from datetime import date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..models import Dish, MealType, Menu, MenuItem
from ..schemas.menu import MenuCreate, MenuItemCreate, MenuUpdate
from .errors import raise_http_400, raise_http_404


def _normalize_optional_text(value: str | None) -> str | None:
    if value is None:
        return None
    trimmed = value.strip()
    return trimmed if trimmed else None


async def _ensure_unique_menu(
    menu_date: date, meal_type: MealType, db: AsyncSession, menu_id: int | None = None
) -> None:
    stmt = select(Menu).where(Menu.menu_date == menu_date, Menu.meal_type == meal_type)
    if menu_id is not None:
        stmt = stmt.where(Menu.id != menu_id)
    result = await db.execute(stmt)
    if result.scalar_one_or_none():
        raise_http_400("Menu for this date and meal type already exists")


async def _resolve_dishes(
    items: list[MenuItemCreate], db: AsyncSession
) -> dict[int, Dish]:
    dish_ids = [item.dish_id for item in items]
    if not dish_ids:
        return {}
    result = await db.execute(select(Dish).where(Dish.id.in_(dish_ids)))
    dishes = list(result.scalars().all())
    found_ids = {dish.id for dish in dishes}
    missing_ids = sorted(set(dish_ids) - found_ids)
    if missing_ids:
        raise_http_400(f"Dishes not found: {missing_ids}")
    return {dish.id: dish for dish in dishes}


def _build_menu_items(items: list[MenuItemCreate]) -> list[MenuItem]:
    return [
        MenuItem(
            dish_id=item.dish_id,
            portion_size=item.portion_size,
            planned_qty=item.planned_qty,
            remaining_qty=item.remaining_qty,
        )
        for item in items
    ]


def _menu_query_with_items():
    return select(Menu).options(
        selectinload(Menu.menu_items)
        .selectinload(MenuItem.dish)
        .selectinload(Dish.allergies)
    )


async def list_menus(
    db: AsyncSession,
    date_from: date | None = None,
    date_to: date | None = None,
    meal_type: MealType | None = None,
) -> list[Menu]:
    stmt = _menu_query_with_items()
    if date_from:
        stmt = stmt.where(Menu.menu_date >= date_from)
    if date_to:
        stmt = stmt.where(Menu.menu_date <= date_to)
    if meal_type is not None:
        stmt = stmt.where(Menu.meal_type == meal_type)
    stmt = stmt.order_by(Menu.menu_date, Menu.meal_type, Menu.id)
    result = await db.execute(stmt)
    return list(result.scalars().unique().all())


async def get_menu(menu_id: int, db: AsyncSession) -> Menu:
    stmt = _menu_query_with_items().where(Menu.id == menu_id)
    result = await db.execute(stmt)
    menu = result.scalar_one_or_none()
    if not menu:
        raise_http_404("Menu not found")
    return menu


async def create_menu(payload: MenuCreate, db: AsyncSession) -> Menu:
    meal_type = payload.meal_type
    title = _normalize_optional_text(payload.title)
    await _ensure_unique_menu(payload.menu_date, meal_type, db)

    menu = Menu(
        menu_date=payload.menu_date,
        meal_type=meal_type,
        title=title,
        price=payload.price,
    )

    if payload.items:
        await _resolve_dishes(payload.items, db)
        menu.menu_items = _build_menu_items(payload.items)

    db.add(menu)
    await db.commit()
    return await get_menu(menu.id, db)


async def update_menu(menu: Menu, payload: MenuUpdate, db: AsyncSession) -> Menu:
    if "meal_type" in payload.model_fields_set:
        if payload.meal_type is None:
            raise_http_400("Meal type cannot be empty")
        menu.meal_type = payload.meal_type

    if "menu_date" in payload.model_fields_set:
        if payload.menu_date is None:
            raise_http_400("Menu date cannot be empty")
        menu.menu_date = payload.menu_date

    if "title" in payload.model_fields_set:
        menu.title = _normalize_optional_text(payload.title)

    if "price" in payload.model_fields_set:
        menu.price = payload.price

    if "items" in payload.model_fields_set:
        items = payload.items or []
        await _resolve_dishes(items, db)
        menu.menu_items = _build_menu_items(items)

    await _ensure_unique_menu(menu.menu_date, menu.meal_type, db, menu_id=menu.id)
    await db.commit()
    return await get_menu(menu.id, db)


async def delete_menu(menu: Menu, db: AsyncSession) -> None:
    await db.delete(menu)
    await db.commit()

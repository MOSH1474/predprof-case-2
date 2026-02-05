from __future__ import annotations

from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import Dish, Menu, MenuItem, Review
from ..schemas.review import ReviewCreate
from .errors import raise_http_400, raise_http_404


def _normalize_optional_text(value: str | None) -> str | None:
    if value is None:
        return None
    trimmed = value.strip()
    return trimmed if trimmed else None


async def _get_dish(dish_id: int, db: AsyncSession) -> Dish:
    result = await db.execute(select(Dish).where(Dish.id == dish_id))
    dish = result.scalar_one_or_none()
    if not dish:
        raise_http_404("Блюдо не найдено")
    if not dish.is_active:
        raise_http_400("Блюдо неактивно")
    return dish


async def _get_menu(menu_id: int, db: AsyncSession) -> Menu:
    result = await db.execute(select(Menu).where(Menu.id == menu_id))
    menu = result.scalar_one_or_none()
    if not menu:
        raise_http_404("Меню не найдено")
    return menu


async def _ensure_menu_contains_dish(menu_id: int, dish_id: int, db: AsyncSession) -> None:
    result = await db.execute(
        select(MenuItem.id).where(
            MenuItem.menu_id == menu_id,
            MenuItem.dish_id == dish_id,
        )
    )
    if result.scalar_one_or_none() is None:
        raise_http_400("Блюдо не найдено в меню")


async def list_reviews(
    db: AsyncSession,
    dish_id: int | None = None,
    menu_id: int | None = None,
    user_id: int | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
) -> list[Review]:
    stmt = select(Review)
    if dish_id is not None:
        stmt = stmt.where(Review.dish_id == dish_id)
    if menu_id is not None:
        stmt = stmt.where(Review.menu_id == menu_id)
    if user_id is not None:
        stmt = stmt.where(Review.user_id == user_id)
    if date_from is not None:
        stmt = stmt.where(Review.created_at >= date_from)
    if date_to is not None:
        stmt = stmt.where(Review.created_at <= date_to)
    stmt = stmt.order_by(Review.created_at.desc(), Review.id.desc())
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def create_review(
    payload: ReviewCreate,
    user_id: int,
    db: AsyncSession,
) -> Review:
    await _get_dish(payload.dish_id, db)
    if payload.menu_id is not None:
        await _get_menu(payload.menu_id, db)
        await _ensure_menu_contains_dish(payload.menu_id, payload.dish_id, db)

    review = Review(
        user_id=user_id,
        dish_id=payload.dish_id,
        menu_id=payload.menu_id,
        rating=payload.rating,
        comment=_normalize_optional_text(payload.comment),
    )
    db.add(review)
    await db.commit()
    await db.refresh(review)
    return review

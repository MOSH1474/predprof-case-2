from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..models import Allergy, Dish
from ..schemas.dish import DishCreate, DishUpdate
from .errors import raise_http_400, raise_http_404


def _normalize_optional_text(value: str | None) -> str | None:
    if value is None:
        return None
    trimmed = value.strip()
    return trimmed if trimmed else None


def _normalize_required_text(value: str, label: str) -> str:
    trimmed = value.strip()
    if not trimmed:
        raise_http_400(f"{label} не может быть пустым")
    return trimmed


async def _resolve_allergies(allergy_ids: list[int], db: AsyncSession) -> list[Allergy]:
    if not allergy_ids:
        return []
    result = await db.execute(select(Allergy).where(Allergy.id.in_(allergy_ids)))
    allergies = list(result.scalars().all())
    found_ids = {item.id for item in allergies}
    missing_ids = sorted(set(allergy_ids) - found_ids)
    if missing_ids:
        raise_http_400(f"Аллергены не найдены: {missing_ids}")
    return allergies


def _dish_query_with_allergies():
    return select(Dish).options(selectinload(Dish.allergies))


async def list_dishes(db: AsyncSession, is_active: bool | None = None) -> list[Dish]:
    stmt = _dish_query_with_allergies().order_by(Dish.name)
    if is_active is not None:
        stmt = stmt.where(Dish.is_active == is_active)
    result = await db.execute(stmt)
    return list(result.scalars().unique().all())


async def get_dish(dish_id: int, db: AsyncSession) -> Dish:
    stmt = _dish_query_with_allergies().where(Dish.id == dish_id)
    result = await db.execute(stmt)
    dish = result.scalar_one_or_none()
    if not dish:
        raise_http_404("Блюдо не найдено")
    return dish


async def create_dish(payload: DishCreate, db: AsyncSession) -> Dish:
    name = _normalize_required_text(payload.name, "Название блюда")
    result = await db.execute(select(Dish).where(Dish.name == name))
    if result.scalar_one_or_none():
        raise_http_400("Блюдо уже существует")

    dish = Dish(
        name=name,
        description=_normalize_optional_text(payload.description),
        is_active=payload.is_active,
    )
    if payload.allergy_ids is not None:
        dish.allergies = await _resolve_allergies(payload.allergy_ids, db)

    db.add(dish)
    await db.commit()
    return await get_dish(dish.id, db)


async def update_dish(dish: Dish, payload: DishUpdate, db: AsyncSession) -> Dish:
    if "name" in payload.model_fields_set:
        name = _normalize_required_text(payload.name or "", "Название блюда")
        if name != dish.name:
            result = await db.execute(select(Dish).where(Dish.name == name))
            if result.scalar_one_or_none():
                raise_http_400("Блюдо уже существует")
            dish.name = name

    if "description" in payload.model_fields_set:
        dish.description = _normalize_optional_text(payload.description)

    if "is_active" in payload.model_fields_set:
        dish.is_active = bool(payload.is_active)

    if "allergy_ids" in payload.model_fields_set:
        allergy_ids = payload.allergy_ids or []
        dish.allergies = await _resolve_allergies(allergy_ids, db)

    await db.commit()
    return await get_dish(dish.id, db)


async def delete_dish(dish: Dish, db: AsyncSession) -> None:
    await db.delete(dish)
    await db.commit()

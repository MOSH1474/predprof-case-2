from __future__ import annotations

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import Allergy, dish_allergies, user_allergies
from ..schemas.allergy import AllergyCreate, AllergyUpdate
from .errors import raise_http_400, raise_http_404


async def list_allergies(db: AsyncSession) -> list[Allergy]:
    result = await db.execute(select(Allergy).order_by(Allergy.name))
    return list(result.scalars().all())


async def get_allergy(allergy_id: int, db: AsyncSession) -> Allergy:
    allergy = await db.get(Allergy, allergy_id)
    if not allergy:
        raise_http_404("Allergy not found")
    return allergy


async def create_allergy(payload: AllergyCreate, db: AsyncSession) -> Allergy:
    name = payload.name.strip()
    if not name:
        raise_http_400("Allergy name cannot be empty")

    result = await db.execute(select(Allergy).where(Allergy.name == name))
    if result.scalar_one_or_none():
        raise_http_400("Allergy already exists")

    description = payload.description.strip() if payload.description else None
    allergy = Allergy(name=name, description=description)
    db.add(allergy)
    await db.commit()
    await db.refresh(allergy)
    return allergy


async def update_allergy(allergy: Allergy, payload: AllergyUpdate, db: AsyncSession) -> Allergy:
    if "name" in payload.model_fields_set:
        name = (payload.name or "").strip()
        if not name:
            raise_http_400("Allergy name cannot be empty")
        if name != allergy.name:
            result = await db.execute(select(Allergy).where(Allergy.name == name))
            if result.scalar_one_or_none():
                raise_http_400("Allergy already exists")
            allergy.name = name

    if "description" in payload.model_fields_set:
        allergy.description = payload.description.strip() if payload.description else None

    await db.commit()
    await db.refresh(allergy)
    return allergy


async def delete_allergy(allergy: Allergy, db: AsyncSession) -> None:
    await db.execute(delete(user_allergies).where(user_allergies.c.allergy_id == allergy.id))
    await db.execute(delete(dish_allergies).where(dish_allergies.c.allergy_id == allergy.id))
    await db.delete(allergy)
    await db.commit()

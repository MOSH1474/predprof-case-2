from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..models import Allergy, User
from ..schemas.allergy import AllergyPublic
from ..schemas.preferences import PreferencesResponse, PreferencesUpdateRequest
from .errors import raise_http_400


async def _load_user_with_allergies(user_id: int, db: AsyncSession) -> User:
    result = await db.execute(
        select(User).options(selectinload(User.allergies)).where(User.id == user_id)
    )
    return result.scalar_one()


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


def _normalize_preferences(value: str | None) -> str | None:
    if value is None:
        return None
    trimmed = value.strip()
    return trimmed if trimmed else None


def _build_preferences_response(user: User) -> PreferencesResponse:
    return PreferencesResponse(
        dietary_preferences=user.dietary_preferences,
        allergies=[AllergyPublic.model_validate(item) for item in user.allergies],
    )


async def get_preferences(user_id: int, db: AsyncSession) -> PreferencesResponse:
    user = await _load_user_with_allergies(user_id, db)
    return _build_preferences_response(user)


async def update_preferences(
    user_id: int,
    payload: PreferencesUpdateRequest,
    db: AsyncSession,
) -> PreferencesResponse:
    user = await _load_user_with_allergies(user_id, db)

    if "dietary_preferences" in payload.model_fields_set:
        user.dietary_preferences = _normalize_preferences(payload.dietary_preferences)

    if "allergy_ids" in payload.model_fields_set:
        allergy_ids = payload.allergy_ids or []
        user.allergies = await _resolve_allergies(allergy_ids, db)

    await db.commit()
    return _build_preferences_response(user)

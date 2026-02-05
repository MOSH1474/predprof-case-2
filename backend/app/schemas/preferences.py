from __future__ import annotations

from pydantic import BaseModel, Field, field_validator

from .allergy import AllergyPublic


class PreferencesResponse(BaseModel):
    dietary_preferences: str | None
    allergies: list[AllergyPublic]


class PreferencesUpdateRequest(BaseModel):
    dietary_preferences: str | None = Field(default=None, max_length=1000)
    allergy_ids: list[int] | None = None

    @field_validator("dietary_preferences")
    @classmethod
    def _normalize_preferences(cls, value: str | None) -> str | None:
        if value is None:
            return None
        trimmed = value.strip()
        return trimmed or None

    @field_validator("allergy_ids")
    @classmethod
    def _validate_allergy_ids(cls, value: list[int] | None) -> list[int] | None:
        if value is None:
            return value
        if any(item <= 0 for item in value):
            raise ValueError("allergy_ids должны быть положительными числами")
        if len(set(value)) != len(value):
            raise ValueError("allergy_ids должны быть уникальными")
        return value

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field, field_validator

from .allergy import AllergyPublic


class DishBase(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=1000)
    is_active: bool = True

    @field_validator("name")
    @classmethod
    def _normalize_name(cls, value: str) -> str:
        trimmed = value.strip()
        if not trimmed:
            raise ValueError("Название не может быть пустым")
        return trimmed

    @field_validator("description")
    @classmethod
    def _normalize_description(cls, value: str | None) -> str | None:
        if value is None:
            return None
        trimmed = value.strip()
        return trimmed or None


class DishCreate(DishBase):
    allergy_ids: list[int] | None = None

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


class DishUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=1000)
    is_active: bool | None = None
    allergy_ids: list[int] | None = None

    @field_validator("name")
    @classmethod
    def _normalize_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        trimmed = value.strip()
        if not trimmed:
            raise ValueError("Название не может быть пустым")
        return trimmed

    @field_validator("description")
    @classmethod
    def _normalize_description(cls, value: str | None) -> str | None:
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


class DishPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: str | None
    is_active: bool
    allergies: list[AllergyPublic]


class DishListResponse(BaseModel):
    items: list[DishPublic]

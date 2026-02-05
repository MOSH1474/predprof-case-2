from __future__ import annotations

from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ProductBase(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    unit: str = Field(min_length=1, max_length=50)
    category: str | None = Field(default=None, max_length=100)
    is_active: bool = True

    @field_validator("name")
    @classmethod
    def _normalize_name(cls, value: str) -> str:
        trimmed = value.strip()
        if not trimmed:
            raise ValueError("Название не может быть пустым")
        return trimmed

    @field_validator("unit")
    @classmethod
    def _normalize_unit(cls, value: str) -> str:
        trimmed = value.strip()
        if not trimmed:
            raise ValueError("Единица измерения не может быть пустой")
        return trimmed

    @field_validator("category")
    @classmethod
    def _normalize_category(cls, value: str | None) -> str | None:
        if value is None:
            return None
        trimmed = value.strip()
        return trimmed or None


class ProductCreate(ProductBase):
    pass


class ProductUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    unit: str | None = Field(default=None, min_length=1, max_length=50)
    category: str | None = Field(default=None, max_length=100)
    is_active: bool | None = None

    @field_validator("name")
    @classmethod
    def _normalize_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        trimmed = value.strip()
        if not trimmed:
            raise ValueError("Название не может быть пустым")
        return trimmed

    @field_validator("unit")
    @classmethod
    def _normalize_unit(cls, value: str | None) -> str | None:
        if value is None:
            return None
        trimmed = value.strip()
        if not trimmed:
            raise ValueError("Единица измерения не может быть пустой")
        return trimmed

    @field_validator("category")
    @classmethod
    def _normalize_category(cls, value: str | None) -> str | None:
        if value is None:
            return None
        trimmed = value.strip()
        return trimmed or None

class ProductPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    unit: str
    category: str | None
    is_active: bool


class ProductStockPublic(ProductPublic):
    stock: Decimal


class ProductListResponse(BaseModel):
    items: list[ProductPublic]


class ProductStockListResponse(BaseModel):
    items: list[ProductStockPublic]

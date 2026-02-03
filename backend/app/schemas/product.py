from __future__ import annotations

from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class ProductBase(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    unit: str = Field(min_length=1, max_length=50)
    category: str | None = Field(default=None, max_length=100)
    is_active: bool = True


class ProductCreate(ProductBase):
    pass


class ProductUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    unit: str | None = Field(default=None, min_length=1, max_length=50)
    category: str | None = Field(default=None, max_length=100)
    is_active: bool | None = None


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

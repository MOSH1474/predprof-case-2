from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from ..models import MealType
from .dish import DishPublic

MAX_MENU_PRICE = Decimal("99999999.99")


class MenuItemCreate(BaseModel):
    dish_id: int = Field(gt=0)
    portion_size: Decimal | None = Field(default=None, ge=0)
    planned_qty: int | None = Field(default=None, ge=0)
    remaining_qty: int | None = Field(default=None, ge=0)

    @model_validator(mode="after")
    def _validate_quantities(self) -> "MenuItemCreate":
        if (
            self.remaining_qty is not None
            and self.planned_qty is not None
            and self.remaining_qty > self.planned_qty
        ):
            raise ValueError("remaining_qty не может превышать planned_qty")
        return self


class MenuCreate(BaseModel):
    menu_date: date
    meal_type: MealType
    title: str | None = Field(default=None, max_length=255)
    price: Decimal | None = Field(default=None, ge=0)
    items: list[MenuItemCreate] = Field(min_length=1)

    @field_validator("price")
    @classmethod
    def _validate_price(cls, value: Decimal | None) -> Decimal | None:
        if value is None:
            return None
        if value > MAX_MENU_PRICE:
            raise ValueError("Цена не может превышать 99 999 999.99")
        return value

    @field_validator("title")
    @classmethod
    def _normalize_title(cls, value: str | None) -> str | None:
        if value is None:
            return None
        trimmed = value.strip()
        return trimmed or None

    @field_validator("items")
    @classmethod
    def _unique_items(cls, value: list[MenuItemCreate]) -> list[MenuItemCreate]:
        dish_ids = [item.dish_id for item in value]
        if len(set(dish_ids)) != len(dish_ids):
            raise ValueError("items должны иметь уникальные dish_id")
        return value


class MenuUpdate(BaseModel):
    menu_date: date | None = None
    meal_type: MealType | None = None
    title: str | None = Field(default=None, max_length=255)
    price: Decimal | None = Field(default=None, ge=0)
    items: list[MenuItemCreate] | None = None

    @field_validator("price")
    @classmethod
    def _validate_price(cls, value: Decimal | None) -> Decimal | None:
        if value is None:
            return None
        if value > MAX_MENU_PRICE:
            raise ValueError("Цена не может превышать 99 999 999.99")
        return value

    @field_validator("title")
    @classmethod
    def _normalize_title(cls, value: str | None) -> str | None:
        if value is None:
            return None
        trimmed = value.strip()
        return trimmed or None

    @field_validator("items")
    @classmethod
    def _unique_items(cls, value: list[MenuItemCreate] | None) -> list[MenuItemCreate] | None:
        if value is None:
            return value
        dish_ids = [item.dish_id for item in value]
        if len(set(dish_ids)) != len(dish_ids):
            raise ValueError("items должны иметь уникальные dish_id")
        return value


class MenuItemPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    dish: DishPublic
    portion_size: Decimal | None
    planned_qty: int | None
    remaining_qty: int | None


class MenuPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    menu_date: date
    meal_type: MealType
    title: str | None
    price: Decimal | None
    created_at: datetime
    menu_items: list[MenuItemPublic]


class MenuListResponse(BaseModel):
    items: list[MenuPublic]

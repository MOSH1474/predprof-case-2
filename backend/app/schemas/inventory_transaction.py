from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from ..models import InventoryDirection


class InventoryTransactionCreate(BaseModel):
    product_id: int = Field(gt=0)
    quantity: Decimal = Field(gt=0)
    direction: InventoryDirection
    reason: str | None = Field(default=None, max_length=255)

    @field_validator("reason")
    @classmethod
    def _normalize_reason(cls, value: str | None) -> str | None:
        if value is None:
            return None
        trimmed = value.strip()
        return trimmed or None


class InventoryTransactionPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    product_id: int
    quantity: Decimal
    direction: InventoryDirection
    reason: str | None
    created_by_id: int | None
    created_at: datetime


class InventoryTransactionListResponse(BaseModel):
    items: list[InventoryTransactionPublic]

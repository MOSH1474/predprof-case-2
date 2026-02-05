from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from ..models import PurchaseRequestStatus
from .product import ProductPublic


class PurchaseRequestItemCreate(BaseModel):
    product_id: int = Field(gt=0)
    quantity: Decimal = Field(gt=0)
    unit_price: Decimal | None = Field(default=None, ge=0)


class PurchaseRequestCreate(BaseModel):
    note: str | None = Field(default=None, max_length=255)
    items: list[PurchaseRequestItemCreate] = Field(min_length=1)

    @field_validator("note")
    @classmethod
    def _normalize_note(cls, value: str | None) -> str | None:
        if value is None:
            return None
        trimmed = value.strip()
        return trimmed or None

    @field_validator("items")
    @classmethod
    def _unique_items(
        cls, value: list[PurchaseRequestItemCreate]
    ) -> list[PurchaseRequestItemCreate]:
        product_ids = [item.product_id for item in value]
        if len(set(product_ids)) != len(product_ids):
            raise ValueError("items должны иметь уникальные product_id")
        return value


class PurchaseRequestDecision(BaseModel):
    status: PurchaseRequestStatus = Field(description="approved | rejected")

    @model_validator(mode="after")
    def _validate_status(self) -> "PurchaseRequestDecision":
        if self.status == PurchaseRequestStatus.PENDING:
            raise ValueError("status должен быть approved или rejected")
        return self


class PurchaseRequestItemPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    product: ProductPublic
    quantity: Decimal
    unit_price: Decimal | None


class PurchaseRequestPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    requested_by_id: int
    approved_by_id: int | None
    status: PurchaseRequestStatus = Field(description="pending | approved | rejected")
    note: str | None
    requested_at: datetime
    decided_at: datetime | None
    items: list[PurchaseRequestItemPublic]


class PurchaseRequestListResponse(BaseModel):
    items: list[PurchaseRequestPublic]

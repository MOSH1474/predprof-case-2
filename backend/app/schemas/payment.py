from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from ..models import PaymentStatus, PaymentType


class PaymentCreateOneTime(BaseModel):
    menu_id: int = Field(gt=0)


class PaymentCreateSubscription(BaseModel):
    period_start: date
    period_end: date

    @model_validator(mode="after")
    def _validate_period(self) -> "PaymentCreateSubscription":
        if self.period_end < self.period_start:
            raise ValueError("period_end должен быть не раньше period_start")
        return self


class PaymentPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    menu_id: int | None
    amount: Decimal
    currency: str
    payment_type: PaymentType = Field(
        description="one_time | subscription",
    )
    status: PaymentStatus = Field(
        description="pending | paid | failed | refunded",
    )
    paid_at: datetime | None
    period_start: date | None
    period_end: date | None
    created_at: datetime


class PaymentListResponse(BaseModel):
    items: list[PaymentPublic]

from __future__ import annotations

from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from ..models import MealIssueStatus, PaymentStatus, PaymentType


class PaymentStatusStat(BaseModel):
    status: PaymentStatus
    count: int
    amount: Decimal


class PaymentTypeStat(BaseModel):
    payment_type: PaymentType
    count: int
    amount: Decimal


class PaymentStatsResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    total_count: int
    total_amount: Decimal
    by_status: list[PaymentStatusStat]
    by_type: list[PaymentTypeStat]


class AttendanceStatusStat(BaseModel):
    status: MealIssueStatus = Field(description="issued | served | confirmed")
    count: int


class AttendanceStatsResponse(BaseModel):
    total_count: int
    by_status: list[AttendanceStatusStat]

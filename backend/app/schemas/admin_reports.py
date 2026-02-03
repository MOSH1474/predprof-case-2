from __future__ import annotations

from datetime import date
from decimal import Decimal

from pydantic import BaseModel

from ..models import MealType


class NutritionReportItem(BaseModel):
    menu_date: date
    meal_type: MealType
    issued: int
    served: int
    confirmed: int


class NutritionReportResponse(BaseModel):
    total_count: int
    items: list[NutritionReportItem]


class ExpenseReportItem(BaseModel):
    product_id: int
    product_name: str
    total_quantity: Decimal
    total_amount: Decimal


class ExpenseReportResponse(BaseModel):
    total_quantity: Decimal
    total_amount: Decimal
    items: list[ExpenseReportItem]

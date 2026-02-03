from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from ..models import MealIssueStatus


class MealIssueCreate(BaseModel):
    menu_id: int = Field(gt=0)


class MealIssueServeRequest(BaseModel):
    user_id: int = Field(gt=0)
    menu_id: int = Field(gt=0)


class MealIssuePublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    menu_id: int
    served_by_id: int | None
    status: MealIssueStatus = Field(description="issued | served | confirmed")
    served_at: datetime | None
    confirmed_at: datetime | None
    created_at: datetime


class MealIssueListResponse(BaseModel):
    items: list[MealIssuePublic]

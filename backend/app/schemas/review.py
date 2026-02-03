from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ReviewCreate(BaseModel):
    dish_id: int = Field(gt=0)
    menu_id: int | None = Field(default=None, gt=0)
    rating: int = Field(ge=1, le=5)
    comment: str | None = Field(default=None, max_length=1000)


class ReviewPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    menu_id: int | None
    dish_id: int
    rating: int
    comment: str | None
    created_at: datetime


class ReviewListResponse(BaseModel):
    items: list[ReviewPublic]

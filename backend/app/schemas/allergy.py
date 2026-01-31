from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class AllergyBase(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    description: str | None = Field(default=None, max_length=255)


class AllergyCreate(AllergyBase):
    pass


class AllergyUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    description: str | None = Field(default=None, max_length=255)


class AllergyPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: str | None


class AllergyListResponse(BaseModel):
    items: list[AllergyPublic]

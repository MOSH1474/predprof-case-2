from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from ..models import UserRole


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str = Field(min_length=1, max_length=255)
    dietary_preferences: str | None = Field(default=None, max_length=1000)

    @field_validator("full_name")
    @classmethod
    def _normalize_full_name(cls, value: str) -> str:
        trimmed = value.strip()
        if not trimmed:
            raise ValueError("ФИО не может быть пустым")
        return trimmed

    @field_validator("dietary_preferences")
    @classmethod
    def _normalize_preferences(cls, value: str | None) -> str | None:
        if value is None:
            return None
        trimmed = value.strip()
        return trimmed or None

    @field_validator("password")
    @classmethod
    def _password_bytes(cls, value: str) -> str:
        if len(value.encode("utf-8")) > 72:
            raise ValueError("Пароль должен быть не длиннее 72 байт")
        return value


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)
    @field_validator("password")
    @classmethod
    def _password_bytes(cls, value: str) -> str:
        if len(value.encode("utf-8")) > 72:
            raise ValueError("Пароль должен быть не длиннее 72 байт")
        return value


class UserPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: EmailStr
    full_name: str
    role: UserRole
    dietary_preferences: str | None
    is_active: bool
    created_at: datetime


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserPublic

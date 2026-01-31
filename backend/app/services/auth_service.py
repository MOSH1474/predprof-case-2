from __future__ import annotations

from jose import JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import User, UserRole
from ..schemas.auth import LoginRequest, RegisterRequest
from .security import create_access_token, decode_access_token, hash_password, verify_password
from .errors import raise_http_400, raise_http_401


async def register_student(payload: RegisterRequest, db: AsyncSession) -> User:
    result = await db.execute(select(User).where(User.email == payload.email.lower()))
    existing = result.scalar_one_or_none()
    if existing:
        raise_http_400("Email already registered")

    user = User(
        email=payload.email.lower(),
        full_name=payload.full_name.strip(),
        password_hash=hash_password(payload.password),
        role=UserRole.STUDENT,
        dietary_preferences=payload.dietary_preferences,
        is_active=True,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


async def authenticate_user(payload: LoginRequest, db: AsyncSession) -> User:
    result = await db.execute(select(User).where(User.email == payload.email.lower()))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise_http_401("Invalid email or password")
    if not verify_password(payload.password, user.password_hash):
        raise_http_401("Invalid email or password")
    return user


async def login_user(payload: LoginRequest, db: AsyncSession) -> tuple[User, str, int]:
    user = await authenticate_user(payload, db)
    token, expires_in = create_access_token(subject=str(user.id), role=user.role.value)
    return user, token, expires_in


async def get_current_user(token: str, db: AsyncSession) -> User:
    try:
        payload = decode_access_token(token)
    except JWTError:
        raise_http_401("Invalid authentication credentials")

    subject = payload.get("sub")
    if not subject:
        raise_http_401("Invalid authentication credentials")

    try:
        user_id = int(subject)
    except ValueError:
        raise_http_401("Invalid authentication credentials")

    user = await db.get(User, user_id)
    if not user or not user.is_active:
        raise_http_401("Inactive or missing user")
    return user

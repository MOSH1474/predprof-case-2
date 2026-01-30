from __future__ import annotations

from fastapi import APIRouter, Depends, Form, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import EmailStr, ValidationError
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_db
from ..models import User
from ..schemas.auth import LoginRequest, RegisterRequest, TokenResponse, UserPublic
from ..services.auth_service import authenticate_user, get_current_user, register_student
from ..services.security import create_access_token

router = APIRouter(prefix="/auth", tags=["auth"])
bearer_scheme = HTTPBearer(auto_error=True)


@router.post("/register", response_model=UserPublic, status_code=status.HTTP_201_CREATED)
async def register(payload: RegisterRequest, db: AsyncSession = Depends(get_db)) -> UserPublic:
    user = await register_student(payload, db)
    return UserPublic.model_validate(user)


@router.post("/login", response_model=TokenResponse)
async def login(
    username: EmailStr = Form(...),
    password: str = Form(...),
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    try:
        payload = LoginRequest(email=str(username), password=password)
    except ValidationError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=exc.errors()) from exc
    user = await authenticate_user(payload, db)
    token, expires_in = create_access_token(subject=str(user.id), role=user.role.value)
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        expires_in=expires_in,
        user=UserPublic.model_validate(user),
    )


@router.get("/me", response_model=UserPublic)
async def me(
    db: AsyncSession = Depends(get_db),
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> UserPublic:
    current_user: User = await get_current_user(credentials.credentials, db)
    return UserPublic.model_validate(current_user)

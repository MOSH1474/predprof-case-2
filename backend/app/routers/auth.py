from __future__ import annotations

from fastapi import APIRouter, Depends, Form, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import EmailStr, ValidationError
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_db
from ..docs import error_response, public_docs, roles_docs
from ..models import User
from ..schemas.auth import LoginRequest, RegisterRequest, TokenResponse, UserPublic
from ..services.auth_service import get_current_user, login_user, register_student

router = APIRouter(prefix="/auth", tags=["auth"])
bearer_scheme = HTTPBearer(auto_error=True)


@router.post(
    "/register",
    response_model=UserPublic,
    status_code=status.HTTP_201_CREATED,
    **public_docs(
        notes="Создает пользователя с ролью `student`.",
        extra_responses={
            400: error_response("Email already registered", "Bad request"),
        }
    ),
    summary="Регистрация ученика",
)
async def register(payload: RegisterRequest, db: AsyncSession = Depends(get_db)) -> UserPublic:
    user = await register_student(payload, db)
    return UserPublic.model_validate(user)


@router.post(
    "/login",
    response_model=TokenResponse,
    **public_docs(
        notes="Возвращает токен доступа и профиль пользователя.",
        extra_responses={
            401: error_response("Invalid email or password", "Unauthorized"),
        }
    ),
    summary="Вход в систему",
)
async def login(
    username: EmailStr = Form(...),
    password: str = Form(...),
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    try:
        payload = LoginRequest(email=str(username), password=password)
    except ValidationError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=exc.errors()) from exc
    user, token, expires_in = await login_user(payload, db)
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        expires_in=expires_in,
        user=UserPublic.model_validate(user),
    )


@router.get(
    "/me",
    response_model=UserPublic,
    **roles_docs(notes="Данные текущего пользователя по токену."),
    summary="Текущий пользователь",
)
async def me(
    db: AsyncSession = Depends(get_db),
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> UserPublic:
    current_user: User = await get_current_user(credentials.credentials, db)
    return UserPublic.model_validate(current_user)

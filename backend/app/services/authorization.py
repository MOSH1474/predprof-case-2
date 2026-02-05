from __future__ import annotations

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_db
from ..models import User, UserRole
from .auth_service import get_current_user
from .errors import raise_http_401, raise_http_403

bearer_scheme = HTTPBearer(auto_error=False)


async def require_user(
    db: AsyncSession = Depends(get_db),
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> User:
    if credentials is None or not credentials.credentials:
        raise_http_401("Не авторизован")
    return await get_current_user(credentials.credentials, db)


def require_roles(*roles: UserRole):
    def dependency(user: User = Depends(require_user)) -> User:
        if user.role == UserRole.ADMIN:
            return user
        if roles and user.role not in roles:
            raise_http_403("Недостаточно прав")
        return user

    return dependency

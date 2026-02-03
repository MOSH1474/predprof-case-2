from __future__ import annotations

from typing import Any


_DESCRIPTION_MAP = {
    "Bad request": "Неверный запрос",
    "Not found": "Не найдено",
    "Unauthorized": "Не авторизован",
    "Forbidden": "Недостаточно прав",
}


def error_response(detail: str, description: str) -> dict[str, Any]:
    localized_description = _DESCRIPTION_MAP.get(description, description)
    return {
        "description": localized_description,
        "content": {
            "application/json": {
                "example": {"detail": detail},
            }
        },
    }


def auth_error_responses(roles_required: bool) -> dict[int, dict[str, Any]]:
    responses: dict[int, dict[str, Any]] = {
        401: error_response("Not authenticated", "Не авторизован"),
    }
    if roles_required:
        responses[403] = error_response("Insufficient permissions", "Недостаточно прав")
    return responses


def public_docs(
    extra_responses: dict[int, dict[str, Any]] | None = None,
    notes: str | None = None,
) -> dict[str, Any]:
    responses = extra_responses or {}
    description = "> **Доступ:** публичный. Авторизация не требуется."
    if notes:
        description = f"{description}\n\n{notes}"
    return {
        "description": description,
        "openapi_extra": {"x-roles": []},
        "responses": responses,
    }


def roles_docs(
    *roles: str,
    extra_responses: dict[int, dict[str, Any]] | None = None,
    notes: str | None = None,
) -> dict[str, Any]:
    roles_list = list(roles)
    if roles_list:
        label = ", ".join(roles_list)
    else:
        label = "любой авторизованный пользователь"
    responses = auth_error_responses(bool(roles_list))
    if extra_responses:
        responses.update(extra_responses)
    description = (
        f"> **Доступ:** {label}. "
        "Администратор имеет доступ ко всем защищенным ресурсам."
    )
    if notes:
        description = f"{description}\n\n{notes}"
    return {"description": description, "openapi_extra": {"x-roles": roles_list}, "responses": responses}

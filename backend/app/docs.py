from __future__ import annotations

from typing import Any


def error_response(detail: str, description: str) -> dict[str, Any]:
    return {
        "description": description,
        "content": {
            "application/json": {
                "example": {"detail": detail},
            }
        },
    }


def auth_error_responses(roles_required: bool) -> dict[int, dict[str, Any]]:
    responses: dict[int, dict[str, Any]] = {
        401: error_response("Not authenticated", "Unauthorized"),
    }
    if roles_required:
        responses[403] = error_response("Insufficient permissions", "Forbidden")
    return responses


def public_docs(extra_responses: dict[int, dict[str, Any]] | None = None) -> dict[str, Any]:
    responses = extra_responses or {}
    return {
        "description": "> 🌐 **Access:** public.",
        "openapi_extra": {"x-roles": []},
        "responses": responses,
    }


def roles_docs(
    *roles: str, extra_responses: dict[int, dict[str, Any]] | None = None
) -> dict[str, Any]:
    roles_list = list(roles)
    if roles_list:
        label = ", ".join(roles_list)
    else:
        label = "any authenticated user"
    responses = auth_error_responses(bool(roles_list))
    if extra_responses:
        responses.update(extra_responses)
    return {
        "description": f"> 🔒 **Access:** {label}.",
        "openapi_extra": {"x-roles": roles_list},
        "responses": responses,
    }

from __future__ import annotations

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_db
from ..docs import error_response, roles_docs
from ..models import User, UserRole
from ..schemas.meal_issue import (
    MealIssueCreate,
    MealIssueListResponse,
    MealIssuePublic,
    MealIssueServeRequest,
)
from ..services.authorization import require_roles
from ..services.meal_issue_service import (
    confirm_meal,
    issue_meal,
    list_meal_issues,
    serve_meal,
)

router = APIRouter(prefix="/meal-issues", tags=["meal-issues"])


@router.get(
    "/me",
    response_model=MealIssueListResponse,
    **roles_docs("student", "admin"),
)
async def list_my_meal_issues(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.STUDENT)),
) -> MealIssueListResponse:
    issues = await list_meal_issues(current_user.id, db)
    return MealIssueListResponse(
        items=[MealIssuePublic.model_validate(item) for item in issues]
    )


@router.post(
    "/me",
    response_model=MealIssuePublic,
    **roles_docs(
        "student",
        "admin",
        extra_responses={
            400: error_response("Meal cannot be confirmed", "Bad request"),
            404: error_response("Menu not found", "Not found"),
        },
    ),
)
async def confirm_my_meal(
    payload: MealIssueCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.STUDENT)),
) -> MealIssuePublic:
    issue = await confirm_meal(current_user.id, payload.menu_id, db)
    return MealIssuePublic.model_validate(issue)


@router.post(
    "/issue",
    response_model=MealIssuePublic,
    status_code=status.HTTP_201_CREATED,
    **roles_docs(
        "cook",
        "admin",
        extra_responses={
            400: error_response("Meal already issued", "Bad request"),
            404: error_response("User not found", "Not found"),
        },
    ),
)
async def issue_meal_to_student(
    payload: MealIssueServeRequest,
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_roles(UserRole.COOK)),
) -> MealIssuePublic:
    issue = await issue_meal(payload.user_id, payload.menu_id, db)
    return MealIssuePublic.model_validate(issue)


@router.post(
    "/serve",
    response_model=MealIssuePublic,
    status_code=status.HTTP_201_CREATED,
    **roles_docs(
        "cook",
        "admin",
        extra_responses={
            400: error_response("Meal already served", "Bad request"),
            404: error_response("User not found", "Not found"),
        },
    ),
)
async def serve_meal_to_student(
    payload: MealIssueServeRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.COOK)),
) -> MealIssuePublic:
    issue = await serve_meal(payload.user_id, payload.menu_id, current_user.id, db)
    return MealIssuePublic.model_validate(issue)

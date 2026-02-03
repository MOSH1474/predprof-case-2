from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_db
from ..docs import error_response, roles_docs
from ..models import PurchaseRequestStatus, User, UserRole
from ..schemas.purchase_request import (
    PurchaseRequestCreate,
    PurchaseRequestDecision,
    PurchaseRequestListResponse,
    PurchaseRequestPublic,
)
from ..services.authorization import require_roles
from ..services.errors import raise_http_403
from ..services.purchase_request_service import (
    create_purchase_request,
    decide_purchase_request,
    get_purchase_request,
    list_purchase_requests,
)

router = APIRouter(
    prefix="/purchase-requests",
    tags=["purchase-requests"],
    dependencies=[Depends(require_roles(UserRole.COOK, UserRole.ADMIN))],
)


@router.get(
    "/",
    response_model=PurchaseRequestListResponse,
    **roles_docs("cook", "admin"),
)
async def list_purchase_requests_endpoint(
    status: PurchaseRequestStatus | None = Query(default=None),
    requested_by_id: int | None = Query(default=None, gt=0),
    date_from: datetime | None = Query(default=None),
    date_to: datetime | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.COOK, UserRole.ADMIN)),
) -> PurchaseRequestListResponse:
    if current_user.role != UserRole.ADMIN:
        requested_by_id = current_user.id
    purchase_requests = await list_purchase_requests(
        db,
        requested_by_id=requested_by_id,
        status=status,
        date_from=date_from,
        date_to=date_to,
    )
    return PurchaseRequestListResponse(
        items=[PurchaseRequestPublic.model_validate(item) for item in purchase_requests]
    )


@router.get(
    "/{request_id}",
    response_model=PurchaseRequestPublic,
    **roles_docs(
        "cook",
        "admin",
        extra_responses={404: error_response("Purchase request not found", "Not found")},
    ),
)
async def get_purchase_request_endpoint(
    request_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.COOK, UserRole.ADMIN)),
) -> PurchaseRequestPublic:
    purchase_request = await get_purchase_request(request_id, db)
    if current_user.role != UserRole.ADMIN and purchase_request.requested_by_id != current_user.id:
        raise_http_403("Insufficient permissions")
    return PurchaseRequestPublic.model_validate(purchase_request)


@router.post(
    "/",
    response_model=PurchaseRequestPublic,
    status_code=status.HTTP_201_CREATED,
    **roles_docs(
        "cook",
        "admin",
        extra_responses={
            400: error_response("Products not found: [1]", "Bad request"),
        },
    ),
)
async def create_purchase_request_endpoint(
    payload: PurchaseRequestCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.COOK, UserRole.ADMIN)),
) -> PurchaseRequestPublic:
    purchase_request = await create_purchase_request(payload, current_user.id, db)
    return PurchaseRequestPublic.model_validate(purchase_request)


@router.post(
    "/{request_id}/decision",
    response_model=PurchaseRequestPublic,
    **roles_docs(
        "admin",
        extra_responses={
            400: error_response("Purchase request already decided", "Bad request"),
            404: error_response("Purchase request not found", "Not found"),
        },
    ),
)
async def decide_purchase_request_endpoint(
    request_id: int,
    payload: PurchaseRequestDecision,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN)),
) -> PurchaseRequestPublic:
    purchase_request = await get_purchase_request(request_id, db)
    purchase_request = await decide_purchase_request(
        purchase_request, payload.status, current_user.id, db
    )
    return PurchaseRequestPublic.model_validate(purchase_request)

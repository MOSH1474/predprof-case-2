from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_db
from ..docs import error_response, roles_docs
from ..models import InventoryDirection, User, UserRole
from ..schemas.inventory_transaction import (
    InventoryTransactionCreate,
    InventoryTransactionListResponse,
    InventoryTransactionPublic,
)
from ..services.authorization import require_roles
from ..services.inventory_transaction_service import (
    create_inventory_transaction,
    list_inventory_transactions,
)

router = APIRouter(
    prefix="/inventory-transactions",
    tags=["inventory-transactions"],
    dependencies=[Depends(require_roles(UserRole.COOK, UserRole.ADMIN))],
)


@router.get(
    "/",
    response_model=InventoryTransactionListResponse,
    **roles_docs("cook", "admin"),
)
async def list_inventory_transactions_endpoint(
    product_id: int | None = Query(default=None, gt=0),
    direction: InventoryDirection | None = Query(default=None),
    date_from: datetime | None = Query(default=None),
    date_to: datetime | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
) -> InventoryTransactionListResponse:
    transactions = await list_inventory_transactions(
        db, product_id=product_id, direction=direction, date_from=date_from, date_to=date_to
    )
    return InventoryTransactionListResponse(
        items=[InventoryTransactionPublic.model_validate(item) for item in transactions]
    )


@router.post(
    "/",
    response_model=InventoryTransactionPublic,
    status_code=status.HTTP_201_CREATED,
    **roles_docs(
        "cook",
        "admin",
        extra_responses={
            400: error_response("Not enough stock", "Bad request"),
            404: error_response("Product not found", "Not found"),
        },
    ),
)
async def create_inventory_transaction_endpoint(
    payload: InventoryTransactionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.COOK, UserRole.ADMIN)),
) -> InventoryTransactionPublic:
    transaction = await create_inventory_transaction(payload, current_user.id, db)
    return InventoryTransactionPublic.model_validate(transaction)

from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import InventoryDirection, InventoryTransaction, Product
from ..schemas.inventory_transaction import InventoryTransactionCreate
from .errors import raise_http_400, raise_http_404
from .product_service import get_product_stock


async def _get_product(product_id: int, db: AsyncSession) -> Product:
    result = await db.execute(select(Product).where(Product.id == product_id))
    product = result.scalar_one_or_none()
    if not product:
        raise_http_404("Продукт не найден")
    return product


async def list_inventory_transactions(
    db: AsyncSession,
    product_id: int | None = None,
    direction: InventoryDirection | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
) -> list[InventoryTransaction]:
    stmt = select(InventoryTransaction).order_by(
        InventoryTransaction.created_at.desc(), InventoryTransaction.id.desc()
    )
    if product_id is not None:
        stmt = stmt.where(InventoryTransaction.product_id == product_id)
    if direction is not None:
        stmt = stmt.where(InventoryTransaction.direction == direction)
    if date_from is not None:
        stmt = stmt.where(InventoryTransaction.created_at >= date_from)
    if date_to is not None:
        stmt = stmt.where(InventoryTransaction.created_at <= date_to)
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def create_inventory_transaction(
    payload: InventoryTransactionCreate,
    created_by_id: int | None,
    db: AsyncSession,
) -> InventoryTransaction:
    product = await _get_product(payload.product_id, db)
    if not product.is_active:
        raise_http_400("Продукт неактивен")

    if payload.direction == InventoryDirection.OUT:
        stock: Decimal = await get_product_stock(product.id, db)
        if stock < payload.quantity:
            raise_http_400("Недостаточно остатка")

    transaction = InventoryTransaction(
        product_id=product.id,
        quantity=payload.quantity,
        direction=payload.direction,
        reason=payload.reason,
        created_by_id=created_by_id,
    )
    db.add(transaction)
    await db.commit()
    await db.refresh(transaction)
    return transaction

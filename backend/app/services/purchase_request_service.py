from __future__ import annotations

from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..models import Product, PurchaseRequest, PurchaseRequestItem, PurchaseRequestStatus
from ..models.utils import utcnow
from ..schemas.purchase_request import PurchaseRequestCreate, PurchaseRequestItemCreate
from .errors import raise_http_400, raise_http_404


def _normalize_optional_text(value: str | None) -> str | None:
    if value is None:
        return None
    trimmed = value.strip()
    return trimmed if trimmed else None


def _purchase_request_query_with_items():
    return select(PurchaseRequest).options(
        selectinload(PurchaseRequest.items).selectinload(PurchaseRequestItem.product)
    )


async def _resolve_products(
    items: list[PurchaseRequestItemCreate],
    db: AsyncSession,
) -> dict[int, Product]:
    product_ids = [item.product_id for item in items]
    if not product_ids:
        return {}

    result = await db.execute(select(Product).where(Product.id.in_(product_ids)))
    products = list(result.scalars().all())
    found_ids = {product.id for product in products}
    missing_ids = sorted(set(product_ids) - found_ids)
    if missing_ids:
        raise_http_400(f"Products not found: {missing_ids}")

    inactive_ids = sorted(product.id for product in products if not product.is_active)
    if inactive_ids:
        raise_http_400(f"Products inactive: {inactive_ids}")

    return {product.id: product for product in products}


def _build_items(items: list[PurchaseRequestItemCreate]) -> list[PurchaseRequestItem]:
    return [
        PurchaseRequestItem(
            product_id=item.product_id,
            quantity=item.quantity,
            unit_price=item.unit_price,
        )
        for item in items
    ]


async def list_purchase_requests(
    db: AsyncSession,
    requested_by_id: int | None = None,
    status: PurchaseRequestStatus | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
) -> list[PurchaseRequest]:
    stmt = _purchase_request_query_with_items()
    if requested_by_id is not None:
        stmt = stmt.where(PurchaseRequest.requested_by_id == requested_by_id)
    if status is not None:
        stmt = stmt.where(PurchaseRequest.status == status)
    if date_from is not None:
        stmt = stmt.where(PurchaseRequest.requested_at >= date_from)
    if date_to is not None:
        stmt = stmt.where(PurchaseRequest.requested_at <= date_to)

    stmt = stmt.order_by(PurchaseRequest.requested_at.desc(), PurchaseRequest.id.desc())
    result = await db.execute(stmt)
    return list(result.scalars().unique().all())


async def get_purchase_request(request_id: int, db: AsyncSession) -> PurchaseRequest:
    stmt = _purchase_request_query_with_items().where(PurchaseRequest.id == request_id)
    result = await db.execute(stmt)
    purchase_request = result.scalar_one_or_none()
    if not purchase_request:
        raise_http_404("Purchase request not found")
    return purchase_request


async def create_purchase_request(
    payload: PurchaseRequestCreate,
    requested_by_id: int,
    db: AsyncSession,
) -> PurchaseRequest:
    note = _normalize_optional_text(payload.note)
    await _resolve_products(payload.items, db)

    purchase_request = PurchaseRequest(
        requested_by_id=requested_by_id,
        note=note,
        status=PurchaseRequestStatus.PENDING,
        items=_build_items(payload.items),
    )
    db.add(purchase_request)
    await db.commit()
    return await get_purchase_request(purchase_request.id, db)


async def decide_purchase_request(
    purchase_request: PurchaseRequest,
    status: PurchaseRequestStatus,
    decided_by_id: int,
    db: AsyncSession,
) -> PurchaseRequest:
    if status not in (PurchaseRequestStatus.APPROVED, PurchaseRequestStatus.REJECTED):
        raise_http_400("Decision must be approved or rejected")
    if purchase_request.status != PurchaseRequestStatus.PENDING:
        raise_http_400("Purchase request already decided")

    purchase_request.status = status
    purchase_request.approved_by_id = decided_by_id
    purchase_request.decided_at = utcnow()
    await db.commit()
    return await get_purchase_request(purchase_request.id, db)

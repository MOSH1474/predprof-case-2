from __future__ import annotations

from decimal import Decimal

from sqlalchemy import Numeric, case, cast, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import InventoryDirection, InventoryTransaction, Product
from ..schemas.product import ProductCreate, ProductUpdate
from .errors import raise_http_400, raise_http_404


def _normalize_optional_text(value: str | None) -> str | None:
    if value is None:
        return None
    trimmed = value.strip()
    return trimmed if trimmed else None


def _normalize_required_text(value: str, label: str) -> str:
    trimmed = value.strip()
    if not trimmed:
        raise_http_400(f"{label} cannot be empty")
    return trimmed


async def list_products(
    db: AsyncSession, is_active: bool | None = None, category: str | None = None
) -> list[Product]:
    stmt = select(Product).order_by(Product.name)
    if is_active is not None:
        stmt = stmt.where(Product.is_active == is_active)
    if category:
        stmt = stmt.where(Product.category == category)
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def get_product(product_id: int, db: AsyncSession) -> Product:
    result = await db.execute(select(Product).where(Product.id == product_id))
    product = result.scalar_one_or_none()
    if not product:
        raise_http_404("Product not found")
    return product


async def create_product(payload: ProductCreate, db: AsyncSession) -> Product:
    name = _normalize_required_text(payload.name, "Product name")
    unit = _normalize_required_text(payload.unit, "Unit")
    category = _normalize_optional_text(payload.category)

    result = await db.execute(select(Product).where(Product.name == name))
    if result.scalar_one_or_none():
        raise_http_400("Product already exists")

    product = Product(
        name=name,
        unit=unit,
        category=category,
        is_active=payload.is_active,
    )
    db.add(product)
    await db.commit()
    await db.refresh(product)
    return product


async def update_product(product: Product, payload: ProductUpdate, db: AsyncSession) -> Product:
    if "name" in payload.model_fields_set:
        name = _normalize_required_text(payload.name or "", "Product name")
        if name != product.name:
            result = await db.execute(select(Product).where(Product.name == name))
            if result.scalar_one_or_none():
                raise_http_400("Product already exists")
            product.name = name

    if "unit" in payload.model_fields_set:
        product.unit = _normalize_required_text(payload.unit or "", "Unit")

    if "category" in payload.model_fields_set:
        product.category = _normalize_optional_text(payload.category)

    if "is_active" in payload.model_fields_set:
        product.is_active = bool(payload.is_active)

    await db.commit()
    await db.refresh(product)
    return product


async def delete_product(product: Product, db: AsyncSession) -> None:
    await db.delete(product)
    await db.commit()


def _stock_subquery():
    signed_quantity = case(
        (InventoryTransaction.direction == InventoryDirection.IN, InventoryTransaction.quantity),
        else_=-InventoryTransaction.quantity,
    )
    total_stock = func.coalesce(func.sum(signed_quantity), 0)
    return (
        select(
            InventoryTransaction.product_id.label("product_id"),
            cast(total_stock, Numeric(12, 3)).label("stock"),
        )
        .group_by(InventoryTransaction.product_id)
        .subquery()
    )


async def list_products_with_stock(
    db: AsyncSession, is_active: bool | None = None, category: str | None = None
) -> list[tuple[Product, Decimal]]:
    stock_subquery = _stock_subquery()
    stock_col = func.coalesce(stock_subquery.c.stock, cast(0, Numeric(12, 3))).label(
        "stock"
    )
    stmt = (
        select(Product, stock_col)
        .outerjoin(stock_subquery, stock_subquery.c.product_id == Product.id)
        .order_by(Product.name)
    )
    if is_active is not None:
        stmt = stmt.where(Product.is_active == is_active)
    if category:
        stmt = stmt.where(Product.category == category)
    result = await db.execute(stmt)
    return [(row[0], row[1]) for row in result.all()]


async def get_product_stock(product_id: int, db: AsyncSession) -> Decimal:
    signed_quantity = case(
        (InventoryTransaction.direction == InventoryDirection.IN, InventoryTransaction.quantity),
        else_=-InventoryTransaction.quantity,
    )
    total_stock = func.coalesce(func.sum(signed_quantity), 0)
    stmt = select(cast(total_stock, Numeric(12, 3))).where(
        InventoryTransaction.product_id == product_id
    )
    result = await db.execute(stmt)
    stock = result.scalar_one_or_none()
    return stock if stock is not None else Decimal("0")

from __future__ import annotations

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_db
from ..docs import error_response, roles_docs
from ..models import UserRole
from ..schemas.product import (
    ProductCreate,
    ProductListResponse,
    ProductPublic,
    ProductStockListResponse,
    ProductStockPublic,
    ProductUpdate,
)
from ..services.authorization import require_roles
from ..services.product_service import (
    create_product,
    delete_product,
    get_product,
    list_products,
    list_products_with_stock,
    update_product,
)

router = APIRouter(
    prefix="/products",
    tags=["products"],
    dependencies=[Depends(require_roles(UserRole.COOK, UserRole.ADMIN))],
)


@router.get(
    "/",
    response_model=ProductListResponse,
    **roles_docs("cook", "admin", notes="Справочник продуктов склада."),
    summary="Список продуктов",
)
async def list_products_endpoint(
    is_active: bool | None = Query(default=None),
    category: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
) -> ProductListResponse:
    products = await list_products(db, is_active=is_active, category=category)
    return ProductListResponse(items=[ProductPublic.model_validate(item) for item in products])


@router.get(
    "/stock",
    response_model=ProductStockListResponse,
    **roles_docs("cook", "admin", notes="Возвращает остатки по каждому продукту."),
    summary="Остатки по складу",
)
async def list_products_stock_endpoint(
    is_active: bool | None = Query(default=None),
    category: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
) -> ProductStockListResponse:
    products = await list_products_with_stock(db, is_active=is_active, category=category)
    items = [
        ProductStockPublic.model_validate(
            {
                "id": product.id,
                "name": product.name,
                "unit": product.unit,
                "category": product.category,
                "is_active": product.is_active,
                "stock": stock,
            }
        )
        for product, stock in products
    ]
    return ProductStockListResponse(items=items)


@router.get(
    "/{product_id}",
    response_model=ProductPublic,
    **roles_docs(
        "cook",
        "admin",
        notes="Возвращает продукт по идентификатору.",
        extra_responses={404: error_response("Продукт не найден", "Not found")},
    ),
    summary="Продукт по id",
)
async def get_product_endpoint(
    product_id: int, db: AsyncSession = Depends(get_db)
) -> ProductPublic:
    product = await get_product(product_id, db)
    return ProductPublic.model_validate(product)


@router.post(
    "/",
    response_model=ProductPublic,
    status_code=status.HTTP_201_CREATED,
    **roles_docs(
        "cook",
        "admin",
        notes="Создает продукт в каталоге.",
        extra_responses={400: error_response("Продукт уже существует", "Bad request")},
    ),
    summary="Создать продукт",
)
async def create_product_endpoint(
    payload: ProductCreate,
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_roles(UserRole.COOK, UserRole.ADMIN)),
) -> ProductPublic:
    product = await create_product(payload, db)
    return ProductPublic.model_validate(product)


@router.put(
    "/{product_id}",
    response_model=ProductPublic,
    **roles_docs(
        "cook",
        "admin",
        notes="Обновляет продукт и его свойства.",
        extra_responses={
            400: error_response("Продукт уже существует", "Bad request"),
            404: error_response("Продукт не найден", "Not found"),
        },
    ),
    summary="Обновить продукт",
)
async def update_product_endpoint(
    product_id: int,
    payload: ProductUpdate,
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_roles(UserRole.COOK, UserRole.ADMIN)),
) -> ProductPublic:
    product = await get_product(product_id, db)
    product = await update_product(product, payload, db)
    return ProductPublic.model_validate(product)


@router.delete(
    "/{product_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    **roles_docs(
        "cook",
        "admin",
        notes="Удаляет продукт по идентификатору.",
        extra_responses={404: error_response("Продукт не найден", "Not found")},
    ),
    summary="Удалить продукт",
)
async def delete_product_endpoint(
    product_id: int,
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_roles(UserRole.COOK, UserRole.ADMIN)),
) -> None:
    product = await get_product(product_id, db)
    await delete_product(product, db)

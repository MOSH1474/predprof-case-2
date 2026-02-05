import uuid
from decimal import Decimal

import pytest

from app.models import User, UserRole
from app.services.security import create_access_token, hash_password


def _auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


async def _create_user(db_session, role: UserRole) -> tuple[User, str]:
    email = f"{role.value}-{uuid.uuid4()}@example.com"
    user = User(
        email=email,
        full_name="Test User",
        password_hash=hash_password("TestPass123!"),
        role=role,
        is_active=True,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    token, _ = create_access_token(subject=str(user.id), role=user.role.value)
    return user, token


async def _create_product(client, token: str, name: str = "Product") -> dict:
    response = await client.post(
        "/products/",
        headers=_auth_headers(token),
        json={"name": f"{name} {uuid.uuid4()}", "unit": "kg", "category": "dry"},
    )
    assert response.status_code == 201
    return response.json()


def _find_stock_item(items: list[dict], product_id: int) -> dict:
    for item in items:
        if item["id"] == product_id:
            return item
    raise AssertionError("Product not found in stock list")


@pytest.mark.anyio
async def test_product_stock_flow(client, db_session):
    cook, cook_token = await _create_user(db_session, UserRole.COOK)
    product = await _create_product(client, cook_token, name="Rice")

    stock_response = await client.get(
        "/products/stock",
        headers=_auth_headers(cook_token),
    )
    assert stock_response.status_code == 200
    stock_item = _find_stock_item(stock_response.json()["items"], product["id"])
    assert Decimal(stock_item["stock"]) == Decimal("0")

    in_response = await client.post(
        "/inventory-transactions/",
        headers=_auth_headers(cook_token),
        json={
            "product_id": product["id"],
            "quantity": "5.000",
            "direction": "in",
            "reason": "Delivery",
        },
    )
    assert in_response.status_code == 201
    assert in_response.json()["created_by_id"] == cook.id

    out_response = await client.post(
        "/inventory-transactions/",
        headers=_auth_headers(cook_token),
        json={
            "product_id": product["id"],
            "quantity": "1.250",
            "direction": "out",
            "reason": "Cooking",
        },
    )
    assert out_response.status_code == 201

    stock_response = await client.get(
        "/products/stock",
        headers=_auth_headers(cook_token),
    )
    assert stock_response.status_code == 200
    stock_item = _find_stock_item(stock_response.json()["items"], product["id"])
    assert Decimal(stock_item["stock"]) == Decimal("3.750")

    tx_response = await client.get(
        f"/inventory-transactions/?product_id={product['id']}",
        headers=_auth_headers(cook_token),
    )
    assert tx_response.status_code == 200
    tx_items = tx_response.json()["items"]
    assert len(tx_items) == 2


@pytest.mark.anyio
async def test_inventory_transaction_rejects_overdraft(client, db_session):
    _, cook_token = await _create_user(db_session, UserRole.COOK)
    product = await _create_product(client, cook_token, name="Sugar")

    out_response = await client.post(
        "/inventory-transactions/",
        headers=_auth_headers(cook_token),
        json={
            "product_id": product["id"],
            "quantity": "1.000",
            "direction": "out",
        },
    )
    assert out_response.status_code == 400
    assert out_response.json()["detail"] == "Недостаточно остатка"


@pytest.mark.anyio
async def test_inventory_transaction_rejects_inactive_product(client, db_session):
    _, cook_token = await _create_user(db_session, UserRole.COOK)
    product = await _create_product(client, cook_token, name="Oil")

    update_response = await client.put(
        f"/products/{product['id']}",
        headers=_auth_headers(cook_token),
        json={"is_active": False},
    )
    assert update_response.status_code == 200

    in_response = await client.post(
        "/inventory-transactions/",
        headers=_auth_headers(cook_token),
        json={
            "product_id": product["id"],
            "quantity": "2.000",
            "direction": "in",
        },
    )
    assert in_response.status_code == 400
    assert in_response.json()["detail"] == "Продукт неактивен"


@pytest.mark.anyio
async def test_products_access_denied_for_student(client, db_session):
    _, student_token = await _create_user(db_session, UserRole.STUDENT)

    response = await client.get(
        "/products/",
        headers=_auth_headers(student_token),
    )
    assert response.status_code == 403

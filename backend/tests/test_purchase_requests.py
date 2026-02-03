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


@pytest.mark.anyio
async def test_create_purchase_request_and_list(client, db_session):
    cook, cook_token = await _create_user(db_session, UserRole.COOK)
    _, admin_token = await _create_user(db_session, UserRole.ADMIN)
    product = await _create_product(client, cook_token, name="Flour")

    create_response = await client.post(
        "/purchase-requests/",
        headers=_auth_headers(cook_token),
        json={
            "note": "Weekly restock",
            "items": [
                {
                    "product_id": product["id"],
                    "quantity": "10.000",
                    "unit_price": "45.50",
                }
            ],
        },
    )
    assert create_response.status_code == 201
    payload = create_response.json()
    assert payload["status"] == "pending"
    assert payload["requested_by_id"] == cook.id
    assert payload["items"][0]["product"]["id"] == product["id"]
    assert Decimal(payload["items"][0]["quantity"]) == Decimal("10.000")

    cook_list = await client.get(
        "/purchase-requests/",
        headers=_auth_headers(cook_token),
    )
    assert cook_list.status_code == 200
    cook_items = cook_list.json()["items"]
    assert any(item["id"] == payload["id"] for item in cook_items)

    admin_list = await client.get(
        "/purchase-requests/",
        headers=_auth_headers(admin_token),
    )
    assert admin_list.status_code == 200
    admin_items = admin_list.json()["items"]
    assert any(item["id"] == payload["id"] for item in admin_items)


@pytest.mark.anyio
async def test_admin_can_approve_purchase_request(client, db_session):
    _, cook_token = await _create_user(db_session, UserRole.COOK)
    admin, admin_token = await _create_user(db_session, UserRole.ADMIN)
    product = await _create_product(client, cook_token, name="Sugar")

    create_response = await client.post(
        "/purchase-requests/",
        headers=_auth_headers(cook_token),
        json={
            "items": [
                {
                    "product_id": product["id"],
                    "quantity": "3.500",
                }
            ]
        },
    )
    assert create_response.status_code == 201
    request_id = create_response.json()["id"]

    decision_response = await client.post(
        f"/purchase-requests/{request_id}/decision",
        headers=_auth_headers(admin_token),
        json={"status": "approved"},
    )
    assert decision_response.status_code == 200
    payload = decision_response.json()
    assert payload["status"] == "approved"
    assert payload["approved_by_id"] == admin.id
    assert payload["decided_at"] is not None

    repeat_response = await client.post(
        f"/purchase-requests/{request_id}/decision",
        headers=_auth_headers(admin_token),
        json={"status": "rejected"},
    )
    assert repeat_response.status_code == 400
    assert repeat_response.json()["detail"] == "Purchase request already decided"


@pytest.mark.anyio
async def test_purchase_request_access_denied_for_student(client, db_session):
    _, student_token = await _create_user(db_session, UserRole.STUDENT)

    response = await client.get(
        "/purchase-requests/",
        headers=_auth_headers(student_token),
    )
    assert response.status_code == 403

import uuid
from datetime import date
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


async def _create_dish(client, token: str) -> int:
    response = await client.post(
        "/dishes/",
        headers=_auth_headers(token),
        json={"name": f"Dish {uuid.uuid4()}", "description": "Tasty"},
    )
    assert response.status_code == 201
    return response.json()["id"]


async def _create_menu(client, token: str, dish_id: int, menu_date: date) -> int:
    response = await client.post(
        "/menus/",
        headers=_auth_headers(token),
        json={
            "menu_date": menu_date.isoformat(),
            "meal_type": "lunch",
            "title": "Lunch",
            "price": "150.00",
            "items": [
                {
                    "dish_id": dish_id,
                    "portion_size": "200.00",
                    "planned_qty": 20,
                    "remaining_qty": 20,
                }
            ],
        },
    )
    assert response.status_code == 201
    return response.json()["id"]


async def _create_product(client, token: str) -> dict:
    response = await client.post(
        "/products/",
        headers=_auth_headers(token),
        json={"name": f"Product {uuid.uuid4()}", "unit": "kg", "category": "dry"},
    )
    assert response.status_code == 201
    return response.json()


@pytest.mark.anyio
async def test_admin_nutrition_report(client, db_session):
    _, admin_token = await _create_user(db_session, UserRole.ADMIN)
    _, cook_token = await _create_user(db_session, UserRole.COOK)
    student, student_token = await _create_user(db_session, UserRole.STUDENT)

    dish_id = await _create_dish(client, cook_token)
    menu_date = date(2025, 2, 15)
    menu_id = await _create_menu(client, cook_token, dish_id, menu_date)

    pay_response = await client.post(
        "/payments/one-time",
        headers=_auth_headers(student_token),
        json={"menu_id": menu_id},
    )
    assert pay_response.status_code == 201

    serve_response = await client.post(
        "/meal-issues/serve",
        headers=_auth_headers(cook_token),
        json={"user_id": student.id, "menu_id": menu_id},
    )
    assert serve_response.status_code == 201

    confirm_response = await client.post(
        "/meal-issues/me",
        headers=_auth_headers(student_token),
        json={"menu_id": menu_id},
    )
    assert confirm_response.status_code == 200

    report_response = await client.get(
        f"/admin/reports/nutrition?date_from={menu_date.isoformat()}&date_to={menu_date.isoformat()}",
        headers=_auth_headers(admin_token),
    )
    assert report_response.status_code == 200
    payload = report_response.json()
    assert payload["total_count"] == 1
    assert payload["items"]
    row = payload["items"][0]
    assert row["menu_date"] == menu_date.isoformat()
    assert row["issued"] == 0
    assert row["served"] == 0
    assert row["confirmed"] == 1


@pytest.mark.anyio
async def test_admin_expense_report(client, db_session):
    admin, admin_token = await _create_user(db_session, UserRole.ADMIN)
    _, cook_token = await _create_user(db_session, UserRole.COOK)

    product = await _create_product(client, cook_token)

    create_response = await client.post(
        "/purchase-requests/",
        headers=_auth_headers(cook_token),
        json={
            "items": [
                {
                    "product_id": product["id"],
                    "quantity": "2.500",
                    "unit_price": "40.00",
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

    report_response = await client.get(
        "/admin/reports/expenses",
        headers=_auth_headers(admin_token),
    )
    assert report_response.status_code == 200
    payload = report_response.json()
    assert Decimal(payload["total_quantity"]) == Decimal("2.500")
    assert Decimal(payload["total_amount"]) == Decimal("100.00")
    assert payload["items"]
    item = payload["items"][0]
    assert item["product_id"] == product["id"]


@pytest.mark.anyio
async def test_admin_reports_access_denied_for_student(client, db_session):
    _, student_token = await _create_user(db_session, UserRole.STUDENT)

    response = await client.get(
        "/admin/reports/nutrition",
        headers=_auth_headers(student_token),
    )
    assert response.status_code == 403

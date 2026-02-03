import uuid
from datetime import date, timedelta
from decimal import Decimal

import pytest

from app.models import User, UserRole
from app.models.utils import utcnow
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


async def _create_menu(client, cook_token: str, menu_date: date, remaining_qty: int) -> int:
    dish_response = await client.post(
        "/dishes/",
        headers=_auth_headers(cook_token),
        json={"name": f"Dish {uuid.uuid4()}", "description": "Menu item"},
    )
    assert dish_response.status_code == 201
    dish_id = dish_response.json()["id"]

    menu_response = await client.post(
        "/menus/",
        headers=_auth_headers(cook_token),
        json={
            "menu_date": menu_date.isoformat(),
            "meal_type": "breakfast",
            "title": "Breakfast",
            "price": "120.00",
            "items": [
                {
                    "dish_id": dish_id,
                    "portion_size": "250.00",
                    "planned_qty": max(remaining_qty, 0),
                    "remaining_qty": remaining_qty,
                }
            ],
        },
    )
    assert menu_response.status_code == 201
    return menu_response.json()["id"]


@pytest.mark.anyio
async def test_create_one_time_payment_and_list(client, db_session):
    _, cook_token = await _create_user(db_session, UserRole.COOK)
    _, student_token = await _create_user(db_session, UserRole.STUDENT)

    menu_id = await _create_menu(client, cook_token, date(2025, 2, 5), remaining_qty=5)

    payment_response = await client.post(
        "/payments/one-time",
        headers=_auth_headers(student_token),
        json={"menu_id": menu_id},
    )
    assert payment_response.status_code == 201
    payload = payment_response.json()
    assert payload["payment_type"] == "one_time"
    assert payload["status"] == "paid"
    assert payload["menu_id"] == menu_id
    assert Decimal(payload["amount"]) == Decimal("120.00")

    list_response = await client.get(
        "/payments/me",
        headers=_auth_headers(student_token),
    )
    assert list_response.status_code == 200
    items = list_response.json()["items"]
    assert any(item["id"] == payload["id"] for item in items)


@pytest.mark.anyio
async def test_subscription_payment_and_active_endpoint(client, db_session):
    _, student_token = await _create_user(db_session, UserRole.STUDENT)

    today = utcnow().date()
    period_start = today
    period_end = today + timedelta(days=6)
    days = (period_end - period_start).days + 1
    expected_amount = (Decimal("250.00") * days).quantize(Decimal("0.01"))

    payment_response = await client.post(
        "/payments/subscription",
        headers=_auth_headers(student_token),
        json={
            "period_start": period_start.isoformat(),
            "period_end": period_end.isoformat(),
        },
    )
    assert payment_response.status_code == 201
    payload = payment_response.json()
    assert payload["payment_type"] == "subscription"
    assert Decimal(payload["amount"]) == expected_amount

    active_response = await client.get(
        "/payments/me/active-subscription",
        headers=_auth_headers(student_token),
    )
    assert active_response.status_code == 200
    active_payload = active_response.json()
    assert active_payload["id"] == payload["id"]


@pytest.mark.anyio
async def test_subscription_overlap_is_rejected(client, db_session):
    _, student_token = await _create_user(db_session, UserRole.STUDENT)
    today = utcnow().date()

    response = await client.post(
        "/payments/subscription",
        headers=_auth_headers(student_token),
        json={
            "period_start": today.isoformat(),
            "period_end": (today + timedelta(days=2)).isoformat(),
        },
    )
    assert response.status_code == 201

    overlap_response = await client.post(
        "/payments/subscription",
        headers=_auth_headers(student_token),
        json={
            "period_start": (today + timedelta(days=1)).isoformat(),
            "period_end": (today + timedelta(days=3)).isoformat(),
        },
    )
    assert overlap_response.status_code == 400
    assert overlap_response.json()["detail"] == "Subscription overlaps existing subscription"


@pytest.mark.anyio
async def test_subscription_covers_meal_issue(client, db_session):
    _, cook_token = await _create_user(db_session, UserRole.COOK)
    student, student_token = await _create_user(db_session, UserRole.STUDENT)

    today = utcnow().date()
    menu_id = await _create_menu(client, cook_token, today, remaining_qty=2)

    sub_response = await client.post(
        "/payments/subscription",
        headers=_auth_headers(student_token),
        json={
            "period_start": today.isoformat(),
            "period_end": (today + timedelta(days=3)).isoformat(),
        },
    )
    assert sub_response.status_code == 201

    serve_response = await client.post(
        "/meal-issues/serve",
        headers=_auth_headers(cook_token),
        json={"user_id": student.id, "menu_id": menu_id},
    )
    assert serve_response.status_code == 201

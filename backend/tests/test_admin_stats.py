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


@pytest.mark.anyio
async def test_admin_payment_stats(client, db_session):
    _, admin_token = await _create_user(db_session, UserRole.ADMIN)
    _, cook_token = await _create_user(db_session, UserRole.COOK)
    _, student_token = await _create_user(db_session, UserRole.STUDENT)

    started_at = utcnow()
    dish_id = await _create_dish(client, cook_token)
    menu_id = await _create_menu(client, cook_token, dish_id, date(2025, 2, 1))

    one_time_response = await client.post(
        "/payments/one-time",
        headers=_auth_headers(student_token),
        json={"menu_id": menu_id},
    )
    assert one_time_response.status_code == 201
    one_time_amount = Decimal(one_time_response.json()["amount"])

    period_start = date(2025, 2, 1)
    period_end = period_start + timedelta(days=2)
    subscription_response = await client.post(
        "/payments/subscription",
        headers=_auth_headers(student_token),
        json={
            "period_start": period_start.isoformat(),
            "period_end": period_end.isoformat(),
        },
    )
    assert subscription_response.status_code == 201
    subscription_amount = Decimal(subscription_response.json()["amount"])

    date_from = started_at.isoformat().replace("+00:00", "Z")
    stats_response = await client.get(
        f"/admin/stats/payments?date_from={date_from}",
        headers=_auth_headers(admin_token),
    )
    assert stats_response.status_code == 200
    payload = stats_response.json()
    assert payload["total_count"] == 2
    assert Decimal(payload["total_amount"]) == one_time_amount + subscription_amount

    by_type = {item["payment_type"]: item for item in payload["by_type"]}
    assert by_type["one_time"]["count"] == 1
    assert by_type["subscription"]["count"] == 1


@pytest.mark.anyio
async def test_admin_attendance_stats(client, db_session):
    _, admin_token = await _create_user(db_session, UserRole.ADMIN)
    cook, cook_token = await _create_user(db_session, UserRole.COOK)
    student, student_token = await _create_user(db_session, UserRole.STUDENT)

    dish_id = await _create_dish(client, cook_token)
    target_date = date(2025, 2, 10)
    menu_id = await _create_menu(client, cook_token, dish_id, target_date)

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

    stats_response = await client.get(
        f"/admin/stats/attendance?date_from={target_date.isoformat()}&date_to={target_date.isoformat()}",
        headers=_auth_headers(admin_token),
    )
    assert stats_response.status_code == 200
    payload = stats_response.json()
    assert payload["total_count"] == 1
    by_status = {item["status"]: item for item in payload["by_status"]}
    assert by_status["confirmed"]["count"] == 1


@pytest.mark.anyio
async def test_admin_stats_access_denied_for_student(client, db_session):
    _, student_token = await _create_user(db_session, UserRole.STUDENT)

    response = await client.get(
        "/admin/stats/payments",
        headers=_auth_headers(student_token),
    )
    assert response.status_code == 403

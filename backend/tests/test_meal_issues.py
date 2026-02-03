import uuid
from datetime import date

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
async def test_meal_issue_flow_with_cook_and_student(client, db_session):
    cook, cook_token = await _create_user(db_session, UserRole.COOK)
    student, student_token = await _create_user(db_session, UserRole.STUDENT)

    menu_id = await _create_menu(client, cook_token, date(2025, 2, 1), remaining_qty=1)

    payment_response = await client.post(
        "/payments/one-time",
        headers=_auth_headers(student_token),
        json={"menu_id": menu_id},
    )
    assert payment_response.status_code == 201

    serve_response = await client.post(
        "/meal-issues/serve",
        headers=_auth_headers(cook_token),
        json={"user_id": student.id, "menu_id": menu_id},
    )
    assert serve_response.status_code == 201
    assert serve_response.json()["status"] == "issued"

    menu_response = await client.get(
        f"/menus/{menu_id}",
        headers=_auth_headers(student_token),
    )
    assert menu_response.status_code == 200
    assert menu_response.json()["menu_items"][0]["remaining_qty"] == 0

    confirm_response = await client.post(
        "/meal-issues/me",
        headers=_auth_headers(student_token),
        json={"menu_id": menu_id},
    )
    assert confirm_response.status_code == 200
    payload = confirm_response.json()
    assert payload["status"] == "confirmed"
    assert payload["served_by_id"] == cook.id

    repeat_response = await client.post(
        "/meal-issues/me",
        headers=_auth_headers(student_token),
        json={"menu_id": menu_id},
    )
    assert repeat_response.status_code == 400


@pytest.mark.anyio
async def test_meal_issue_fails_when_no_remaining_qty(client, db_session):
    _, cook_token = await _create_user(db_session, UserRole.COOK)
    student, student_token = await _create_user(db_session, UserRole.STUDENT)

    menu_id = await _create_menu(client, cook_token, date(2025, 2, 2), remaining_qty=0)

    payment_response = await client.post(
        "/payments/one-time",
        headers=_auth_headers(student_token),
        json={"menu_id": menu_id},
    )
    assert payment_response.status_code == 201

    serve_response = await client.post(
        "/meal-issues/serve",
        headers=_auth_headers(cook_token),
        json={"user_id": student.id, "menu_id": menu_id},
    )
    assert serve_response.status_code == 400
    assert serve_response.json()["detail"] == "Not enough menu items to issue meal"


@pytest.mark.anyio
async def test_meal_issue_fails_without_payment(client, db_session):
    _, cook_token = await _create_user(db_session, UserRole.COOK)
    student, _ = await _create_user(db_session, UserRole.STUDENT)

    menu_id = await _create_menu(client, cook_token, date(2025, 2, 4), remaining_qty=1)

    serve_response = await client.post(
        "/meal-issues/serve",
        headers=_auth_headers(cook_token),
        json={"user_id": student.id, "menu_id": menu_id},
    )
    assert serve_response.status_code == 400
    assert serve_response.json()["detail"] == "Meal is not paid"


@pytest.mark.anyio
async def test_student_cannot_confirm_without_issue(client, db_session):
    _, cook_token = await _create_user(db_session, UserRole.COOK)
    _, student_token = await _create_user(db_session, UserRole.STUDENT)

    menu_id = await _create_menu(client, cook_token, date(2025, 2, 3), remaining_qty=1)

    response = await client.post(
        "/meal-issues/me",
        headers=_auth_headers(student_token),
        json={"menu_id": menu_id},
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "Meal not issued yet"

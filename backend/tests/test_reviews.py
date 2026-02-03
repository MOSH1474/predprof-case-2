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


async def _create_dish(client, token: str) -> int:
    response = await client.post(
        "/dishes/",
        headers=_auth_headers(token),
        json={"name": f"Dish {uuid.uuid4()}", "description": "Tasty"},
    )
    assert response.status_code == 201
    return response.json()["id"]


async def _create_menu(client, token: str, dish_id: int) -> int:
    response = await client.post(
        "/menus/",
        headers=_auth_headers(token),
        json={
            "menu_date": date(2025, 2, 1).isoformat(),
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
async def test_student_can_create_review(client, db_session):
    _, cook_token = await _create_user(db_session, UserRole.COOK)
    student, student_token = await _create_user(db_session, UserRole.STUDENT)

    dish_id = await _create_dish(client, cook_token)
    menu_id = await _create_menu(client, cook_token, dish_id)

    create_response = await client.post(
        "/reviews/",
        headers=_auth_headers(student_token),
        json={
            "dish_id": dish_id,
            "menu_id": menu_id,
            "rating": 5,
            "comment": "Great meal",
        },
    )
    assert create_response.status_code == 201
    payload = create_response.json()
    assert payload["user_id"] == student.id
    assert payload["dish_id"] == dish_id
    assert payload["menu_id"] == menu_id
    assert payload["rating"] == 5

    list_response = await client.get(
        f"/reviews/?dish_id={dish_id}",
        headers=_auth_headers(student_token),
    )
    assert list_response.status_code == 200
    items = list_response.json()["items"]
    assert any(item["id"] == payload["id"] for item in items)


@pytest.mark.anyio
async def test_cook_cannot_create_review(client, db_session):
    _, cook_token = await _create_user(db_session, UserRole.COOK)
    dish_id = await _create_dish(client, cook_token)

    response = await client.post(
        "/reviews/",
        headers=_auth_headers(cook_token),
        json={"dish_id": dish_id, "rating": 4},
    )
    assert response.status_code == 403

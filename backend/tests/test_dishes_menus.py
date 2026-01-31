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


@pytest.mark.anyio
async def test_cook_can_crud_dish(client, db_session):
    _, token = await _create_user(db_session, UserRole.COOK)

    create_response = await client.post(
        "/dishes/",
        headers=_auth_headers(token),
        json={"name": f"Dish {uuid.uuid4()}", "description": "Init", "is_active": True},
    )
    assert create_response.status_code == 201
    created = create_response.json()
    dish_id = created["id"]

    update_response = await client.put(
        f"/dishes/{dish_id}",
        headers=_auth_headers(token),
        json={"description": "Updated"},
    )
    assert update_response.status_code == 200
    assert update_response.json()["description"] == "Updated"

    get_response = await client.get(
        f"/dishes/{dish_id}",
        headers=_auth_headers(token),
    )
    assert get_response.status_code == 200
    assert get_response.json()["id"] == dish_id

    delete_response = await client.delete(
        f"/dishes/{dish_id}",
        headers=_auth_headers(token),
    )
    assert delete_response.status_code == 204

    get_response = await client.get(
        f"/dishes/{dish_id}",
        headers=_auth_headers(token),
    )
    assert get_response.status_code == 404


@pytest.mark.anyio
async def test_student_cannot_create_dish(client, db_session):
    _, token = await _create_user(db_session, UserRole.STUDENT)

    response = await client.post(
        "/dishes/",
        headers=_auth_headers(token),
        json={"name": f"Dish {uuid.uuid4()}", "description": "Init"},
    )
    assert response.status_code == 403


@pytest.mark.anyio
async def test_menu_flow_with_dishes(client, db_session):
    _, cook_token = await _create_user(db_session, UserRole.COOK)
    _, student_token = await _create_user(db_session, UserRole.STUDENT)

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
            "menu_date": date(2025, 1, 1).isoformat(),
            "meal_type": "breakfast",
            "title": "Breakfast",
            "price": "120.00",
            "items": [
                {
                    "dish_id": dish_id,
                    "portion_size": "250.00",
                    "planned_qty": 50,
                    "remaining_qty": 50,
                }
            ],
        },
    )
    assert menu_response.status_code == 201
    menu_payload = menu_response.json()
    menu_id = menu_payload["id"]

    list_response = await client.get(
        "/menus/?meal_type=breakfast",
        headers=_auth_headers(student_token),
    )
    assert list_response.status_code == 200
    items = list_response.json()["items"]
    assert any(item["id"] == menu_id for item in items)

    get_response = await client.get(
        f"/menus/{menu_id}",
        headers=_auth_headers(student_token),
    )
    assert get_response.status_code == 200
    payload = get_response.json()
    assert payload["meal_type"] == "breakfast"
    assert payload["menu_items"][0]["dish"]["id"] == dish_id

    forbidden_response = await client.post(
        "/menus/",
        headers=_auth_headers(student_token),
        json={
            "menu_date": date(2025, 1, 2).isoformat(),
            "meal_type": "lunch",
            "items": [{"dish_id": dish_id}],
        },
    )
    assert forbidden_response.status_code == 403

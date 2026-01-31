import uuid

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
async def test_allergies_list_returns_items(client, db_session):
    _, token = await _create_user(db_session, UserRole.STUDENT)

    response = await client.get("/allergies/", headers=_auth_headers(token))
    assert response.status_code == 200
    payload = response.json()
    assert "items" in payload
    assert isinstance(payload["items"], list)


@pytest.mark.anyio
async def test_student_cannot_create_allergy(client, db_session):
    _, token = await _create_user(db_session, UserRole.STUDENT)

    response = await client.post(
        "/allergies/",
        headers=_auth_headers(token),
        json={"name": f"Allergy {uuid.uuid4()}", "description": "test"},
    )
    assert response.status_code == 403


@pytest.mark.anyio
async def test_admin_can_crud_allergy(client, db_session):
    _, token = await _create_user(db_session, UserRole.ADMIN)

    create_response = await client.post(
        "/allergies/",
        headers=_auth_headers(token),
        json={"name": f"Allergy {uuid.uuid4()}", "description": "init"},
    )
    assert create_response.status_code == 201
    created = create_response.json()
    allergy_id = created["id"]

    update_response = await client.put(
        f"/allergies/{allergy_id}",
        headers=_auth_headers(token),
        json={"name": f"Allergy {uuid.uuid4()}", "description": "updated"},
    )
    assert update_response.status_code == 200
    assert update_response.json()["description"] == "updated"

    delete_response = await client.delete(
        f"/allergies/{allergy_id}",
        headers=_auth_headers(token),
    )
    assert delete_response.status_code == 204

    get_response = await client.get(
        f"/allergies/{allergy_id}",
        headers=_auth_headers(token),
    )
    assert get_response.status_code == 404


@pytest.mark.anyio
async def test_student_can_update_preferences_with_allergies(client, db_session):
    _, admin_token = await _create_user(db_session, UserRole.ADMIN)
    student, student_token = await _create_user(db_session, UserRole.STUDENT)

    allergy_response = await client.post(
        "/allergies/",
        headers=_auth_headers(admin_token),
        json={"name": f"Allergy {uuid.uuid4()}", "description": "test"},
    )
    assert allergy_response.status_code == 201
    allergy_id = allergy_response.json()["id"]

    update_response = await client.put(
        "/preferences/me",
        headers=_auth_headers(student_token),
        json={"dietary_preferences": "No fish", "allergy_ids": [allergy_id]},
    )
    assert update_response.status_code == 200
    payload = update_response.json()
    assert payload["dietary_preferences"] == "No fish"
    assert [item["id"] for item in payload["allergies"]] == [allergy_id]

    get_response = await client.get(
        "/preferences/me",
        headers=_auth_headers(student_token),
    )
    assert get_response.status_code == 200
    payload = get_response.json()
    assert payload["dietary_preferences"] == "No fish"
    assert [item["id"] for item in payload["allergies"]] == [allergy_id]

    assert student.id is not None


@pytest.mark.anyio
async def test_cook_forbidden_from_preferences(client, db_session):
    _, token = await _create_user(db_session, UserRole.COOK)

    response = await client.get("/preferences/me", headers=_auth_headers(token))
    assert response.status_code == 403

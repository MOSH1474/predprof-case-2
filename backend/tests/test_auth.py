import uuid

import pytest


@pytest.mark.anyio
async def test_register_login_me(client):
    email = f"user-{uuid.uuid4()}@example.com"
    password = "TestPass123!"

    register_response = await client.post(
        "/auth/register",
        json={
            "email": email,
            "password": password,
            "full_name": "Test User",
        },
    )
    assert register_response.status_code == 201
    registered = register_response.json()
    assert registered["email"] == email
    assert registered["role"] == "student"

    login_response = await client.post(
        "/auth/login",
        data={
            "username": email,
            "password": password,
        },
    )
    assert login_response.status_code == 200
    token_payload = login_response.json()
    assert "access_token" in token_payload

    me_response = await client.get(
        "/auth/me",
        headers={"Authorization": f"Bearer {token_payload['access_token']}"},
    )
    assert me_response.status_code == 200
    me = me_response.json()
    assert me["email"] == email

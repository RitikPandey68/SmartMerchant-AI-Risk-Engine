import pytest

def test_read_root(client):
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["status"] == "online"

def test_auth_and_onboarding(client):
    # 1. Register auditor user
    reg_response = client.post("/api/auth/register", json={
        "username": "test_auditor",
        "password": "testpassword123",
        "role": "auditor"
    })
    assert reg_response.status_code == 200
    assert reg_response.json()["username"] == "test_auditor"

    # 2. Login token
    login_response = client.post("/api/auth/token", data={
        "username": "test_auditor",
        "password": "testpassword123"
      }
    )
    assert login_response.status_code == 200
    token = login_response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 3. Submit onboarding
    onboarding_response = client.post("/api/onboarding", json={
        "business_name": "Test Enterprise Ltd",
        "business_email": "hello@testenterprise.com",
        "business_website": "https://testenterprise.com",
        "business_type": "SaaS",
        "registration_number": "TAX-12345-TEST",
        "owner_name": "Dave Smith",
        "owner_email": "dave@testenterprise.com",
        "phone": "+1-234-567-8900"
    })
    assert onboarding_response.status_code == 201
    merchant_id = onboarding_response.json()["merchant"]["id"]
    assert merchant_id is not None

    # 4. Fetch merchants lists with auth
    list_response = client.get("/api/merchants", headers=headers)
    assert list_response.status_code == 200
    merchants = list_response.json()
    assert len(merchants) > 0
    assert merchants[0]["business_name"] == "Test Enterprise Ltd"

    # 5. Manual override status
    override_response = client.post(
        f"/api/merchants/{merchant_id}/override",
        headers=headers,
        json={
            "action": "MANUAL_APPROVE",
            "notes": "Verified offline registration certificates directly with government agency."
        }
    )
    assert override_response.status_code == 200
    assert override_response.json()["status"] == "APPROVED"

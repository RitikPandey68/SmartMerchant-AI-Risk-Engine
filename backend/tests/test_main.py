import pytest

def test_read_root(client):
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["status"] == "online"

def test_website_autofill(client):
    response = client.post("/api/onboarding/autofill", json={
        "url": "https://stripe.com"
    })
    assert response.status_code == 200
    data = response.json()
    assert "business_name" in data
    assert "business_email" in data

def test_compliance_rules(client):
    # 1. Login to get token
    login_response = client.post("/api/auth/token", data={
        "username": "auditor",
        "password": "password123"
    })
    assert login_response.status_code == 200
    token = login_response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Get rules
    rules_response = client.get("/api/compliance/rules", headers=headers)
    assert rules_response.status_code == 200
    rules = rules_response.json()
    assert len(rules) > 0
    assert any(r["rule_key"] == "STRICT_NAME_MATCH" for r in rules)

    # 3. Update a rule
    update_response = client.post(
        "/api/compliance/rules",
        headers=headers,
        json={"rule_key": "REQUIRE_SSL", "value_bool": False}
    )
    assert update_response.status_code == 200
    assert update_response.json()["rule"]["value_bool"] is False

def test_onboarding_pipeline_and_duplicate(client):
    # 1. Login auditor
    login_response = client.post("/api/auth/token", data={
        "username": "auditor",
        "password": "password123"
    })
    token = login_response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Submit first onboarding
    onboarding_response1 = client.post("/api/onboarding", json={
        "business_name": "Unique Corporation LLC",
        "business_email": "compliance@uniquecorp.com",
        "business_website": "https://uniquecorp.com",
        "business_type": "SaaS",
        "registration_number": "GSTIN27ABCDE1234A", # Valid format
        "owner_name": "Alice Peterson",
        "owner_email": "alice@uniquecorp.com",
        "phone": "+1-888-232-1100"
    })
    assert onboarding_response1.status_code == 201
    m1_id = onboarding_response1.json()["merchant"]["id"]

    # 3. Submit second onboarding with same registration number (Expected duplicate flag)
    onboarding_response2 = client.post("/api/onboarding", json={
        "business_name": "Clone Systems Ltd",
        "business_email": "clone@uniquecorp.com",
        "business_website": "https://clonecorp.com",
        "business_type": "SaaS",
        "registration_number": "GSTIN27ABCDE1234A", # Same Tax ID!
        "owner_name": "Fraud Person",
        "owner_email": "fraud@clonecorp.com",
        "phone": "+1-888-232-2200"
    })
    assert onboarding_response2.status_code == 201
    m2_id = onboarding_response2.json()["merchant"]["id"]
    
    # 4. Check list to verify both exist
    list_response = client.get("/api/merchants", headers=headers)
    assert list_response.status_code == 200
    merchants = list_response.json()
    assert any(m["id"] == m1_id for m in merchants)
    assert any(m["id"] == m2_id for m in merchants)

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from unittest.mock import patch, MagicMock
from app.database import Base, get_db
from app.main import app

# In-memory SQLite for testing
SQLALCHEMY_DATABASE_URL = "sqlite:///./test.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(autouse=True)
def mock_celery():
    with patch("app.routes.onboarding.process_merchant_verification.delay") as mock_verify, \
         patch("app.worker.dispatch_webhooks.delay") as mock_wh:
        mock_verify.return_value = MagicMock(id="mock-task-id-123")
        mock_wh.return_value = MagicMock(id="mock-wh-id-123")
        yield

@pytest.fixture(scope="module")
def db():
    Base.metadata.create_all(bind=engine)
    db_session = TestingSessionLocal()
    try:
        from app.models import User, ComplianceRule
        from app.routes.auth import get_password_hash
        
        existing_user = db_session.query(User).filter(User.username == "auditor").first()
        if not existing_user:
            hashed_pw = get_password_hash("password123")
            admin_user = User(
                username="auditor",
                hashed_password=hashed_pw,
                role="auditor"
            )
            db_session.add(admin_user)
        
        rules = [
            {"key": "STRICT_NAME_MATCH", "val": True, "desc": "Require document brand names to match state registries."},
            {"key": "REQUIRE_SSL", "val": True, "desc": "Flag website reviews if SSL/TLS is missing."},
            {"key": "REJECT_PROHIBITED_CONTENT", "val": True, "desc": "Auto-reject if website crawls contain gambling/adult terms."},
            {"key": "PREVENT_DUPLICATE_TAX_ID", "val": True, "desc": "Block onboarding if Registration ID is already in use."},
            {"key": "PREVENT_DUPLICATE_PHONE", "val": True, "desc": "Auto-flag onboarding if Owner Phone is already in use."}
        ]
        for r in rules:
            existing_rule = db_session.query(ComplianceRule).filter(ComplianceRule.rule_key == r["key"]).first()
            if not existing_rule:
                rule = ComplianceRule(
                    rule_key=r["key"],
                    value_bool=r["val"],
                    description=r["desc"]
                )
                db_session.add(rule)
        db_session.commit()
        
        yield db_session
    finally:
        db_session.close()
        Base.metadata.drop_all(bind=engine)

@pytest.fixture(scope="module")
def client(db):
    def override_get_db():
        try:
            yield db
        finally:
            pass
            
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()

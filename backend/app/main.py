import asyncio
import json
import logging
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import redis.asyncio as aioredis
from contextlib import asynccontextmanager

from app.config import settings
from app.database import engine, Base, SessionLocal
from app.models import User, ComplianceRule
from app.routes.auth import router as auth_router, get_password_hash
from app.routes.onboarding import router as onboarding_router
from app.ws import manager

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("main")

# Automatically initialize database schema
Base.metadata.create_all(bind=engine)

# Seed initial Auditor user if database is empty
def seed_initial_user():
    db = SessionLocal()
    try:
        existing = db.query(User).filter(User.username == "auditor").first()
        if not existing:
            hashed_pw = get_password_hash("password123")
            admin_user = User(
                username="auditor",
                hashed_password=hashed_pw,
                role="auditor"
            )
            db.add(admin_user)
            db.commit()
            logger.info("Successfully seeded default auditor account. Username: 'auditor', Password: 'password123'.")
    except Exception as e:
        logger.error(f"Error seeding user: {e}")
    finally:
        db.close()

# Seed default global compliance rules
def seed_compliance_rules():
    db = SessionLocal()
    try:
        rules = [
            {"key": "STRICT_NAME_MATCH", "val": True, "desc": "Require document brand names to match state registries."},
            {"key": "REQUIRE_SSL", "val": True, "desc": "Flag website reviews if SSL/TLS is missing."},
            {"key": "REJECT_PROHIBITED_CONTENT", "val": True, "desc": "Auto-reject if website crawls contain gambling/adult terms."},
            {"key": "PREVENT_DUPLICATE_TAX_ID", "val": True, "desc": "Block onboarding if Registration ID is already in use."},
            {"key": "PREVENT_DUPLICATE_PHONE", "val": True, "desc": "Auto-flag onboarding if Owner Phone is already in use."}
        ]
        for r in rules:
            existing = db.query(ComplianceRule).filter(ComplianceRule.rule_key == r["key"]).first()
            if not existing:
                rule = ComplianceRule(
                    rule_key=r["key"],
                    value_bool=r["val"],
                    description=r["desc"]
                )
                db.add(rule)
        db.commit()
        logger.info("Successfully seeded default global compliance rules.")
    except Exception as e:
        logger.error(f"Error seeding compliance rules: {e}")
    finally:
        db.close()

seed_initial_user()
seed_compliance_rules()

# Background task to listen to Celery updates via Redis Pub/Sub
async def redis_pubsub_listener():
    logger.info("Starting background Redis Pub/Sub listener...")
    r = aioredis.from_url(settings.REDIS_URL)
    pubsub = r.pubsub()
    await pubsub.subscribe("smartmerchant:updates")
    
    try:
        while True:
            message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
            if message:
                try:
                    payload = json.loads(message['data'].decode('utf-8'))
                    merchant_id = payload.get("merchant_id")
                    await manager.broadcast_to_channel(f"merchant_{merchant_id}", payload)
                except Exception as ex:
                    logger.error(f"Error parsing Redis Pub/Sub event: {ex}")
            await asyncio.sleep(0.1)
    except asyncio.CancelledError:
        logger.info("Redis listener task cancelled.")
    except Exception as e:
        logger.error(f"Error in Redis listener thread: {e}")
    finally:
        await pubsub.unsubscribe("smartmerchant:updates")
        await r.close()

# Lifespan Context Manager
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup tasks
    listener_task = asyncio.create_task(redis_pubsub_listener())
    yield
    # Shutdown tasks
    listener_task.cancel()
    try:
        await listener_task
    except asyncio.CancelledError:
        pass

app = FastAPI(
    title=settings.PROJECT_NAME,
    lifespan=lifespan
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routes
app.include_router(auth_router)
app.include_router(onboarding_router)

# Root Endpoint
@app.get("/")
def read_root():
    return {
        "status": "online",
        "service": "SmartMerchant AI Onboarding & Risk Engine API",
        "sandbox_credentials": {
            "username": "auditor",
            "password": "password123"
        }
    }

# WebSockets status endpoint
@app.websocket("/ws/status/{channel}")
async def websocket_status_endpoint(websocket: WebSocket, channel: str):
    await manager.connect(websocket, channel)
    try:
        while True:
            data = await websocket.receive_text()
            await websocket.send_text(json.dumps({"ping": "pong", "received": data}))
    except WebSocketDisconnect:
        manager.disconnect(websocket, channel)
    except Exception as e:
        logger.error(f"Error in WebSocket channel {channel}: {e}")
        manager.disconnect(websocket, channel)

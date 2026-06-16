import os
import json
import logging
import requests
from celery import Celery
from sqlalchemy.orm import Session
from datetime import datetime
import redis

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("celery_worker")

REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
celery_app = Celery("tasks", broker=REDIS_URL, backend=REDIS_URL)

from app.database import SessionLocal
from app.config import settings
from app.models import Merchant, VerificationReport, AgentLog, AuditTrail, WebhookConfig, ComplianceRule
from app.agents.crew import run_agent_pipeline

r_client = redis.Redis.from_url(REDIS_URL)

def publish_ws_update(merchant_id: int, event_type: str, data: dict):
    payload = {
        "merchant_id": merchant_id,
        "type": event_type,
        "data": data,
        "timestamp": datetime.utcnow().isoformat()
    }
    r_client.publish("smartmerchant:updates", json.dumps(payload))

@celery_app.task(name="app.worker.process_merchant_verification")
def process_merchant_verification(merchant_id: int):
    logger.info(f"Starting verification task for merchant ID: {merchant_id}")
    db: Session = SessionLocal()
    
    try:
        merchant = db.query(Merchant).filter(Merchant.id == merchant_id).first()
        if not merchant:
            logger.error(f"Merchant {merchant_id} not found.")
            return False
        
        # Reset artifacts
        db.query(VerificationReport).filter(VerificationReport.merchant_id == merchant_id).delete()
        db.query(AgentLog).filter(AgentLog.merchant_id == merchant_id).delete()
        db.commit()

        # Update status
        merchant.status = "PROCESSING"
        db.commit()

        # Log system trigger
        system_audit = AuditTrail(
            merchant_id=merchant_id,
            action="SYSTEM_INIT",
            notes="Automatic AI-native onboarding verification triggered.",
            timestamp=datetime.utcnow()
        )
        db.add(system_audit)
        db.commit()

        # Callbacks
        def log_callback(agent_name: str, log_level: str, message: str):
            log_entry = AgentLog(
                merchant_id=merchant_id,
                agent_name=agent_name,
                log_level=log_level,
                message=message,
                timestamp=datetime.utcnow()
            )
            db.add(log_entry)
            db.commit()

            publish_ws_update(merchant_id, "LOG", {
                "agent_name": agent_name,
                "log_level": log_level,
                "message": message,
                "timestamp": log_entry.timestamp.isoformat()
            })
            logger.info(f"[{agent_name}] {log_level}: {message}")

        def status_callback(step: str):
            merchant.status = step
            db.commit()
            publish_ws_update(merchant_id, "STATUS", {"status": step})
            logger.info(f"Merchant {merchant_id} status updated to: {step}")

        # Fetch active compliance rules configuration
        db_rules = db.query(ComplianceRule).all()
        rules_config = {r.rule_key: r.value_bool for r in db_rules}
        
        # Duplicate checks (Sybil detection)
        duplicate_detected = False
        duplicate_fields = []
        
        # Search for other merchants matching key identities
        existing_matches = db.query(Merchant).filter(
            (Merchant.id != merchant_id) & (
                (Merchant.registration_number == merchant.registration_number) |
                (Merchant.phone == merchant.phone) |
                (Merchant.business_email == merchant.business_email) |
                (Merchant.owner_email == merchant.owner_email)
            )
        ).all()
        
        if existing_matches:
            for em in existing_matches:
                if em.registration_number == merchant.registration_number and rules_config.get("PREVENT_DUPLICATE_TAX_ID"):
                    duplicate_detected = True
                    duplicate_fields.append("Tax Registration Number")
                if em.phone == merchant.phone and rules_config.get("PREVENT_DUPLICATE_PHONE"):
                    duplicate_detected = True
                    duplicate_fields.append("Owner Phone Number")
                if em.business_email == merchant.business_email or em.owner_email == merchant.owner_email:
                    duplicate_detected = True
                    duplicate_fields.append("Corporate Email Address")
                    
                # Flag the duplicate match record as well to prevent collusion
                if em.status == "APPROVED":
                    em.status = "FLAGGED"
                    collusion_audit = AuditTrail(
                        merchant_id=em.id,
                        action="SYSTEM_FLAG",
                        notes=f"Flagged due to duplicate matching details submitted by incoming merchant ID: {merchant_id}.",
                        timestamp=datetime.utcnow()
                    )
                    db.add(collusion_audit)
                    db.commit()

        # Run pipeline
        merchant_dict = {
            "business_name": merchant.business_name,
            "business_email": merchant.business_email,
            "business_website": merchant.business_website,
            "business_type": merchant.business_type,
            "registration_number": merchant.registration_number,
            "owner_name": merchant.owner_name,
            "owner_email": merchant.owner_email,
            "phone": merchant.phone
        }
        
        # Run mult-agent assessment
        result = run_agent_pipeline(
            merchant_dict, log_callback, status_callback, 
            rules=rules_config, duplicate_match=duplicate_detected
        )
        
        # Write report
        report = VerificationReport(
            merchant_id=merchant_id,
            risk_score=result["risk_score"],
            risk_category=result["risk_category"],
            extracted_data=result["extracted_data"],
            website_audit=result["website_audit"],
            kyb_verification=result["kyb_verification"],
            risk_factors=result["risk_factors"],
            routing_processor=result["routing_processor"],
            routing_fee=result["routing_fee"],
            agent_summary=result["agent_summary"]
        )
        db.add(report)
        
        # Set final status based on risk
        if result["risk_category"] == "LOW":
            merchant.status = "APPROVED"
            action_name = "SYSTEM_APPROVE"
            notes = "Auto-approved by risk engine (Low Risk)."
        elif result["risk_category"] == "MEDIUM":
            merchant.status = "FLAGGED"
            action_name = "SYSTEM_FLAG"
            notes = "Flagged for manual review (Medium Risk)."
        else:
            merchant.status = "REJECTED"
            action_name = "SYSTEM_REJECT"
            notes = "Auto-rejected by risk engine (High Risk)."
            
        if duplicate_detected:
            merchant.status = "REJECTED"
            action_name = "SYSTEM_REJECT"
            notes = f"Auto-rejected due to multi-accounting / sybil fraud check matching duplicate details: {', '.join(duplicate_fields)}."

        db.commit()

        # Log audit entry
        final_audit = AuditTrail(
            merchant_id=merchant_id,
            action=action_name,
            notes=notes,
            timestamp=datetime.utcnow()
        )
        db.add(final_audit)
        db.commit()

        # Broadcast completion
        publish_ws_update(merchant_id, "COMPLETED", {
            "status": merchant.status,
            "risk_score": report.risk_score,
            "risk_category": report.risk_category,
            "routing_processor": report.routing_processor,
            "routing_fee": report.routing_fee,
            "agent_summary": report.agent_summary
        })

        dispatch_webhooks.delay(merchant_id)
        logger.info(f"Verification complete for merchant {merchant_id}. Outcome: {merchant.status}")
        return True

    except Exception as e:
        logger.exception(f"Unhandled error verifying merchant {merchant_id}: {e}")
        db.rollback()
        
        # Halt engine, update to FLAGGED, prevent guess status success
        try:
            merchant = db.query(Merchant).filter(Merchant.id == merchant_id).first()
            if merchant:
                merchant.status = "FLAGGED"
                error_audit = AuditTrail(
                    merchant_id=merchant_id,
                    action="SYSTEM_FLAG",
                    notes=f"Halted pipeline due to verification error: {str(e)}",
                    timestamp=datetime.utcnow()
                )
                db.add(error_audit)
                db.commit()
        except Exception as ex:
            logger.error(f"Failed to fail-soft flag merchant: {ex}")
            
        publish_ws_update(merchant_id, "ERROR", {"message": str(e)})
        return False
    finally:
        db.close()

@celery_app.task(name="app.worker.dispatch_webhooks")
def dispatch_webhooks(merchant_id: int):
    logger.info(f"Dispatching webhooks for merchant {merchant_id}")
    db: Session = SessionLocal()
    try:
        merchant = db.query(Merchant).filter(Merchant.id == merchant_id).first()
        if not merchant or not merchant.report:
            logger.error("Cannot dispatch webhook, merchant/report data incomplete.")
            return False

        payload = {
            "event": "merchant.verification.completed",
            "merchant": {
                "id": merchant.id,
                "business_name": merchant.business_name,
                "business_email": merchant.business_email,
                "status": merchant.status,
            },
            "report": {
                "risk_score": merchant.report.risk_score,
                "risk_category": merchant.report.risk_category,
                "routing_processor": merchant.report.routing_processor,
                "routing_fee": merchant.report.routing_fee,
                "agent_summary": merchant.report.agent_summary
            },
            "timestamp": datetime.utcnow().isoformat()
        }

        webhooks = db.query(WebhookConfig).filter(WebhookConfig.is_active == True).all()
        for wh in webhooks:
            try:
                headers = {
                    "Content-Type": "application/json",
                    "X-SmartMerchant-Signature": wh.secret
                }
                requests.post(
                    wh.url,
                    json=payload,
                    headers=headers,
                    timeout=settings.WEBHOOK_TIMEOUT
                )
            except Exception as ex:
                logger.warning(f"Failed to deliver webhook to {wh.url}: {ex}")

        return True
    finally:
        db.close()

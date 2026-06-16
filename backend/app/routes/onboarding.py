from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
import uuid
import logging

from app.database import get_db
from app.models import Merchant, VerificationReport, AgentLog, WebhookConfig, AuditTrail, User
from app.schemas import (
    MerchantCreate, MerchantOut, OnboardingResponse, 
    AuditTrailCreate, AuditTrailOut, WebhookConfigCreate, WebhookConfigOut
)
from app.routes.auth import get_current_auditor
from app.worker import process_merchant_verification

logger = logging.getLogger("routes_onboarding")
router = APIRouter(tags=["Merchant Onboarding & Risk"])

@router.post("/api/onboarding", response_model=OnboardingResponse, status_code=201)
def submit_onboarding(merchant_in: MerchantCreate, db: Session = Depends(get_db)):
    """Public endpoint for merchants to submit onboarding details."""
    try:
        # Create merchant entry
        merchant = Merchant(
            business_name=merchant_in.business_name,
            business_email=merchant_in.business_email,
            business_website=merchant_in.business_website,
            business_type=merchant_in.business_type,
            registration_number=merchant_in.registration_number,
            owner_name=merchant_in.owner_name,
            owner_email=merchant_in.owner_email,
            phone=merchant_in.phone,
            status="PENDING"
        )
        db.add(merchant)
        db.commit()
        db.refresh(merchant)
        
        # Trigger async verification task via Celery
        task = process_merchant_verification.delay(merchant.id)
        logger.info(f"Triggered background verification for merchant: {merchant.id} task: {task.id}")
        
        return {
            "merchant": merchant,
            "message": "Onboarding submitted successfully. KYB risk verification is running in the background."
        }
    except Exception as e:
        logger.exception(f"Error submitting onboarding: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error executing onboarding.")

@router.get("/api/merchants", response_model=List[MerchantOut])
def list_merchants(
    status_filter: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    auditor: User = Depends(get_current_auditor)
):
    """Fetch all merchants with status/search filtering (Auditors only)."""
    # Join load to avoid N+1 queries
    query = db.query(Merchant).options(
        joinedload(Merchant.report),
        joinedload(Merchant.logs),
        joinedload(Merchant.audit_trails).joinedload(AuditTrail.user)
    )
    
    if status_filter:
        query = query.filter(Merchant.status == status_filter)
        
    if search:
        query = query.filter(
            (Merchant.business_name.ilike(f"%{search}%")) |
            (Merchant.registration_number.ilike(f"%{search}%")) |
            (Merchant.business_email.ilike(f"%{search}%"))
        )
        
    merchants = query.order_by(Merchant.created_at.desc()).all()
    return merchants

@router.get("/api/merchants/{merchant_id}", response_model=MerchantOut)
def get_merchant(
    merchant_id: int,
    db: Session = Depends(get_db),
    auditor: User = Depends(get_current_auditor)
):
    """Retrieve details for a single merchant (Auditors only)."""
    merchant = db.query(Merchant).options(
        joinedload(Merchant.report),
        joinedload(Merchant.logs),
        joinedload(Merchant.audit_trails).joinedload(AuditTrail.user)
    ).filter(Merchant.id == merchant_id).first()
    
    if not merchant:
        raise HTTPException(status_code=404, detail="Merchant profile not found.")
    return merchant

@router.post("/api/merchants/{merchant_id}/override", response_model=MerchantOut)
def override_merchant_status(
    merchant_id: int,
    override: AuditTrailCreate,
    db: Session = Depends(get_db),
    auditor: User = Depends(get_current_auditor)
):
    """Manually override verification outcome (Approve / Reject / Flag) (Auditors only)."""
    merchant = db.query(Merchant).filter(Merchant.id == merchant_id).first()
    if not merchant:
        raise HTTPException(status_code=404, detail="Merchant profile not found.")
        
    valid_actions = ["MANUAL_APPROVE", "MANUAL_REJECT", "MANUAL_FLAG"]
    if override.action not in valid_actions:
        raise HTTPException(status_code=400, detail=f"Invalid override action. Must be one of: {valid_actions}")
        
    # Update status
    if override.action == "MANUAL_APPROVE":
        merchant.status = "APPROVED"
    elif override.action == "MANUAL_REJECT":
        merchant.status = "REJECTED"
    else:
        merchant.status = "FLAGGED"
        
    # Log audit entry
    audit = AuditTrail(
        merchant_id=merchant_id,
        user_id=auditor.id,
        action=override.action,
        notes=override.notes,
        timestamp=datetime.utcnow()
    )
    db.add(audit)
    db.commit()
    db.refresh(merchant)
    
    # Trigger client webhook because status changed
    from app.worker import dispatch_webhooks
    dispatch_webhooks.delay(merchant.id)
    
    logger.info(f"Auditor {auditor.username} manually changed merchant {merchant.id} to {merchant.status}")
    return merchant

# Webhooks
@router.get("/api/webhooks", response_model=List[WebhookConfigOut])
def get_webhooks(db: Session = Depends(get_db), auditor: User = Depends(get_current_auditor)):
    return db.query(WebhookConfig).order_by(WebhookConfig.created_at.desc()).all()

@router.post("/api/webhooks", response_model=WebhookConfigOut)
def register_webhook(
    webhook_in: WebhookConfigCreate,
    db: Session = Depends(get_db),
    auditor: User = Depends(get_current_auditor)
):
    wh = WebhookConfig(
        url=webhook_in.url,
        secret=str(uuid.uuid4()),  # Auto-generate a signing key
        is_active=webhook_in.is_active
    )
    db.add(wh)
    db.commit()
    db.refresh(wh)
    return wh

@router.delete("/api/webhooks/{webhook_id}", status_code=204)
def delete_webhook(
    webhook_id: int,
    db: Session = Depends(get_db),
    auditor: User = Depends(get_current_auditor)
):
    wh = db.query(WebhookConfig).filter(WebhookConfig.id == webhook_id).first()
    if not wh:
        raise HTTPException(status_code=404, detail="Webhook not found.")
    db.delete(wh)
    db.commit()
    return None

# Audit Logs
@router.get("/api/audit", response_model=List[AuditTrailOut])
def list_audit_trail(db: Session = Depends(get_db), auditor: User = Depends(get_current_auditor)):
    return db.query(AuditTrail).options(
        joinedload(AuditTrail.merchant),
        joinedload(AuditTrail.user)
    ).order_by(AuditTrail.timestamp.desc()).all()

from datetime import datetime

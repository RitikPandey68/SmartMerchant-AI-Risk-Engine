from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session, joinedload
from pydantic import BaseModel
from typing import List, Optional
import uuid
import logging
import requests
import re
from urllib.parse import urlparse

from app.database import get_db
from app.models import Merchant, VerificationReport, AgentLog, WebhookConfig, AuditTrail, User, ComplianceRule
from app.schemas import (
    MerchantCreate, MerchantOut, OnboardingResponse, 
    AuditTrailCreate, AuditTrailOut, WebhookConfigCreate, WebhookConfigOut
)
from app.routes.auth import get_current_auditor
from app.worker import process_merchant_verification

logger = logging.getLogger("routes_onboarding")
router = APIRouter(tags=["Merchant Onboarding & Risk"])

class AutofillRequest(BaseModel):
    url: str

class ComplianceRuleUpdate(BaseModel):
    rule_key: str
    value_bool: bool

# Web scrap autofill endpoint
@router.post("/api/onboarding/autofill")
def autofill_from_website(req: AutofillRequest):
    """Scrapes a merchant website to auto-fill onboarding fields."""
    url = req.url
    if not url.startswith("http"):
        url = "https://" + url
        
    try:
        domain = urlparse(url).netloc or url
        # Strip www.
        domain_clean = domain.replace("www.", "")
        # Get business name guess
        name_guess = domain_clean.split(".")[0].title()
        
        # Make a quick request with a short timeout
        headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
        res = requests.get(url, headers=headers, timeout=3.0)
        
        title_match = re.search(r"<title>(.*?)</title>", res.text, re.IGNORECASE)
        page_title = title_match.group(1).strip() if title_match else name_guess
        
        # Scan page content for email regex
        emails = re.findall(r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+", res.text)
        email_guess = emails[0] if emails else f"info@{domain_clean}"
        
        return {
            "business_name": page_title[:60],
            "business_email": email_guess,
            "owner_email": email_guess,
            "owner_name": f"{name_guess} Admin"
        }
    except Exception as e:
        # Fallback to smart parsing on domain name if scraper fails
        logger.warning(f"Autofill scraping failed: {e}. Using domain heuristics fallback.")
        domain = urlparse(url).netloc or url
        domain_clean = domain.replace("www.", "")
        name_guess = domain_clean.split(".")[0].title()
        
        return {
            "business_name": f"{name_guess} LLC",
            "business_email": f"contact@{domain_clean}",
            "owner_email": f"owner@{domain_clean}",
            "owner_name": f"{name_guess} Compliance"
        }

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
        
        # Trigger background validation task
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
    """Manually override verification outcome (Auditors only)."""
    merchant = db.query(Merchant).filter(Merchant.id == merchant_id).first()
    if not merchant:
        raise HTTPException(status_code=404, detail="Merchant profile not found.")
        
    valid_actions = ["MANUAL_APPROVE", "MANUAL_REJECT", "MANUAL_FLAG"]
    if override.action not in valid_actions:
        raise HTTPException(status_code=400, detail=f"Invalid override action. Must be one of: {valid_actions}")
        
    if override.action == "MANUAL_APPROVE":
        merchant.status = "APPROVED"
    elif override.action == "MANUAL_REJECT":
        merchant.status = "REJECTED"
    else:
        merchant.status = "FLAGGED"
        
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
        secret=str(uuid.uuid4()),
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

# Compliance Rules
@router.get("/api/compliance/rules")
def get_compliance_rules(db: Session = Depends(get_db), auditor: User = Depends(get_current_auditor)):
    return db.query(ComplianceRule).order_by(ComplianceRule.id.asc()).all()

@router.post("/api/compliance/rules")
def update_compliance_rule(
    rule_update: ComplianceRuleUpdate,
    db: Session = Depends(get_db),
    auditor: User = Depends(get_current_auditor)
):
    rule = db.query(ComplianceRule).filter(ComplianceRule.rule_key == rule_update.rule_key).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Compliance rule key not found.")
    rule.value_bool = rule_update.value_bool
    db.commit()
    return {"message": f"Rule {rule.rule_key} updated to {rule.value_bool}.", "rule": rule}

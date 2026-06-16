from pydantic import BaseModel, EmailStr, HttpUrl, Field
from typing import Optional, List, Dict, Any
from datetime import datetime

# Auth
class UserCreate(BaseModel):
    username: str
    password: str
    role: Optional[str] = "auditor"

class UserLogin(BaseModel):
    username: str
    password: str

class UserOut(BaseModel):
    id: int
    username: str
    role: str
    created_at: datetime

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserOut

class TokenData(BaseModel):
    username: Optional[str] = None
    role: Optional[str] = None

# Webhooks
class WebhookConfigCreate(BaseModel):
    url: str
    is_active: Optional[bool] = True

class WebhookConfigOut(BaseModel):
    id: int
    url: str
    secret: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True

# Audit Trail
class AuditTrailCreate(BaseModel):
    action: str
    notes: Optional[str] = None

class AuditTrailOut(BaseModel):
    id: int
    merchant_id: int
    user_id: Optional[int] = None
    user: Optional[UserOut] = None
    action: str
    notes: Optional[str] = None
    timestamp: datetime

    class Config:
        from_attributes = True

# Agent Logs
class AgentLogOut(BaseModel):
    id: int
    merchant_id: int
    agent_name: str
    log_level: str
    message: str
    timestamp: datetime

    class Config:
        from_attributes = True

# Verification Report
class VerificationReportOut(BaseModel):
    id: int
    merchant_id: int
    risk_score: int
    risk_category: str
    extracted_data: Optional[Dict[str, Any]] = None
    website_audit: Optional[Dict[str, Any]] = None
    kyb_verification: Optional[Dict[str, Any]] = None
    risk_factors: Optional[List[Dict[str, Any]]] = None
    routing_processor: str
    routing_fee: float
    agent_summary: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

# Merchant Onboarding
class MerchantCreate(BaseModel):
    business_name: str
    business_email: EmailStr
    business_website: str
    business_type: str
    registration_number: str
    owner_name: str
    owner_email: EmailStr
    phone: str

class MerchantOut(BaseModel):
    id: int
    business_name: str
    business_email: EmailStr
    business_website: str
    business_type: str
    registration_number: str
    owner_name: str
    owner_email: EmailStr
    phone: str
    status: str
    document_path: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    report: Optional[VerificationReportOut] = None
    logs: Optional[List[AgentLogOut]] = []
    audit_trails: Optional[List[AuditTrailOut]] = []

    class Config:
        from_attributes = True
        
class OnboardingResponse(BaseModel):
    merchant: MerchantOut
    message: str

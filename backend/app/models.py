from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Float, Text, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(String, default="auditor")  # auditor, admin
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    audit_trails = relationship("AuditTrail", back_populates="user")

class Merchant(Base):
    __tablename__ = "merchants"

    id = Column(Integer, primary_key=True, index=True)
    business_name = Column(String, nullable=False)
    business_email = Column(String, nullable=False)
    business_website = Column(String, nullable=False)
    business_type = Column(String, nullable=False)
    registration_number = Column(String, nullable=False)
    owner_name = Column(String, nullable=False)
    owner_email = Column(String, nullable=False)
    phone = Column(String, nullable=False)
    status = Column(String, default="PENDING")  # PENDING, PROCESSING, APPROVED, REJECTED, FLAGGED
    document_path = Column(String, nullable=True)  # Path to uploaded doc
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    report = relationship("VerificationReport", back_populates="merchant", uselist=False, cascade="all, delete-orphan")
    logs = relationship("AgentLog", back_populates="merchant", cascade="all, delete-orphan")
    audit_trails = relationship("AuditTrail", back_populates="merchant", cascade="all, delete-orphan")

class VerificationReport(Base):
    __tablename__ = "verification_reports"

    id = Column(Integer, primary_key=True, index=True)
    merchant_id = Column(Integer, ForeignKey("merchants.id"), unique=True, nullable=False)
    risk_score = Column(Integer, default=0)  # 0 to 100
    risk_category = Column(String, default="LOW")  # LOW, MEDIUM, HIGH
    
    # Store agent outputs structured as JSON
    extracted_data = Column(JSON, nullable=True)
    website_audit = Column(JSON, nullable=True)
    kyb_verification = Column(JSON, nullable=True)
    risk_factors = Column(JSON, nullable=True)
    
    # Smart routing simulator
    routing_processor = Column(String, default="Stripe Standard")
    routing_fee = Column(Float, default=2.9)
    
    agent_summary = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    merchant = relationship("Merchant", back_populates="report")

class AgentLog(Base):
    __tablename__ = "agent_logs"

    id = Column(Integer, primary_key=True, index=True)
    merchant_id = Column(Integer, ForeignKey("merchants.id"), nullable=False)
    agent_name = Column(String, nullable=False)  # Document Extractor, Website Auditor, etc.
    log_level = Column(String, default="INFO")  # INFO, WARNING, ERROR
    message = Column(Text, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)

    # Relationships
    merchant = relationship("Merchant", back_populates="logs")

class WebhookConfig(Base):
    __tablename__ = "webhook_configs"

    id = Column(Integer, primary_key=True, index=True)
    url = Column(String, nullable=False)
    secret = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class AuditTrail(Base):
    __tablename__ = "audit_trails"

    id = Column(Integer, primary_key=True, index=True)
    merchant_id = Column(Integer, ForeignKey("merchants.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # Null if system trigger
    action = Column(String, nullable=False)  # MANUAL_APPROVE, MANUAL_REJECT, SYSTEM_INIT, SYSTEM_COMPLETE
    notes = Column(Text, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)

    # Relationships
    merchant = relationship("Merchant", back_populates="audit_trails")
    user = relationship("User", back_populates="audit_trails")

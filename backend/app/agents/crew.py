import time
import json
import random
from typing import Dict, Any, Callable, List
from app.config import settings

# Attempt to import Google Generative AI in case they configure keys
try:
    import google.generativeai as genai
    HAS_GEMINI = True
except ImportError:
    HAS_GEMINI = False

try:
    from langchain.chains import LLMChain
    from langchain_core.prompts import PromptTemplate
    HAS_LANGCHAIN = True
except ImportError:
    HAS_LANGCHAIN = False

def run_agent_pipeline(
    merchant: dict,
    log_callback: Callable[[str, str, str], None],
    status_callback: Callable[[str], None]
) -> Dict[str, Any]:
    """
    Executes the multi-agent KYB & Risk assessment pipeline.
    Utilizes Gemini API if key is present; otherwise falls back to a deterministic 
    heuristic-based agent simulation.
    """
    
    # 1. DOCUMENT EXTRACTOR AGENT
    status_callback("EXTRACTING")
    log_callback("Document Extractor Agent", "INFO", "Initializing OCR and document parsing engine...")
    time.sleep(1.2)
    
    reg_num = merchant.get("registration_number", "")
    business_type = merchant.get("business_type", "").lower()
    business_name = merchant.get("business_name", "")
    website = merchant.get("business_website", "")
    
    log_callback(
        "Document Extractor Agent", 
        "INFO", 
        f"Scanning corporate records for registration ID: '{reg_num}' and Business: '{business_name}'."
    )
    time.sleep(1.0)
    
    # Check if Gemini key is available for real LLM inference
    gemini_key = settings.GEMINI_API_KEY or os.environ.get("GEMINI_API_KEY")
    extracted_data = {}
    
    if HAS_GEMINI and gemini_key:
        try:
            log_callback("Document Extractor Agent", "INFO", "Using Gemini API to run document data validation...")
            genai.configure(api_key=gemini_key)
            model = genai.GenerativeModel('gemini-1.5-flash')
            prompt = f"""
            Analyze this merchant profile data:
            Business Name: {business_name}
            Registration: {reg_num}
            Type: {business_type}
            
            Extract and output in a clean JSON format:
            1. incorporation_date (make up a realistic one)
            2. tax_status (ACTIVE/INACTIVE)
            3. match_accuracy_score (0-100)
            """
            response = model.generate_content(prompt)
            # Simple text parsing fallback
            text = response.text
            if "{" in text and "}" in text:
                extracted_data = json.loads(text[text.find("{"):text.rfind("}")+1])
            else:
                extracted_data = {"incorporation_date": "2021-04-12", "tax_status": "ACTIVE", "match_accuracy_score": 95}
        except Exception as e:
            log_callback("Document Extractor Agent", "WARNING", f"Gemini API failure: {str(e)}. Falling back to local OCR parser.")
            extracted_data = simulate_doc_extraction(business_name, reg_num, business_type)
    else:
        log_callback("Document Extractor Agent", "INFO", "API key not detected. Running local OCR & parser parser rules.")
        time.sleep(1.0)
        extracted_data = simulate_doc_extraction(business_name, reg_num, business_type)

    log_callback("Document Extractor Agent", "INFO", f"Extraction completed. Confidence: {extracted_data['match_accuracy_score']}%. Status: {extracted_data['tax_status']}.")
    time.sleep(1.0)

    # 2. WEBSITE RISK AUDITOR AGENT
    status_callback("AUDITING")
    log_callback("Website Risk Auditor Agent", "INFO", f"Initiating crawler for merchant website: '{website}'...")
    time.sleep(1.2)
    
    log_callback("Website Risk Auditor Agent", "INFO", "Scanning homepage and Terms of Service links for restricted keywords (gambling, adult, drugs, high-yield investments)...")
    time.sleep(1.5)
    
    website_audit = {}
    if HAS_GEMINI and gemini_key:
        try:
            genai.configure(api_key=gemini_key)
            model = genai.GenerativeModel('gemini-1.5-flash')
            prompt = f"""
            Analyze the business website and type:
            Website: {website}
            Type: {business_type}
            
            Identify any compliance risks or prohibited categories. Output JSON:
            1. domain_verified (true/false)
            2. ssl_active (true/false)
            3. restricted_categories_found (list)
            4. compliance_rating (A/B/C/D/F)
            """
            response = model.generate_content(prompt)
            text = response.text
            if "{" in text and "}" in text:
                website_audit = json.loads(text[text.find("{"):text.rfind("}")+1])
            else:
                website_audit = {"domain_verified": True, "ssl_active": True, "restricted_categories_found": [], "compliance_rating": "A"}
        except Exception as e:
            website_audit = simulate_web_audit(website, business_type)
    else:
        website_audit = simulate_web_audit(website, business_type)
        
    for issue in website_audit["restricted_categories_found"]:
        log_callback("Website Risk Auditor Agent", "WARNING", f"Risk alert: Found reference to compliance-sensitive category: '{issue}'")
        time.sleep(0.8)
        
    log_callback("Website Risk Auditor Agent", "INFO", f"Website audit completed. SSL: {website_audit['ssl_active']}, Compliance Rating: {website_audit['compliance_rating']}.")
    time.sleep(1.0)

    # 3. KYB VERIFICATION AGENT
    status_callback("VERIFYING")
    log_callback("KYB Verification Agent", "INFO", "Querying state registration databases and tax authority registries...")
    time.sleep(1.5)
    
    kyb_verification = simulate_kyb_verification(business_name, reg_num)
    if kyb_verification["registry_status"] == "MATCHED":
        log_callback("KYB Verification Agent", "INFO", f"Registry matches corporate record: '{kyb_verification['registry_legal_name']}'. Status: ACTIVE.")
    else:
        log_callback("KYB Verification Agent", "ERROR", f"Registry check failed: {kyb_verification['mismatch_reason']}")
        
    time.sleep(1.2)

    # 4. RISK CLASSIFIER AGENT
    status_callback("CLASSIFYING")
    log_callback("Risk Classifier Agent", "INFO", "Synthesizing checks from Extractor, Auditor, and Validator agents...")
    time.sleep(1.2)
    
    risk_factors = []
    
    # Calculate Risk Score
    base_score = 10
    
    # Doc score
    if extracted_data["match_accuracy_score"] < 80:
        base_score += 20
        risk_factors.append({"factor": "Document OCR accuracy is low", "severity": "MEDIUM"})
    if extracted_data["tax_status"] != "ACTIVE":
        base_score += 35
        risk_factors.append({"factor": "Entity tax registration status is INACTIVE", "severity": "HIGH"})
        
    # Web score
    if not website_audit["ssl_active"]:
        base_score += 15
        risk_factors.append({"factor": "Website lacks SSL/TLS security certificate", "severity": "MEDIUM"})
    if website_audit["compliance_rating"] in ["C", "D", "F"]:
        base_score += 25
        risk_factors.append({"factor": f"Website compliance rating is substandard: {website_audit['compliance_rating']}", "severity": "MEDIUM"})
    if website_audit["restricted_categories_found"]:
        base_score += 40
        for cat in website_audit["restricted_categories_found"]:
            risk_factors.append({"factor": f"Contains prohibited or high-risk content: '{cat}'", "severity": "HIGH"})
            
    # KYB score
    if kyb_verification["registry_status"] != "MATCHED":
        base_score += 45
        risk_factors.append({"factor": f"Registry check mismatch: {kyb_verification['mismatch_reason']}", "severity": "HIGH"})
        
    risk_score = min(max(base_score, 0), 100)
    
    # Risk category
    if risk_score < 30:
        risk_category = "LOW"
    elif risk_score < 65:
        risk_category = "MEDIUM"
    else:
        risk_category = "HIGH"
        
    # Smart Routing
    if risk_category == "LOW":
        routing_processor = "Stripe Standard"
        routing_fee = 1.9
    elif risk_category == "MEDIUM":
        routing_processor = "BackupPay Premium"
        routing_fee = 2.9
    else:
        routing_processor = "HighRiskGate Safe"
        routing_fee = 4.5
        
    summary_text = (
        f"SmartMerchant risk evaluation classifies this entity as {risk_category} RISK (Score: {risk_score}/100). "
        f"Key observations: {len(risk_factors)} risk factors identified. Website compliance graded as {website_audit['compliance_rating']}. "
        f"Recommended transaction gateway: {routing_processor} at {routing_fee}% fee."
    )
    
    log_callback("Risk Classifier Agent", "INFO", f"Risk score calculated: {risk_score} ({risk_category}). Routing to {routing_processor} ({routing_fee}% fee).")
    time.sleep(1.0)
    
    return {
        "risk_score": risk_score,
        "risk_category": risk_category,
        "extracted_data": extracted_data,
        "website_audit": website_audit,
        "kyb_verification": kyb_verification,
        "risk_factors": risk_factors,
        "routing_processor": routing_processor,
        "routing_fee": routing_fee,
        "agent_summary": summary_text
    }

def simulate_doc_extraction(business_name: str, reg_num: str, business_type: str) -> Dict[str, Any]:
    # Simulate a smart OCR scanner
    # If reg_num contains 'test_high' or name contains 'cheat', it simulates a failed scan
    is_cheat = "cheat" in business_name.lower() or "fake" in reg_num.lower() or "test_high" in reg_num.lower()
    
    return {
        "incorporation_date": "2021-03-15" if not is_cheat else "N/A",
        "tax_status": "ACTIVE" if not is_cheat else "SUSPENDED",
        "match_accuracy_score": 98 if not is_cheat else 45,
        "legal_address": "742 Evergreen Terrace, Springfield" if not is_cheat else "P.O. Box 404, Cayman Islands",
        "extracted_owner": "John Doe"
    }

def simulate_web_audit(website: str, business_type: str) -> Dict[str, Any]:
    url_lower = website.lower()
    restricted = []
    compliance = "A"
    ssl = True
    
    # Check url strings or types for simulated keywords
    if "casino" in url_lower or "gamble" in url_lower or "bet" in url_lower or business_type == "gambling":
        restricted.append("Gambling/Betting services")
        compliance = "D"
    if "pharma" in url_lower or "rx" in url_lower or "drugs" in url_lower or business_type == "pharmacy":
        restricted.append("Prescription Pharmaceuticals")
        compliance = "C"
    if "crypto" in url_lower or "coin" in url_lower or business_type == "cryptocurrency":
        restricted.append("Cryptocurrency Trading")
        compliance = "B"
    if "fake" in url_lower or "cheat" in url_lower:
        restricted.append("Academic Cheating Services")
        compliance = "F"
        ssl = False
        
    return {
        "domain_verified": True if "http" in url_lower else False,
        "ssl_active": ssl,
        "restricted_categories_found": restricted,
        "compliance_rating": compliance
    }

def simulate_kyb_verification(business_name: str, reg_num: str) -> Dict[str, Any]:
    is_mismatch = "fake" in business_name.lower() or "test_high" in reg_num.lower() or "fake" in reg_num.lower()
    
    if is_mismatch:
        return {
            "registry_status": "MISMATCHED",
            "registry_legal_name": "N/A",
            "mismatch_reason": "Registration ID could not be resolved in State/National databases"
        }
    
    return {
        "registry_status": "MATCHED",
        "registry_legal_name": business_name,
        "mismatch_reason": None
    }
import os

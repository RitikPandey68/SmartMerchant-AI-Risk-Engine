"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
  Building2, Globe, Mail, User, Phone, FileText, CheckCircle2, 
  AlertCircle, ShieldAlert, ShieldCheck, Loader2, Sparkles, Terminal, ArrowRight, Upload, Sparkle
} from "lucide-react";
import Link from "next/link";

const PRESETS = [
  {
    name: "Low Risk SaaS (Acme Systems)",
    business_name: "Acme Cloud Systems Ltd",
    business_email: "compliance@acmesystems.io",
    business_website: "https://acmesystems.io",
    business_type: "SaaS",
    registration_number: "GSTIN27AAACA1111A",
    owner_name: "Sarah Jenkins",
    owner_email: "sarah@acmesystems.io",
    phone: "+1 555-0199",
    desc: "Legitimate enterprise software business."
  },
  {
    name: "Medium Risk Crypto (Volt Crypto)",
    business_name: "Volt Financial Exchange LLC",
    business_email: "contact@voltexchange.co",
    business_website: "https://voltexchange.co/crypto",
    business_type: "Cryptocurrency",
    registration_number: "EIN-88291039",
    owner_name: "Michael Chen",
    owner_email: "mchen@voltexchange.co",
    phone: "+1 555-0144",
    desc: "Crypto trading portal requiring gateway backup."
  },
  {
    name: "High Risk Prohibited (Jackpot Betting)",
    business_name: "Mega Jackpot Casino Group",
    business_email: "billing@jackpotcasino.net",
    business_website: "https://megajackpotcasino.net",
    business_type: "Gambling",
    registration_number: "TAX-99881122",
    owner_name: "Alexander Vance",
    owner_email: "vance@jackpotcasino.net",
    phone: "+44 20 7946 0958",
    desc: "Unauthorized gambling portal with prohibited keywords."
  },
  {
    name: "Registry Mismatch (Fake Corp LLC)",
    business_name: "Fake Corp LLC",
    business_email: "admin@fakecorp.org",
    business_website: "https://fakecorp.org",
    business_type: "SaaS",
    registration_number: "INVALID_TAX_ID_1234",
    owner_name: "John Fraudster",
    owner_email: "jfraud@fakecorp.org",
    phone: "+1 555-9999",
    desc: "Fails tax registry databases verification."
  }
];

export default function OnboardingPage() {
  const [formData, setFormData] = useState({
    business_name: "",
    business_email: "",
    business_website: "",
    business_type: "SaaS",
    registration_number: "",
    owner_name: "",
    owner_email: "",
    phone: ""
  });
  
  const [fileAttached, setFileAttached] = useState<File | null>(null);
  const [autofillLoading, setAutofillLoading] = useState(false);
  const [isOnboarding, setIsOnboarding] = useState(false);
  const [merchantId, setMerchantId] = useState<number | null>(null);
  
  // Real-time frontend validation states
  const [taxWarning, setTaxWarning] = useState("");
  
  // Verification states
  const [currentStep, setCurrentStep] = useState<"EXTRACTING" | "AUDITING" | "VERIFYING" | "CLASSIFYING" | "COMPLETED" | "ERROR" | "PENDING">("PENDING");
  const [logs, setLogs] = useState<Array<{ agent_name: string; log_level: string; message: string; timestamp: string }>>([]);
  const [finalReport, setFinalReport] = useState<any>(null);
  
  const logTerminalEndRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  
  const apiHost = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  // Auto-scroll logs
  useEffect(() => {
    if (logTerminalEndRef.current) {
      logTerminalEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs]);

  // Clean WebSockets
  useEffect(() => {
    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Real-time tax ID validations
    if (name === "registration_number") {
      validateTaxIdFormat(value);
    }
  };

  const validateTaxIdFormat = (val: string) => {
    const cleanVal = val.trim().toUpperCase();
    if (!cleanVal) {
      setTaxWarning("");
      return;
    }
    
    if (cleanVal.length === 10) {
      const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
      if (!panRegex.test(cleanVal)) {
        setTaxWarning("Format mismatch for Indian PAN (Expected: 5 letters, 4 numbers, 1 letter).");
      } else {
        const entity = cleanVal[3];
        const validEntities = ["C", "P", "H", "F", "A", "T", "B", "L", "J", "G"];
        if (!validEntities.includes(entity)) {
          setTaxWarning(`4th letter '${entity}' is not a valid PAN entity type.`);
        } else {
          setTaxWarning("");
        }
      }
    } else if (cleanVal.length === 15) {
      const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
      if (!gstinRegex.test(cleanVal)) {
        setTaxWarning("Format mismatch for Indian GSTIN (Expected 15 character alpha-numeric checksum).");
      } else {
        setTaxWarning("");
      }
    } else if (cleanVal.length === 9) {
      if (!/^\d+$/.test(cleanVal)) {
        setTaxWarning("US EIN must consist of numeric values only.");
      } else {
        setTaxWarning("");
      }
    } else {
      setTaxWarning("Tax ID length mismatch (Expected: 10 chars for PAN, 15 for GSTIN, or 9 for EIN).");
    }
  };

  const handleAutofill = async () => {
    if (!formData.business_website) {
      alert("Please enter a business website URL first.");
      return;
    }
    setAutofillLoading(true);
    try {
      const response = await fetch(`${apiHost}/api/onboarding/autofill`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ url: formData.business_website })
      });
      if (response.ok) {
        const data = await response.json();
        setFormData(prev => ({
          ...prev,
          business_name: data.business_name || prev.business_name,
          business_email: data.business_email || prev.business_email,
          owner_email: data.owner_email || prev.owner_email,
          owner_name: data.owner_name || prev.owner_name
        }));
      }
    } catch (err) {
      console.error("Autofill failure:", err);
    } finally {
      setAutofillLoading(false);
    }
  };

  const applyPreset = (preset: typeof PRESETS[0]) => {
    setFormData({
      business_name: preset.business_name,
      business_email: preset.business_email,
      business_website: preset.business_website,
      business_type: preset.business_type,
      registration_number: preset.registration_number,
      owner_name: preset.owner_name,
      owner_email: preset.owner_email,
      phone: preset.phone
    });
    setTaxWarning("");
    setFileAttached(new File(["certificate pdf copy"], "certificate.pdf", { type: "application/pdf" }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFileAttached(e.target.files[0]);
    }
  };

  const startWebSocket = (id: number) => {
    const wsUrl = apiHost.replace("http", "ws");
    const socket = new WebSocket(`${wsUrl}/ws/status/merchant_${id}`);
    wsRef.current = socket;
    
    socket.onopen = () => {
      setCurrentStep("EXTRACTING");
    };
    
    socket.onmessage = (event) => {
      const payload = JSON.parse(event.data);
      if (payload.type === "LOG") {
        setLogs((prev) => [...prev, payload.data]);
      } else if (payload.type === "STATUS") {
        setCurrentStep(payload.data.status);
      } else if (payload.type === "COMPLETED") {
        setCurrentStep("COMPLETED");
        setFinalReport(payload.data);
        socket.close();
      } else if (payload.type === "ERROR") {
        setCurrentStep("ERROR");
        socket.close();
      }
    };
    
    socket.onerror = () => {
      setCurrentStep("ERROR");
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.business_name || !formData.business_website || !formData.registration_number) {
      alert("Please fill in all required fields.");
      return;
    }
    
    setIsOnboarding(true);
    setCurrentStep("PENDING");
    setLogs([]);
    setFinalReport(null);
    
    try {
      const response = await fetch(`${apiHost}/api/onboarding`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(formData)
      });
      
      if (!response.ok) throw new Error("Onboarding request failed");
      const data = await response.json();
      setMerchantId(data.merchant.id);
      startWebSocket(data.merchant.id);
    } catch (err) {
      console.error(err);
      setCurrentStep("ERROR");
      setIsOnboarding(false);
    }
  };

  const getStepStatusClass = (stepName: string) => {
    const order = ["EXTRACTING", "AUDITING", "VERIFYING", "CLASSIFYING", "COMPLETED"];
    const currentIndex = order.indexOf(currentStep === "PENDING" ? "EXTRACTING" : currentStep);
    const stepIndex = order.indexOf(stepName);
    
    if (currentStep === "ERROR") return "status-error";
    if (currentStep === "COMPLETED") return "status-done";
    if (stepIndex < currentIndex) return "status-done";
    if (stepIndex === currentIndex) return "status-active";
    return "status-upcoming";
  };

  return (
    <div className="container" style={{ padding: "40px 24px", maxWidth: "1200px" }}>
      
      {!isOnboarding ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 350px", gap: "32px", alignItems: "start" }}>
          
          {/* Form */}
          <div className="glass-panel" style={{ padding: "32px" }}>
            <h2 style={{ fontSize: "28px", marginBottom: "8px", display: "flex", alignItems: "center", gap: "10px", color: "#fff" }}>
              <Building2 style={{ color: "var(--primary)" }} />
              Merchant Registration
            </h2>
            <p style={{ color: "var(--text-secondary)", fontSize: "14px", marginBottom: "28px" }}>
              Submit business credentials below to run zero-error compliance validation.
            </p>

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              
              <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "20px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "6px" }}>Business Website URL *</label>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <div style={{ position: "relative", flex: 1 }}>
                      <Globe size={16} style={{ position: "absolute", left: "14px", top: "15px", color: "var(--text-muted)" }} />
                      <input 
                        type="text" 
                        name="business_website" 
                        value={formData.business_website} 
                        onChange={handleInputChange} 
                        className="text-input" 
                        placeholder="e.g. stripe.com" 
                        style={{ paddingLeft: "42px" }}
                        required
                      />
                    </div>
                    <button 
                      type="button" 
                      onClick={handleAutofill} 
                      disabled={autofillLoading}
                      className="btn btn-secondary"
                      style={{ height: "46px", whiteSpace: "nowrap", display: "flex", gap: "6px" }}
                    >
                      {autofillLoading ? (
                        <Loader2 size={14} className="streaming-line" />
                      ) : (
                        <Sparkle size={14} style={{ color: "var(--secondary)" }} />
                      )}
                      Auto-Fill
                    </button>
                  </div>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "6px" }}>Business Legal Name *</label>
                  <div style={{ position: "relative" }}>
                    <Building2 size={16} style={{ position: "absolute", left: "14px", top: "15px", color: "var(--text-muted)" }} />
                    <input 
                      type="text" 
                      name="business_name" 
                      value={formData.business_name} 
                      onChange={handleInputChange} 
                      className="text-input" 
                      placeholder="e.g. Acme Corp" 
                      style={{ paddingLeft: "42px" }}
                      required
                    />
                  </div>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "6px" }}>Business Email *</label>
                  <div style={{ position: "relative" }}>
                    <Mail size={16} style={{ position: "absolute", left: "14px", top: "15px", color: "var(--text-muted)" }} />
                    <input 
                      type="email" 
                      name="business_email" 
                      value={formData.business_email} 
                      onChange={handleInputChange} 
                      className="text-input" 
                      placeholder="billing@acme.com" 
                      style={{ paddingLeft: "42px" }}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "6px" }}>Business Type</label>
                  <select 
                    name="business_type" 
                    value={formData.business_type} 
                    onChange={handleInputChange} 
                    className="text-input"
                    style={{ background: "rgba(8, 10, 15, 0.8)" }}
                  >
                    <option value="SaaS">SaaS Platform</option>
                    <option value="E-commerce">E-Commerce Store</option>
                    <option value="Cryptocurrency">Cryptocurrency Portal</option>
                    <option value="Gambling">Gambling / Casino Services</option>
                    <option value="Pharmacy">Prescription Pharmacy</option>
                  </select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "6px" }}>Tax Registration ID / PAN / GSTIN *</label>
                  <div style={{ position: "relative" }}>
                    <FileText size={16} style={{ position: "absolute", left: "14px", top: "15px", color: "var(--text-muted)" }} />
                    <input 
                      type="text" 
                      name="registration_number" 
                      value={formData.registration_number} 
                      onChange={handleInputChange} 
                      className="text-input" 
                      placeholder="PAN (10 chars), GSTIN (15 chars) or EIN (9 chars)" 
                      style={{ paddingLeft: "42px", borderColor: taxWarning ? "var(--risk-medium)" : "var(--glass-border)" }}
                      required
                    />
                  </div>
                  {taxWarning && (
                    <span style={{ fontSize: "11px", color: "var(--risk-medium)", marginTop: "4px", display: "inline-block" }}>
                      ⚠️ {taxWarning}
                    </span>
                  )}
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "6px" }}>Owner Full Name *</label>
                  <div style={{ position: "relative" }}>
                    <User size={16} style={{ position: "absolute", left: "14px", top: "15px", color: "var(--text-muted)" }} />
                    <input 
                      type="text" 
                      name="owner_name" 
                      value={formData.owner_name} 
                      onChange={handleInputChange} 
                      className="text-input" 
                      placeholder="e.g. Sarah Jenkins" 
                      style={{ paddingLeft: "42px" }}
                      required
                    />
                  </div>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "6px" }}>Owner Email *</label>
                  <div style={{ position: "relative" }}>
                    <Mail size={16} style={{ position: "absolute", left: "14px", top: "15px", color: "var(--text-muted)" }} />
                    <input 
                      type="email" 
                      name="owner_email" 
                      value={formData.owner_email} 
                      onChange={handleInputChange} 
                      className="text-input" 
                      placeholder="owner@acme.com" 
                      style={{ paddingLeft: "42px" }}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "6px" }}>Owner Phone *</label>
                  <div style={{ position: "relative" }}>
                    <Phone size={16} style={{ position: "absolute", left: "14px", top: "15px", color: "var(--text-muted)" }} />
                    <input 
                      type="text" 
                      name="phone" 
                      value={formData.phone} 
                      onChange={handleInputChange} 
                      className="text-input" 
                      placeholder="e.g. +1 555-0100" 
                      style={{ paddingLeft: "42px" }}
                      required
                    />
                  </div>
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "6px" }}>Certificate of Incorporation</label>
                <div style={{
                  border: "2px dashed var(--glass-border)",
                  borderRadius: "var(--radius-sm)",
                  padding: "20px",
                  textAlign: "center",
                  background: fileAttached ? "rgba(99, 102, 241, 0.05)" : "rgba(8, 10, 15, 0.4)",
                  cursor: "pointer",
                  position: "relative"
                }}>
                  <input 
                    type="file" 
                    onChange={handleFileChange} 
                    style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer" }}
                    accept=".pdf,.png,.jpg"
                  />
                  <Upload size={24} style={{ color: fileAttached ? "var(--primary)" : "var(--text-muted)", marginBottom: "8px" }} />
                  {fileAttached ? (
                    <div>
                      <p style={{ fontSize: "14px", fontWeight: 600, color: "#fff" }}>{fileAttached.name}</p>
                      <p style={{ fontSize: "12px", color: "var(--text-secondary)" }}>{(fileAttached.size / 1024).toFixed(1)} KB • Click to swap</p>
                    </div>
                  ) : (
                    <div>
                      <p style={{ fontSize: "14px", color: "var(--text-primary)" }}>Drag and drop Certificate PDF here</p>
                      <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>Supports PDF, PNG, JPG (Max 5MB)</p>
                    </div>
                  )}
                </div>
              </div>

              <button type="submit" className="btn btn-primary" style={{ marginTop: "12px", width: "100%", height: "48px" }}>
                Submit Onboarding Application
                <ArrowRight size={16} />
              </button>
            </form>
          </div>

          {/* Presets */}
          <div>
            <div className="glass-panel" style={{ padding: "24px", position: "sticky", top: "84px" }}>
              <h3 style={{ fontSize: "16px", marginBottom: "4px", color: "#fff", display: "flex", alignItems: "center", gap: "8px" }}>
                <Sparkles size={16} style={{ color: "var(--primary)" }} />
                Sandbox Preset Profiles
              </h3>
              <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "20px" }}>
                Use these simulated profiles to test the duplicate prevention check and checksum verification filters.
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {PRESETS.map((p, idx) => (
                  <button 
                    key={idx}
                    onClick={() => applyPreset(p)}
                    style={{
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid var(--glass-border)",
                      borderRadius: "8px",
                      padding: "12px 14px",
                      textAlign: "left",
                      cursor: "pointer",
                      transition: "all 0.2s"
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = "var(--primary)";
                      e.currentTarget.style.background = "rgba(99, 102, 241, 0.05)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "var(--glass-border)";
                      e.currentTarget.style.background = "rgba(255, 255, 255, 0.03)";
                    }}
                  >
                    <div style={{ fontSize: "13px", fontWeight: 700, color: "#fff", marginBottom: "4px" }}>{p.name}</div>
                    <div style={{ fontSize: "11px", color: "var(--text-secondary)", lineHeight: "1.4" }}>{p.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
          
        </div>
      ) : (
        /* Stepper & Stepping Console */
        <div style={{ maxWidth: "800px", margin: "0 auto" }}>
          
          <div className="glass-panel" style={{ padding: "32px", marginBottom: "24px" }}>
            
            {currentStep !== "COMPLETED" && currentStep !== "ERROR" ? (
              <div style={{ textAlign: "center", marginBottom: "36px" }}>
                <Loader2 className="streaming-line" size={36} style={{ color: "var(--primary)", margin: "0 auto 16px" }} />
                <h3 style={{ fontSize: "20px", color: "#fff", marginBottom: "8px" }}>AI Agent Crew Active</h3>
                <p style={{ fontSize: "14px", color: "var(--text-secondary)" }}>
                  Analyzing company records, crawling business domain and verifying registries...
                </p>
              </div>
            ) : null}

            {/* Stepper Steps UI */}
            <div style={{ display: "flex", flexDirection: "column", gap: "20px", marginBottom: "32px" }}>
              {[
                { key: "EXTRACTING", name: "Document Extractor Agent", desc: "Running OCR & checking registration format correctness." },
                { key: "AUDITING", name: "Website Risk Auditor Agent", desc: "Crawling website for restricted content & SSL validations." },
                { key: "VERIFYING", name: "KYB Verification Agent", desc: "Cross-referencing legal credentials in state registries." },
                { key: "CLASSIFYING", name: "Risk Classifier Agent", desc: "Compiling risk factors and executing validator consensus." }
              ].map((step, idx) => {
                const status = getStepStatusClass(step.key);
                let badgeColor = "var(--text-muted)";
                let badgeText = "Pending";
                let icon = <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "var(--text-muted)" }} />;
                
                if (status === "status-done") {
                  badgeColor = "var(--risk-low)";
                  badgeText = "Complete";
                  icon = <CheckCircle2 size={16} style={{ color: "var(--risk-low)" }} />;
                } else if (status === "status-active") {
                  badgeColor = "var(--primary)";
                  badgeText = "Running";
                  icon = <Loader2 size={16} className="streaming-line" style={{ color: "var(--primary)" }} />;
                } else if (status === "status-error") {
                  badgeColor = "var(--risk-high)";
                  badgeText = "Failed";
                  icon = <AlertCircle size={16} style={{ color: "var(--risk-high)" }} />;
                }
                
                return (
                  <div key={idx} style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "16px",
                    opacity: status === "status-upcoming" ? 0.5 : 1,
                    transition: "all 0.3s"
                  }}>
                    <div style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "50%",
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid var(--glass-border)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center"
                    }}>
                      {icon}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ fontSize: "14px", fontWeight: 700, color: "#fff" }}>{step.name}</span>
                        <span style={{
                          fontSize: "10px",
                          fontWeight: 700,
                          padding: "2px 8px",
                          borderRadius: "100px",
                          background: `rgba(${badgeColor === "var(--primary)" ? "99, 102, 241" : badgeColor === "var(--risk-low)" ? "16, 185, 129" : "75, 85, 99"}, 0.1)`,
                          color: badgeColor,
                          border: `1px solid rgba(${badgeColor === "var(--primary)" ? "99, 102, 241" : badgeColor === "var(--risk-low)" ? "16, 185, 129" : "75, 85, 99"}, 0.2)`
                        }}>
                          {badgeText}
                        </span>
                      </div>
                      <p style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "2px" }}>{step.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Outcome Display Card */}
            {currentStep === "COMPLETED" && finalReport && (
              <div className="fade-in" style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px solid var(--glass-border)",
                borderRadius: "var(--radius-md)",
                padding: "24px",
                textAlign: "center"
              }}>
                <div style={{ display: "flex", justifyContent: "center", marginBottom: "16px" }}>
                  {finalReport.status === "APPROVED" ? (
                    <div style={{ color: "var(--risk-low)", display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
                      <ShieldCheck size={48} />
                      <h4 style={{ fontSize: "22px", fontWeight: 800, color: "#fff" }}>Application Approved</h4>
                    </div>
                  ) : finalReport.status === "FLAGGED" ? (
                    <div style={{ color: "var(--risk-medium)", display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
                      <AlertCircle size={48} />
                      <h4 style={{ fontSize: "22px", fontWeight: 800, color: "#fff" }}>Flagged for Review</h4>
                    </div>
                  ) : (
                    <div style={{ color: "var(--risk-high)", display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
                      <ShieldAlert size={48} />
                      <h4 style={{ fontSize: "22px", fontWeight: 800, color: "#fff" }}>Application Rejected</h4>
                    </div>
                  )}
                </div>

                <div style={{ display: "flex", justifyContent: "center", gap: "40px", margin: "24px 0" }}>
                  <div>
                    <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "4px" }}>Risk Classification</div>
                    <div style={{
                      fontSize: "16px",
                      fontWeight: 800,
                      color: finalReport.risk_category === "LOW" ? "var(--risk-low)" : finalReport.risk_category === "MEDIUM" ? "var(--risk-medium)" : "var(--risk-high)"
                    }}>{finalReport.risk_category} RISK ({finalReport.risk_score}/100)</div>
                  </div>
                  <div style={{ width: "1px", background: "var(--glass-border)" }} />
                  <div>
                    <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "4px" }}>Gateway Route</div>
                    <div style={{ fontSize: "16px", fontWeight: 800, color: "#fff" }}>
                      {finalReport.routing_processor} ({finalReport.routing_fee}% fee)
                    </div>
                  </div>
                </div>

                <p style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: "1.5", marginBottom: "24px" }}>
                  {finalReport.agent_summary}
                </p>

                <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
                  <Link href="/dashboard" className="btn btn-primary">
                    Open Compliance Dashboard
                  </Link>
                  <button onClick={() => setIsOnboarding(false)} className="btn btn-secondary">
                    Register New Merchant
                  </button>
                </div>
              </div>
            )}

            {currentStep === "ERROR" && (
              <div className="fade-in" style={{ textAlign: "center", padding: "20px" }}>
                <ShieldAlert size={40} style={{ color: "var(--risk-high)", marginBottom: "12px" }} />
                <h4 style={{ fontSize: "18px", color: "#fff", marginBottom: "8px" }}>Verification Error</h4>
                <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "20px" }}>
                  An unexpected exception occurred while executing the multi-agent worker tasks. Check Redis and Celery logs.
                </p>
                <button onClick={() => setIsOnboarding(false)} className="btn btn-secondary">
                  Return to Onboarding Portal
                </button>
              </div>
            )}

          </div>

          {/* Logs */}
          <div className="glass-panel" style={{ padding: "20px", background: "rgba(5, 7, 10, 0.9)", border: "1px solid #1a2333" }}>
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderBottom: "1px solid #1a2333",
              paddingBottom: "12px",
              marginBottom: "12px"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Terminal size={16} style={{ color: "var(--primary)" }} />
                <span style={{ fontSize: "12px", fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--text-secondary)" }}>
                  agent_crew_execution_stream.log
                </span>
              </div>
              <div style={{ display: "flex", gap: "6px" }}>
                <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#ef4444" }} />
                <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#f59e0b" }} />
                <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#10b981" }} />
              </div>
            </div>

            <div style={{
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              lineHeight: "1.6",
              height: "250px",
              overflowY: "auto",
              color: "#34d399",
              textAlign: "left"
            }}>
              {logs.length === 0 ? (
                <div style={{ color: "var(--text-muted)" }}>&gt; Waiting for agent execution thread to spawn...</div>
              ) : (
                logs.map((log, index) => (
                  <div key={index} style={{ marginBottom: "6px" }}>
                    <span style={{ color: "var(--text-muted)" }}>[{log.timestamp?.substring(11, 19) || new Date().toLocaleTimeString()}]</span>{" "}
                    <span style={{ color: log.agent_name.includes("Auditor") ? "#a855f7" : log.agent_name.includes("Extractor") ? "#6366f1" : log.agent_name.includes("KYB") ? "#0ea5e9" : "#10b981", fontWeight: 700 }}>
                      {log.agent_name}:
                    </span>{" "}
                    <span style={{ color: log.log_level === "WARNING" ? "var(--risk-medium)" : log.log_level === "ERROR" ? "var(--risk-high)" : "#e2e8f0" }}>
                      {log.message}
                    </span>
                  </div>
                ))
              )}
              <div ref={logTerminalEndRef} />
            </div>
          </div>

        </div>
      )}

    </div>
  );
}

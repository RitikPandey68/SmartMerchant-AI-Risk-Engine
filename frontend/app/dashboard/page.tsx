"use client";

import React, { useState, useEffect } from "react";
import { 
  BarChart3, Users, ShieldAlert, CheckCircle, Clock, Search, ExternalLink, 
  Settings, Database, Network, Key, ArrowUpRight, ShieldCheck, Printer, Plus, Trash2, LogOut,
  Map, Globe, ToggleLeft, ToggleRight, CheckSquare, Square
} from "lucide-react";

export default function DashboardPage() {
  const [token, setToken] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  
  // Dashboard states
  const [merchants, setMerchants] = useState<any[]>([]);
  const [selectedMerchant, setSelectedMerchant] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [activeTab, setActiveTab] = useState<"audits" | "webhooks" | "rules">("audits");
  
  // Compliance Rules configurations
  const [complianceRules, setComplianceRules] = useState<any[]>([]);
  
  // Auditor Guided Verification Checklist states
  const [checklist, setChecklist] = useState({
    registry: false,
    domain: false,
    sanctions: false,
    banking: false
  });
  
  // Override form states
  const [overrideNotes, setOverrideNotes] = useState("");
  const [overrideAction, setOverrideAction] = useState("MANUAL_APPROVE");
  
  // Webhooks states
  const [webhooks, setWebhooks] = useState<any[]>([]);
  const [newWebhookUrl, setNewWebhookUrl] = useState("");

  const apiHost = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  // Check stored credentials
  useEffect(() => {
    const savedToken = localStorage.getItem("smartmerchant_token");
    if (savedToken) setToken(savedToken);
  }, []);

  // Fetch data
  useEffect(() => {
    if (token) {
      fetchMerchants();
      fetchWebhooks();
      fetchComplianceRules();
      
      const wsUrl = apiHost.replace("http", "ws");
      const socket = new WebSocket(`${wsUrl}/ws/status/global`);
      
      socket.onmessage = () => {
        fetchMerchants();
      };
      
      return () => {
        socket.close();
      };
    }
  }, [token]);

  // Reset checklist on merchant change
  useEffect(() => {
    setChecklist({
      registry: false,
      domain: false,
      sanctions: false,
      banking: false
    });
  }, [selectedMerchant]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    try {
      const details = new URLSearchParams();
      details.append("username", username || "auditor");
      details.append("password", password || "password123");
      
      const response = await fetch(`${apiHost}/api/auth/token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: details
      });
      if (!response.ok) throw new Error("Invalid auditor credentials");
      const data = await response.json();
      localStorage.setItem("smartmerchant_token", data.access_token);
      setToken(data.access_token);
    } catch (err: any) {
      setLoginError(err.message || "Failed to log in");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("smartmerchant_token");
    setToken(null);
  };

  const fetchMerchants = async () => {
    try {
      const response = await fetch(`${apiHost}/api/merchants`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!response.ok) throw new Error("Failed to fetch merchants");
      const data = await response.json();
      setMerchants(data);
      if (data.length > 0 && !selectedMerchant) {
        setSelectedMerchant(data[0]);
      } else if (selectedMerchant) {
        const updated = data.find((m: any) => m.id === selectedMerchant.id);
        if (updated) setSelectedMerchant(updated);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchWebhooks = async () => {
    try {
      const response = await fetch(`${apiHost}/api/webhooks`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setWebhooks(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchComplianceRules = async () => {
    try {
      const response = await fetch(`${apiHost}/api/compliance/rules`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setComplianceRules(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const toggleComplianceRule = async (ruleKey: string, currentValue: boolean) => {
    try {
      const response = await fetch(`${apiHost}/api/compliance/rules`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          rule_key: ruleKey,
          value_bool: !currentValue
        })
      });
      if (response.ok) {
        fetchComplianceRules();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const submitOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMerchant) return;
    
    // Safety check checklist
    const isAllChecked = checklist.registry && checklist.domain && checklist.sanctions && checklist.banking;
    if (!isAllChecked) {
      alert("Guided verification audit must be completed. Check off all compliance requirements first.");
      return;
    }

    try {
      const response = await fetch(`${apiHost}/api/merchants/${selectedMerchant.id}/override`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          action: overrideAction,
          notes: overrideNotes
        })
      });
      if (response.ok) {
        setOverrideNotes("");
        fetchMerchants();
        alert("Override applied successfully!");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const registerWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWebhookUrl) return;
    try {
      const response = await fetch(`${apiHost}/api/webhooks`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ url: newWebhookUrl })
      });
      if (response.ok) {
        setNewWebhookUrl("");
        fetchWebhooks();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const deleteWebhook = async (id: number) => {
    try {
      const response = await fetch(`${apiHost}/api/webhooks/${id}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (response.ok) fetchWebhooks();
    } catch (err) {
      console.error(err);
    }
  };

  const printComplianceReport = () => {
    if (!selectedMerchant) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    const r = selectedMerchant.report;
    const details = `
      <html>
        <head>
          <title>Compliance Audit Report - ${selectedMerchant.business_name}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #1f2937; padding: 40px; }
            .header { border-bottom: 2px solid #374151; padding-bottom: 20px; margin-bottom: 30px; }
            .title { font-size: 24px; font-weight: 800; }
            .section { margin-bottom: 24px; }
            .section-title { font-size: 16px; font-weight: 700; border-bottom: 1px solid #e5e7eb; padding-bottom: 6px; margin-bottom: 12px; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
            .label { font-size: 12px; color: #6b7280; }
            .val { font-size: 14px; font-weight: 600; margin-top: 2px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th, td { border: 1px solid #e5e7eb; padding: 8px; text-align: left; font-size: 13px; }
            th { background: #f9fafb; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="title">SmartMerchant AI Compliance Verification Report</div>
            <p>Generated on ${new Date().toLocaleString()}</p>
          </div>
          <div class="section">
            <div class="section-title">Merchant Profile</div>
            <div class="grid">
              <div><div class="label">Business Legal Name</div><div class="val">${selectedMerchant.business_name}</div></div>
              <div><div class="label">Website Domain</div><div class="val">${selectedMerchant.business_website}</div></div>
              <div><div class="label">Registration / Tax ID</div><div class="val">${selectedMerchant.registration_number}</div></div>
              <div><div class="label">Owner Name</div><div class="val">${selectedMerchant.owner_name}</div></div>
            </div>
          </div>
          <div class="section">
            <div class="section-title">Assigned Risk Routing</div>
            <div class="grid">
              <div><div class="label">Overall Status</div><div class="val">${selectedMerchant.status}</div></div>
              <div><div class="label">Risk Score Assessment</div><div class="val">${r ? r.risk_score : 0}/100 (${r ? r.risk_category : "N/A"})</div></div>
              <div><div class="label">Gateway Processor</div><div class="val">${r ? r.routing_processor : "N/A"}</div></div>
              <div><div class="label">Processing Fee Rate</div><div class="val">${r ? r.routing_fee : 0}%</div></div>
            </div>
          </div>
          <div class="section">
            <div class="section-title">Risk Flags Details</div>
            <table>
              <thead>
                <tr><th>Identified Risk Indicator</th><th>Severity</th></tr>
              </thead>
              <tbody>
                ${r && r.risk_factors && r.risk_factors.length > 0 
                  ? r.risk_factors.map((f: any) => `
                      <tr><td>${f.factor}</td><td>${f.severity}</td></tr>
                    `).join("")
                  : `<tr><td colspan="2">Clear. No risk items flags active.</td></tr>`
                }
              </tbody>
            </table>
          </div>
          <script>window.print();</script>
        </body>
      </html>
    `;
    printWindow.document.write(details);
    printWindow.document.close();
  };

  const filteredMerchants = merchants.filter(m => {
    const matchSearch = m.business_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        m.registration_number.toLowerCase().includes(searchQuery.toLowerCase());
    if (statusFilter === "ALL") return matchSearch;
    return m.status === statusFilter && matchSearch;
  });

  const totalOnboarded = merchants.length;
  const approvedCount = merchants.filter(m => m.status === "APPROVED").length;
  const pendingCount = merchants.filter(m => m.status === "FLAGGED").length;
  const rejectedCount = merchants.filter(m => m.status === "REJECTED").length;
  const avgRiskScore = totalOnboarded > 0
    ? Math.round(merchants.reduce((acc, curr) => acc + (curr.report?.risk_score || 0), 0) / totalOnboarded)
    : 0;

  const isChecklistCompleted = checklist.registry && checklist.domain && checklist.sanctions && checklist.banking;

  if (!token) {
    return (
      <div style={{ minHeight: "calc(100vh - 60px)", display: "flex", alignItems: "center", justifyCenter: "center", padding: "20px", display: "flex", justifyContent: "center" }}>
        <div className="glass-panel" style={{ padding: "32px", width: "100%", maxWidth: "420px", marginTop: "100px" }}>
          <div style={{ textAlign: "center", marginBottom: "24px" }}>
            <Key size={32} style={{ color: "var(--primary)", margin: "0 auto 12px" }} />
            <h3 style={{ fontSize: "22px", color: "#fff", marginBottom: "6px" }}>Compliance Authorization</h3>
            <p style={{ fontSize: "13px", color: "var(--text-secondary)" }}>Access restricted to auditing compliance members.</p>
          </div>
          
          {loginError && (
            <div style={{ background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.2)", padding: "10px 14px", borderRadius: "8px", color: "var(--risk-high)", fontSize: "12px", marginBottom: "16px" }}>
              {loginError}
            </div>
          )}

          <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div>
              <label style={{ display: "block", fontSize: "12px", color: "var(--text-secondary)", marginBottom: "4px" }}>Username</label>
              <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} className="text-input" placeholder="e.g. auditor" />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "12px", color: "var(--text-secondary)", marginBottom: "4px" }}>Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="text-input" placeholder="e.g. password123" />
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: "100%", marginTop: "8px" }}>Authorize Access</button>
          </form>
          
          <div style={{ marginTop: "24px", borderTop: "1px solid var(--glass-border)", paddingTop: "16px", fontSize: "12px", color: "var(--text-muted)", textAlign: "center" }}>
            <p>Sandbox Credentials:</p>
            <p style={{ fontFamily: "var(--font-mono)", marginTop: "4px", color: "var(--text-secondary)" }}>Username: auditor | Password: password123</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ padding: "32px 24px" }}>
      
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "32px" }}>
        <div>
          <h2 style={{ fontSize: "28px", color: "#fff", fontWeight: 800 }}>Compliance Control Board</h2>
          <p style={{ fontSize: "14px", color: "var(--text-secondary)" }}>
            Analyze risk scores, customize compliance rule engine configurations, and review duplicate entity checks.
          </p>
        </div>
        <div style={{ display: "flex", gap: "12px" }}>
          <button 
            onClick={() => setActiveTab(activeTab === "audits" ? "rules" : "audits")} 
            className="btn btn-secondary"
            style={{ display: "flex", gap: "6px" }}
          >
            <Settings size={14} />
            {activeTab === "audits" ? "Compliance Rules" : "Auditor Dashboard"}
          </button>
          <button 
            onClick={() => setActiveTab("webhooks")} 
            className="btn btn-secondary"
            style={{ display: "flex", gap: "6px" }}
          >
            <Globe size={14} />
            Webhooks
          </button>
          <button onClick={handleLogout} className="btn btn-secondary" style={{ color: "var(--risk-high)", borderColor: "rgba(239, 68, 68, 0.2)" }}>
            <LogOut size={14} />
            Logout
          </button>
        </div>
      </div>

      {activeTab === "audits" ? (
        <>
          {/* Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "20px", marginBottom: "32px" }}>
            <div className="glass-card" style={{ padding: "20px" }}>
              <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "4px" }}>Total Onboarded</div>
              <div style={{ fontSize: "28px", fontWeight: 800, color: "#fff" }}>{totalOnboarded}</div>
            </div>
            <div className="glass-card" style={{ padding: "20px" }}>
              <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "4px" }}>Approved Onboardings</div>
              <div style={{ fontSize: "28px", fontWeight: 800, color: "var(--risk-low)" }}>{approvedCount}</div>
            </div>
            <div className="glass-card" style={{ padding: "20px" }}>
              <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "4px" }}>Flagged Review Queue</div>
              <div style={{ fontSize: "28px", fontWeight: 800, color: "var(--risk-medium)" }}>{pendingCount}</div>
            </div>
            <div className="glass-card" style={{ padding: "20px" }}>
              <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "4px" }}>Auto-Rejected Fraud</div>
              <div style={{ fontSize: "28px", fontWeight: 800, color: "var(--risk-high)" }}>{rejectedCount}</div>
            </div>
            <div className="glass-card" style={{ padding: "20px" }}>
              <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "4px" }}>Portfolio Risk Index</div>
              <div style={{ fontSize: "28px", fontWeight: 800, color: avgRiskScore > 60 ? "var(--risk-high)" : avgRiskScore > 30 ? "var(--risk-medium)" : "var(--risk-low)" }}>{avgRiskScore}/100</div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "350px 1fr", gap: "32px", alignItems: "start" }}>
            
            {/* List */}
            <div>
              <div className="glass-panel" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ position: "relative" }}>
                  <Search size={14} style={{ position: "absolute", left: "12px", top: "13px", color: "var(--text-muted)" }} />
                  <input 
                    type="text" 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by legal name/tax id..." 
                    className="text-input"
                    style={{ paddingLeft: "36px", fontSize: "13px" }}
                  />
                </div>

                <div style={{ display: "flex", background: "rgba(0,0,0,0.2)", borderRadius: "6px", padding: "2px" }}>
                  {["ALL", "FLAGGED", "APPROVED", "REJECTED"].map((f) => (
                    <button 
                      key={f}
                      onClick={() => setStatusFilter(f)}
                      style={{
                        flex: 1,
                        padding: "6px 0",
                        fontSize: "11px",
                        fontWeight: 700,
                        background: statusFilter === f ? "rgba(255,255,255,0.06)" : "transparent",
                        color: statusFilter === f ? "#fff" : "var(--text-secondary)",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer"
                      }}
                    >
                      {f}
                    </button>
                  ))}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxHeight: "400px", overflowY: "auto" }}>
                  {filteredMerchants.length === 0 ? (
                    <div style={{ textAlign: "center", color: "var(--text-muted)", fontSize: "12px", padding: "20px 0" }}>No matching merchants found.</div>
                  ) : (
                    filteredMerchants.map((m) => {
                      const isSelected = selectedMerchant?.id === m.id;
                      let statusColor = "var(--text-muted)";
                      if (m.status === "APPROVED") statusColor = "var(--risk-low)";
                      else if (m.status === "FLAGGED") statusColor = "var(--risk-medium)";
                      else if (m.status === "REJECTED") statusColor = "var(--risk-high)";
                      
                      return (
                        <div 
                          key={m.id}
                          onClick={() => setSelectedMerchant(m)}
                          style={{
                            background: isSelected ? "rgba(99,102,241,0.08)" : "rgba(255,255,255,0.02)",
                            border: `1px solid ${isSelected ? "var(--primary)" : "var(--glass-border)"}`,
                            borderRadius: "8px",
                            padding: "12px 14px",
                            cursor: "pointer",
                            transition: "all 0.2s"
                          }}
                        >
                          <div style={{ display: "flex", justifySpaceBetween: "space-between", alignItems: "center", justifyContent: "space-between" }}>
                            <span style={{ fontSize: "13px", fontWeight: 700, color: "#fff" }}>{m.business_name}</span>
                            <span style={{ fontSize: "9px", fontWeight: 800, color: statusColor, display: "inline-flex", alignItems: "center", gap: "4px" }}>
                              <span style={{ width: "4px", height: "4px", borderRadius: "50%", background: statusColor }} />
                              {m.status}
                            </span>
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "var(--text-secondary)", marginTop: "6px" }}>
                            <span>{m.business_type}</span>
                            <span>Score: {m.report?.risk_score || 0}</span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* Details panel */}
            <div>
              {selectedMerchant ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                  
                  {/* Summary */}
                  <div className="glass-panel" style={{ padding: "28px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "20px" }}>
                      <div>
                        <h3 style={{ fontSize: "22px", color: "#fff", display: "flex", alignItems: "center", gap: "10px" }}>
                          {selectedMerchant.business_name}
                          <a href={selectedMerchant.business_website} target="_blank" rel="noreferrer" style={{ color: "var(--primary)" }}>
                            <ExternalLink size={16} />
                          </a>
                        </h3>
                        <p style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "4px" }}>
                          Registered ID: {selectedMerchant.registration_number} • Phone: {selectedMerchant.phone} • Owner: {selectedMerchant.owner_name}
                        </p>
                      </div>
                      <button onClick={printComplianceReport} className="btn btn-secondary">
                        <Printer size={14} />
                        Export Report
                      </button>
                    </div>

                    <div style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1px 1.5fr",
                      gap: "24px",
                      background: "rgba(0,0,0,0.15)",
                      padding: "20px",
                      borderRadius: "8px",
                      border: "1px solid var(--glass-border)"
                    }}>
                      <div style={{ textAlign: "center", display: "flex", flexDirection: "column", justifyContent: "center" }}>
                        <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "4px" }}>Audit Risk Score</div>
                        <div style={{
                          fontSize: "36px",
                          fontWeight: 900,
                          color: selectedMerchant.report?.risk_category === "LOW" ? "var(--risk-low)" : selectedMerchant.report?.risk_category === "MEDIUM" ? "var(--risk-medium)" : "var(--risk-high)"
                        }}>
                          {selectedMerchant.report?.risk_score || 0}<span style={{ fontSize: "16px", fontWeight: 500, color: "var(--text-secondary)" }}>/100</span>
                        </div>
                        <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-secondary)" }}>
                          {selectedMerchant.report?.risk_category || "PENDING"} RISK
                        </div>
                      </div>
                      <div style={{ width: "1px", background: "var(--glass-border)" }} />
                      <div>
                        <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "4px" }}>Smart Routing Gateway</div>
                        <div style={{ fontSize: "15px", fontWeight: 700, color: "#fff", marginTop: "4px" }}>
                          Processor: {selectedMerchant.report?.routing_processor || "Not Configured"}
                        </div>
                        <div style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "4px" }}>
                          Transaction Processing Fee: <span style={{ color: "var(--primary)", fontWeight: 800 }}>{selectedMerchant.report?.routing_fee || 0}%</span> per card transaction
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* SVG Geo Fraud map widget */}
                  <div className="glass-panel" style={{ padding: "24px" }}>
                    <h4 style={{ fontSize: "15px", color: "#fff", marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
                      <Map size={16} style={{ color: "var(--primary)" }} />
                      Geographical Risk & Proxy Threat Heatmap
                    </h4>
                    
                    <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: "24px", alignItems: "center" }}>
                      {/* SVG World Map outlines */}
                      <div style={{
                        height: "180px",
                        background: "rgba(0,0,0,0.25)",
                        borderRadius: "8px",
                        border: "1px solid var(--glass-border)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        position: "relative"
                      }}>
                        <svg viewBox="0 0 400 200" style={{ width: "100%", height: "100%", stroke: "#1f2937", strokeWidth: "1", fill: "#111827" }}>
                          {/* Mock continents */}
                          <path d="M50,40 Q80,20 120,40 T150,80 T100,120 Z" />
                          <path d="M220,50 Q260,30 300,50 T340,90 T260,140 Z" />
                          <path d="M80,110 Q120,130 110,180 T70,160 Z" />
                          {/* Glow nodes indicating server/applicant locations */}
                          <circle cx="110" cy="70" r="4" fill="var(--primary)" className="streaming-line" />
                          <circle cx="280" cy="80" r="4" fill="var(--risk-low)" />
                          <circle cx="120" cy="65" r="4" fill="var(--risk-medium)" />
                          {/* Connection line showing proxy route */}
                          <path d="M 110 70 Q 200 40 280 80" fill="none" stroke="var(--risk-high)" strokeWidth="1.5" strokeDasharray="4 2" className="streaming-line" />
                        </svg>
                        <div style={{ position: "absolute", bottom: "10px", left: "10px", fontSize: "10px", color: "var(--text-muted)" }}>
                          Line represents Proxy routing path identified from applicant IP registry.
                        </div>
                      </div>
                      
                      {/* Georisk metrics logs */}
                      <div style={{ display: "flex", flexDirection: "column", gap: "12px", fontSize: "12px" }}>
                        <div style={{ display: "flex", justifySpaceBetween: "space-between", justifyContent: "space-between", borderBottom: "1px solid var(--glass-border)", paddingBottom: "6px" }}>
                          <span style={{ color: "var(--text-secondary)" }}>Applicant IP Origin:</span>
                          <span style={{ fontWeight: 700, color: "#fff" }}>Mumbai, IN (103.24.12.8)</span>
                        </div>
                        <div style={{ display: "flex", justifySpaceBetween: "space-between", justifyContent: "space-between", borderBottom: "1px solid var(--glass-border)", paddingBottom: "6px" }}>
                          <span style={{ color: "var(--text-secondary)" }}>Proxy / VPN Match:</span>
                          <span style={{ fontWeight: 700, color: "var(--risk-low)" }}>CLEAN (Direct ISP)</span>
                        </div>
                        <div style={{ display: "flex", justifySpaceBetween: "space-between", justifyContent: "space-between", borderBottom: "1px solid var(--glass-border)", paddingBottom: "6px" }}>
                          <span style={{ color: "var(--text-secondary)" }}>Hosting Provider Node:</span>
                          <span style={{ fontWeight: 700, color: "#fff" }}>Reliance Jio Infr</span>
                        </div>
                        <div style={{ display: "flex", justifySpaceBetween: "space-between", justifyContent: "space-between", borderBottom: "1px solid var(--glass-border)", paddingBottom: "6px" }}>
                          <span style={{ color: "var(--text-secondary)" }}>Sanction Lists Match:</span>
                          <span style={{ fontWeight: 700, color: "var(--risk-low)" }}>0 MATCHES (OFAC / UN)</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* SVG collaboration graph */}
                  <div className="glass-panel" style={{ padding: "24px" }}>
                    <h4 style={{ fontSize: "15px", color: "#fff", marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
                      <Network size={16} style={{ color: "var(--primary)" }} />
                      AI Agent Collaboration Graph
                    </h4>
                    
                    <div style={{
                      height: "120px",
                      background: "rgba(0,0,0,0.2)",
                      border: "1px solid var(--glass-border)",
                      borderRadius: "8px",
                      position: "relative",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "0 40px"
                    }}>
                      <svg style={{ position: "absolute", left: 0, top: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 0 }}>
                        <line x1="100" y1="60" x2="250" y2="60" stroke="var(--primary)" strokeWidth="2" strokeDasharray="5 5" className="streaming-line" />
                        <line x1="250" y1="60" x2="400" y2="60" stroke="var(--primary)" strokeWidth="2" strokeDasharray="5 5" className="streaming-line" />
                        <line x1="400" y1="60" x2="560" y2="60" stroke="var(--primary)" strokeWidth="2" strokeDasharray="5 5" className="streaming-line" />
                      </svg>
                      
                      {[
                        { label: "Document Extractor", desc: "PAN/Tax Checksums", color: "#6366f1" },
                        { label: "Website Auditor", desc: "SSL & Content", color: "#a855f7" },
                        { label: "KYB Registry Validator", desc: "Corporate verification", color: "#0ea5e9" },
                        { label: "Risk Classifier", desc: "Zero-error consensus", color: "#10b981" }
                      ].map((n, idx) => (
                        <div key={idx} style={{ zIndex: 10, textAlign: "center", width: "120px", display: "flex", flexDirection: "column", alignItems: "center" }}>
                          <div style={{
                            width: "32px",
                            height: "32px",
                            borderRadius: "50%",
                            background: n.color,
                            boxShadow: `0 0 15px ${n.color}`,
                            border: "2px solid #fff",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "11px",
                            fontWeight: 800,
                            color: "#fff"
                          }}>{idx + 1}</div>
                          <span style={{ fontSize: "11px", fontWeight: 700, color: "#fff", marginTop: "6px" }}>{n.label}</span>
                          <span style={{ fontSize: "9px", color: "var(--text-secondary)", marginTop: "1px" }}>{n.desc}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
                    
                    {/* Extracted Details */}
                    <div className="glass-panel" style={{ padding: "20px" }}>
                      <h4 style={{ fontSize: "14px", color: "#fff", borderBottom: "1px solid var(--glass-border)", paddingBottom: "8px", marginBottom: "12px" }}>
                        Extracted Verification Details
                      </h4>
                      <div style={{ display: "flex", flexDirection: "column", gap: "12px", fontSize: "13px" }}>
                        <div style={{ display: "flex", justifySpaceBetween: "space-between", justifyContent: "space-between" }}>
                          <span style={{ color: "var(--text-secondary)" }}>Incorporation Date:</span>
                          <span style={{ fontWeight: 700, color: "#fff" }}>{selectedMerchant.report?.extracted_data?.incorporation_date || "2021-03-15"}</span>
                        </div>
                        <div style={{ display: "flex", justifySpaceBetween: "space-between", justifyContent: "space-between" }}>
                          <span style={{ color: "var(--text-secondary)" }}>Tax Registry Status:</span>
                          <span style={{ fontWeight: 700, color: selectedMerchant.report?.extracted_data?.tax_status === "ACTIVE" ? "var(--risk-low)" : "var(--risk-high)" }}>
                            {selectedMerchant.report?.extracted_data?.tax_status || "ACTIVE"}
                          </span>
                        </div>
                        <div style={{ display: "flex", justifySpaceBetween: "space-between", justifyContent: "space-between" }}>
                          <span style={{ color: "var(--text-secondary)" }}>Registry Format ID:</span>
                          <span style={{ fontWeight: 700, color: "#fff" }}>{selectedMerchant.report?.extracted_data?.tax_type || "PAN (India)"}</span>
                        </div>
                        <div style={{ display: "flex", justifySpaceBetween: "space-between", justifyContent: "space-between" }}>
                          <span style={{ color: "var(--text-secondary)" }}>Crawler SSL Status:</span>
                          <span style={{ fontWeight: 700, color: selectedMerchant.report?.website_audit?.ssl_active ? "var(--risk-low)" : "var(--risk-high)" }}>
                            {selectedMerchant.report?.website_audit?.ssl_active ? "SECURE (HTTPS)" : "UNSECURE (HTTP)"}
                          </span>
                        </div>
                        <div style={{ display: "flex", justifySpaceBetween: "space-between", justifyContent: "space-between" }}>
                          <span style={{ color: "var(--text-secondary)" }}>Restricted Content Found:</span>
                          <span style={{ fontWeight: 700, color: selectedMerchant.report?.website_audit?.restricted_categories_found?.length > 0 ? "var(--risk-high)" : "var(--risk-low)" }}>
                            {selectedMerchant.report?.website_audit?.restricted_categories_found?.join(", ") || "None"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Risk Flags */}
                    <div className="glass-panel" style={{ padding: "20px" }}>
                      <h4 style={{ fontSize: "14px", color: "#fff", borderBottom: "1px solid var(--glass-border)", paddingBottom: "8px", marginBottom: "12px" }}>
                        Risk Flags
                      </h4>
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "150px", overflowY: "auto" }}>
                        {!selectedMerchant.report?.risk_factors || selectedMerchant.report.risk_factors.length === 0 ? (
                          <div style={{ fontSize: "12px", color: "var(--text-muted)", padding: "10px 0" }}>No significant risk flags compiled by agents.</div>
                        ) : (
                          selectedMerchant.report.risk_factors.map((f: any, idx: number) => (
                            <div key={idx} style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              background: "rgba(0,0,0,0.15)",
                              padding: "8px 10px",
                              borderRadius: "6px",
                              fontSize: "12px"
                            }}>
                              <span style={{ color: "#fff", width: "80%" }}>{f.factor}</span>
                              <span style={{
                                fontSize: "9px",
                                fontWeight: 800,
                                color: f.severity === "HIGH" ? "var(--risk-high)" : "var(--risk-medium)",
                                background: f.severity === "HIGH" ? "var(--risk-high-bg)" : "var(--risk-medium-bg)",
                                padding: "2px 6px",
                                borderRadius: "4px"
                              }}>{f.severity}</span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Guided Checklist & Overrides */}
                  <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "24px" }}>
                    
                    {/* Guided Checklist and override */}
                    <div className="glass-panel" style={{ padding: "20px" }}>
                      <h4 style={{ fontSize: "14px", color: "#fff", borderBottom: "1px solid var(--glass-border)", paddingBottom: "8px", marginBottom: "12px" }}>
                        Guided Auditor Verification & Override
                      </h4>
                      
                      {/* Checkboxes */}
                      <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "16px", fontSize: "12px" }}>
                        <div 
                          onClick={() => setChecklist(prev => ({ ...prev, registry: !prev.registry }))}
                          style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}
                        >
                          {checklist.registry ? <CheckSquare size={16} style={{ color: "var(--risk-low)" }} /> : <Square size={16} />}
                          <span>Confirm state registrar matches incorporation doc status</span>
                        </div>
                        <div 
                          onClick={() => setChecklist(prev => ({ ...prev, domain: !prev.domain }))}
                          style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}
                        >
                          {checklist.domain ? <CheckSquare size={16} style={{ color: "var(--risk-low)" }} /> : <Square size={16} />}
                          <span>Confirm website WHOIS registry domain matches owner identity</span>
                        </div>
                        <div 
                          onClick={() => setChecklist(prev => ({ ...prev, sanctions: !prev.sanctions }))}
                          style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}
                        >
                          {checklist.sanctions ? <CheckSquare size={16} style={{ color: "var(--risk-low)" }} /> : <Square size={16} />}
                          <span>Verify corporate structure is clear of OFAC/Sanctions list</span>
                        </div>
                        <div 
                          onClick={() => setChecklist(prev => ({ ...prev, banking: !prev.banking }))}
                          style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}
                        >
                          {checklist.banking ? <CheckSquare size={16} style={{ color: "var(--risk-low)" }} /> : <Square size={16} />}
                          <span>Confirm merchant account bank routing details are active</span>
                        </div>
                      </div>

                      <form onSubmit={submitOverride} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                          <div>
                            <label style={{ display: "block", fontSize: "11px", color: "var(--text-secondary)", marginBottom: "4px" }}>Action</label>
                            <select 
                              value={overrideAction}
                              onChange={(e) => setOverrideAction(e.target.value)}
                              className="text-input"
                              style={{ background: "rgba(8,10,15,0.8)", fontSize: "12px" }}
                            >
                              <option value="MANUAL_APPROVE">MANUAL APPROVE</option>
                              <option value="MANUAL_REJECT">MANUAL REJECT</option>
                              <option value="MANUAL_FLAG">MANUAL FLAG</option>
                            </select>
                          </div>
                          <div>
                            <label style={{ display: "block", fontSize: "11px", color: "var(--text-secondary)", marginBottom: "4px" }}>Audit Notes</label>
                            <input 
                              type="text" 
                              value={overrideNotes}
                              onChange={(e) => setOverrideNotes(e.target.value)}
                              className="text-input"
                              placeholder="Notes for compliance trail..."
                              style={{ fontSize: "12px" }}
                              required
                            />
                          </div>
                        </div>
                        <button 
                          type="submit" 
                          disabled={!isChecklistCompleted}
                          className="btn btn-primary" 
                          style={{ width: "100%", height: "38px", fontSize: "13px", opacity: isChecklistCompleted ? 1 : 0.4 }}
                        >
                          Commit Override Decision
                        </button>
                      </form>
                    </div>

                    {/* Timeline */}
                    <div className="glass-panel" style={{ padding: "20px" }}>
                      <h4 style={{ fontSize: "14px", color: "#fff", borderBottom: "1px solid var(--glass-border)", paddingBottom: "8px", marginBottom: "12px" }}>
                        Audit History Timeline
                      </h4>
                      <div style={{ display: "flex", flexDirection: "column", gap: "14px", maxHeight: "200px", overflowY: "auto" }}>
                        {selectedMerchant.audit_trails?.map((t: any) => (
                          <div key={t.id} style={{ display: "flex", gap: "10px", fontSize: "12px" }}>
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                              <div style={{
                                width: "8px",
                                height: "8px",
                                borderRadius: "50%",
                                background: t.action.includes("APPROVE") ? "var(--risk-low)" : t.action.includes("REJECT") ? "var(--risk-high)" : "var(--primary)"
                              }} />
                              <div style={{ flex: 1, width: "1px", background: "var(--glass-border)", marginTop: "4px" }} />
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ display: "flex", justifyContent: "space-between" }}>
                                <span style={{ fontWeight: 700, color: "#fff" }}>{t.action}</span>
                                <span style={{ color: "var(--text-muted)", fontSize: "10px" }}>{t.timestamp?.substring(11, 19)}</span>
                              </div>
                              <p style={{ color: "var(--text-secondary)", marginTop: "2px" }}>{t.notes}</p>
                              {t.user && <p style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "2px" }}>Auditor: {t.user.username}</p>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                </div>
              ) : (
                <div className="glass-panel" style={{ padding: "40px", textAlign: "center" }}>
                  <Users size={32} style={{ color: "var(--text-muted)", margin: "0 auto 16px" }} />
                  <p style={{ color: "var(--text-secondary)" }}>No merchants loaded. Submit an onboarding form first.</p>
                </div>
              )}
            </div>
          </div>
        </>
      ) : activeTab === "rules" ? (
        /* Dynamic Compliance Rules Settings Tab */
        <div className="glass-panel" style={{ padding: "32px", maxWidth: "800px", margin: "0 auto" }}>
          <h3 style={{ fontSize: "20px", color: "#fff", marginBottom: "8px", display: "flex", alignItems: "center", gap: "10px" }}>
            <Settings style={{ color: "var(--primary)" }} />
            Compliance Rules Engine Settings
          </h3>
          <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "24px" }}>
            Customize verification assertions. Enabled rules run on the consensus agent check pipeline.
          </p>
          
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {complianceRules.map((rule) => (
              <div 
                key={rule.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  background: "rgba(0,0,0,0.15)",
                  padding: "16px 20px",
                  borderRadius: "8px",
                  border: "1px solid var(--glass-border)"
                }}
              >
                <div>
                  <div style={{ fontSize: "14px", fontWeight: 700, color: "#fff", fontFamily: "var(--font-mono)" }}>
                    {rule.rule_key}
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "4px" }}>
                    {rule.description}
                  </div>
                </div>
                <button 
                  onClick={() => toggleComplianceRule(rule.rule_key, rule.value_bool)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: rule.value_bool ? "var(--risk-low)" : "var(--text-muted)" }}
                >
                  {rule.value_bool ? <ToggleRight size={36} /> : <ToggleLeft size={36} />}
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* Webhooks panel view */
        <div className="glass-panel" style={{ padding: "32px", maxWidth: "800px", margin: "0 auto" }}>
          <h3 style={{ fontSize: "20px", color: "#fff", marginBottom: "8px", display: "flex", alignItems: "center", gap: "10px" }}>
            <Globe style={{ color: "var(--primary)" }} />
            Webhook Callback Integrations
          </h3>
          <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "24px" }}>
            Register URLs to receive automated verification callbacks once reviews process.
          </p>

          <form onSubmit={registerWebhook} style={{ display: "flex", gap: "12px", marginBottom: "32px" }}>
            <input 
              type="url" 
              value={newWebhookUrl}
              onChange={(e) => setNewWebhookUrl(e.target.value)}
              placeholder="e.g. https://api.yourdomain.com/webhooks/compliance" 
              className="text-input"
              required
            />
            <button type="submit" className="btn btn-primary" style={{ display: "flex", gap: "4px" }}>
              <Plus size={16} /> Add Link
            </button>
          </form>

          <h4 style={{ fontSize: "14px", color: "#fff", borderBottom: "1px solid var(--glass-border)", paddingBottom: "8px", marginBottom: "16px" }}>
            Active Subscriptions
          </h4>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {webhooks.length === 0 ? (
              <div style={{ color: "var(--text-muted)", fontSize: "13px", padding: "10px 0" }}>No webhooks configured.</div>
            ) : (
              webhooks.map((w) => (
                <div key={w.id} style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  background: "rgba(0,0,0,0.15)",
                  padding: "16px 20px",
                  borderRadius: "8px",
                  border: "1px solid var(--glass-border)"
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "14px", fontWeight: 700, color: "#fff" }}>{w.url}</div>
                    <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px", fontFamily: "var(--font-mono)" }}>
                      Signature Key secret: {w.secret}
                    </div>
                  </div>
                  <button onClick={() => deleteWebhook(w.id)} style={{
                    background: "none",
                    border: "none",
                    color: "var(--risk-high)",
                    cursor: "pointer",
                    padding: "6px"
                  }}>
                    <Trash2 size={16} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

    </div>
  );
}

"use client";

import React, { useState, useEffect } from "react";
import { 
  BarChart3, Users, ShieldAlert, CheckCircle, Clock, Search, ExternalLink, 
  Settings, Database, Network, Key, ArrowUpRight, ShieldCheck, Printer, Plus, Trash2, LogOut
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
  const [activeTab, setActiveTab] = useState<"audits" | "webhooks">("audits");
  
  // Override form states
  const [overrideNotes, setOverrideNotes] = useState("");
  const [overrideAction, setOverrideAction] = useState("MANUAL_APPROVE");
  
  // Webhooks states
  const [webhooks, setWebhooks] = useState<any[]>([]);
  const [newWebhookUrl, setNewWebhookUrl] = useState("");

  const apiHost = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  // Check for stored token
  useEffect(() => {
    const savedToken = localStorage.getItem("smartmerchant_token");
    if (savedToken) {
      setToken(savedToken);
    }
  }, []);

  // Fetch data if authenticated
  useEffect(() => {
    if (token) {
      fetchMerchants();
      fetchWebhooks();
      
      // Setup live status socket for administrative feed
      const wsUrl = apiHost.replace("http", "ws");
      const socket = new WebSocket(`${wsUrl}/ws/status/global`);
      
      socket.onmessage = (event) => {
        const payload = JSON.parse(event.data);
        console.log("Global WS update:", payload);
        // Refresh list on completed, errors, or updates
        fetchMerchants();
      };
      
      return () => {
        socket.close();
      };
    }
  }, [token]);

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
      
      if (!response.ok) {
        throw new Error("Invalid auditor credentials");
      }
      
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
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error("Failed to fetch merchants");
      const data = await response.json();
      setMerchants(data);
      
      // Auto select first merchant if none selected
      if (data.length > 0 && !selectedMerchant) {
        setSelectedMerchant(data[0]);
      } else if (selectedMerchant) {
        // Update selected merchant references
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
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setWebhooks(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const submitOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMerchant) return;
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
      } else {
        alert("Failed to apply auditor override.");
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
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (response.ok) {
        fetchWebhooks();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const printComplianceReport = () => {
    if (!selectedMerchant) return;
    
    // Simple printable window rendering
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
            .badge { display: inline-block; padding: 4px 10px; border-radius: 4px; font-size: 12px; font-weight: 700; }
            .badge-low { background: #d1fae5; color: #065f46; }
            .badge-medium { background: #fef3c7; color: #92400e; }
            .badge-high { background: #fee2e2; color: #991b1b; }
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
            <div class="section-title">Merchant Details</div>
            <div class="grid">
              <div>
                <div class="label">Business Name</div>
                <div class="val">${selectedMerchant.business_name}</div>
              </div>
              <div>
                <div class="label">Website</div>
                <div class="val">${selectedMerchant.business_website}</div>
              </div>
              <div>
                <div class="label">Owner Name</div>
                <div class="val">${selectedMerchant.owner_name}</div>
              </div>
              <div>
                <div class="label">Business Type</div>
                <div class="val">${selectedMerchant.business_type}</div>
              </div>
            </div>
          </div>

          <div class="section">
            <div class="section-title">Risk Assessment Summary</div>
            <div class="grid">
              <div>
                <div class="label">Overall Outcome</div>
                <div class="val">${selectedMerchant.status}</div>
              </div>
              <div>
                <div class="label">Risk Score</div>
                <div class="val">${r ? r.risk_score : 0}/100 (${r ? r.risk_category : "N/A"})</div>
              </div>
              <div>
                <div class="label">Recommended Gateway</div>
                <div class="val">${r ? r.routing_processor : "N/A"}</div>
              </div>
              <div>
                <div class="label">Gateway Processing Fee</div>
                <div class="val">${r ? r.routing_fee : 0}%</div>
              </div>
            </div>
            <p style="font-size: 13px; margin-top: 14px; font-style: italic;"><strong>Summary:</strong> ${r ? r.agent_summary : "N/A"}</p>
          </div>

          <div class="section">
            <div class="section-title">Risk Analysis Checklist</div>
            <table>
              <thead>
                <tr>
                  <th>Risk Factor / Concern</th>
                  <th>Severity</th>
                </tr>
              </thead>
              <tbody>
                ${r && r.risk_factors && r.risk_factors.length > 0 
                  ? r.risk_factors.map((f: any) => `
                      <tr>
                        <td>${f.factor}</td>
                        <td>${f.severity}</td>
                      </tr>
                    `).join("")
                  : `<tr><td colspan="2">No major risk factors detected.</td></tr>`
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

  // Filter merchants
  const filteredMerchants = merchants.filter(m => {
    const matchSearch = m.business_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        m.registration_number.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (statusFilter === "ALL") return matchSearch;
    return m.status === statusFilter && matchSearch;
  });

  // Calculate high-level stats
  const totalOnboarded = merchants.length;
  const approvedCount = merchants.filter(m => m.status === "APPROVED").length;
  const pendingCount = merchants.filter(m => m.status === "FLAGGED").length;
  const rejectedCount = merchants.filter(m => m.status === "REJECTED").length;
  
  const avgRiskScore = totalOnboarded > 0
    ? Math.round(merchants.reduce((acc, curr) => acc + (curr.report?.risk_score || 0), 0) / totalOnboarded)
    : 0;

  if (!token) {
    return (
      <div style={{
        minHeight: "calc(100vh - 60px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px"
      }}>
        <div className="glass-panel" style={{ padding: "32px", width: "100%", maxWidth: "420px" }}>
          <div style={{ textAlign: "center", marginBottom: "24px" }}>
            <Key size={32} style={{ color: "var(--primary)", margin: "0 auto 12px" }} />
            <h3 style={{ fontSize: "22px", color: "#fff", marginBottom: "6px" }}>Auditor Authorization</h3>
            <p style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
              Access restricted to legal and compliance administrators.
            </p>
          </div>
          
          {loginError && (
            <div style={{
              background: "rgba(239, 68, 68, 0.1)",
              border: "1px solid rgba(239, 68, 68, 0.2)",
              padding: "10px 14px",
              borderRadius: "8px",
              color: "var(--risk-high)",
              fontSize: "12px",
              marginBottom: "16px"
            }}>
              {loginError}
            </div>
          )}

          <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div>
              <label style={{ display: "block", fontSize: "12px", color: "var(--text-secondary)", marginBottom: "4px" }}>Username</label>
              <input 
                type="text" 
                value={username} 
                onChange={(e) => setUsername(e.target.value)} 
                className="text-input" 
                placeholder="e.g. auditor"
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "12px", color: "var(--text-secondary)", marginBottom: "4px" }}>Password</label>
              <input 
                type="password" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                className="text-input" 
                placeholder="e.g. password123"
              />
            </div>
            
            <button type="submit" className="btn btn-primary" style={{ width: "100%", marginTop: "8px" }}>
              Authorize Access
            </button>
          </form>

          <div style={{
            marginTop: "24px",
            borderTop: "1px solid var(--glass-border)",
            paddingTop: "16px",
            fontSize: "12px",
            color: "var(--text-muted)",
            textAlign: "center"
          }}>
            <p>Sandbox Credentials:</p>
            <p style={{ fontFamily: "var(--font-mono)", marginTop: "4px", color: "var(--text-secondary)" }}>Username: auditor | Password: password123</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ padding: "32px 24px" }}>
      
      {/* Top dashboard header info */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "32px" }}>
        <div>
          <h2 style={{ fontSize: "28px", color: "#fff", fontWeight: 800 }}>Compliance Control Board</h2>
          <p style={{ fontSize: "14px", color: "var(--text-secondary)" }}>
            Review merchant entity verifications, set gateway routing overrides, and configure webhook delivery.
          </p>
        </div>
        <div style={{ display: "flex", gap: "12px" }}>
          <button 
            onClick={() => setActiveTab(activeTab === "audits" ? "webhooks" : "audits")} 
            className="btn btn-secondary"
          >
            {activeTab === "audits" ? <Settings size={14} /> : <Database size={14} />}
            {activeTab === "audits" ? "Configure Webhooks" : "Merchant Audits"}
          </button>
          <button onClick={handleLogout} className="btn btn-secondary" style={{ color: "var(--risk-high)", borderColor: "rgba(239, 68, 68, 0.2)" }}>
            <LogOut size={14} />
            Logout
          </button>
        </div>
      </div>

      {activeTab === "audits" ? (
        <>
          {/* Dashboard Stats */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "20px",
            marginBottom: "32px"
          }}>
            <div className="glass-card" style={{ padding: "20px" }}>
              <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "4px" }}>Total Merchants</div>
              <div style={{ fontSize: "28px", fontWeight: 800, color: "#fff" }}>{totalOnboarded}</div>
            </div>
            <div className="glass-card" style={{ padding: "20px" }}>
              <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "4px" }}>Approved Onboardings</div>
              <div style={{ fontSize: "28px", fontWeight: 800, color: "var(--risk-low)" }}>{approvedCount}</div>
            </div>
            <div className="glass-card" style={{ padding: "20px" }}>
              <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "4px" }}>Flagged / Reviews</div>
              <div style={{ fontSize: "28px", fontWeight: 800, color: "var(--risk-medium)" }}>{pendingCount}</div>
            </div>
            <div className="glass-card" style={{ padding: "20px" }}>
              <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "4px" }}>Auto-Rejected</div>
              <div style={{ fontSize: "28px", fontWeight: 800, color: "var(--risk-high)" }}>{rejectedCount}</div>
            </div>
            <div className="glass-card" style={{ padding: "20px" }}>
              <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "4px" }}>Avg Portfolio Risk</div>
              <div style={{ fontSize: "28px", fontWeight: 800, color: avgRiskScore > 60 ? "var(--risk-high)" : avgRiskScore > 30 ? "var(--risk-medium)" : "var(--risk-low)" }}>
                {avgRiskScore}/100
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "350px 1fr", gap: "32px", alignItems: "start" }}>
            
            {/* Merchant Left list */}
            <div>
              <div className="glass-panel" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
                
                {/* Search */}
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

                {/* Filter Tabs */}
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
                        cursor: "pointer",
                        transition: "all 0.2s"
                      }}
                    >
                      {f}
                    </button>
                  ))}
                </div>

                {/* List Items */}
                <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxHeight: "450px", overflowY: "auto" }}>
                  {filteredMerchants.length === 0 ? (
                    <div style={{ textAlign: "center", color: "var(--text-muted)", fontSize: "12px", padding: "20px 0" }}>No merchants matched filters.</div>
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
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontSize: "13px", fontWeight: 700, color: "#fff" }}>{m.business_name}</span>
                            <span style={{
                              fontSize: "9px",
                              fontWeight: 800,
                              color: statusColor,
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px"
                            }}>
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

            {/* Merchant Detail View Right panel */}
            <div>
              {selectedMerchant ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                  
                  {/* Summary & Actions Block */}
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
                          Registered PAN/EIN: {selectedMerchant.registration_number} • Owner: {selectedMerchant.owner_name}
                        </p>
                      </div>
                      
                      {/* Actions */}
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
                        <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "4px" }}>Smart Payment Route</div>
                        <div style={{ fontSize: "15px", fontWeight: 700, color: "#fff", marginTop: "4px" }}>
                          Processor: {selectedMerchant.report?.routing_processor || "Not Configured"}
                        </div>
                        <div style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "4px" }}>
                          Dynamic Processing Fee: <span style={{ color: "var(--primary)", fontWeight: 800 }}>{selectedMerchant.report?.routing_fee || 0}%</span> per transaction
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* AI Agent Collaboration Graph Visualizer */}
                  <div className="glass-panel" style={{ padding: "24px" }}>
                    <h4 style={{ fontSize: "15px", color: "#fff", marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
                      <Network size={16} style={{ color: "var(--primary)" }} />
                      AI Agent Collaboration Graph
                    </h4>

                    {/* SVG Graph visualizer */}
                    <div style={{
                      height: "140px",
                      background: "rgba(0,0,0,0.2)",
                      border: "1px solid var(--glass-border)",
                      borderRadius: "8px",
                      position: "relative",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "0 40px"
                    }}>
                      {/* Connections line SVGs */}
                      <svg style={{ position: "absolute", left: 0, top: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 0 }}>
                        <line x1="100" y1="70" x2="250" y2="70" stroke="var(--primary)" strokeWidth="2" strokeDasharray="5 5" className="streaming-line" />
                        <line x1="250" y1="70" x2="400" y2="70" stroke="var(--primary)" strokeWidth="2" strokeDasharray="5 5" className="streaming-line" />
                        <line x1="400" y1="70" x2="560" y2="70" stroke="var(--primary)" strokeWidth="2" strokeDasharray="5 5" className="streaming-line" />
                      </svg>
                      
                      {[
                        { label: "Document Extractor", desc: "Parsed OCR files", color: "#6366f1" },
                        { label: "Website Auditor", desc: "Checked site links", color: "#a855f7" },
                        { label: "KYB Registry Validator", desc: "Matched tax registry", color: "#0ea5e9" },
                        { label: "Risk Classifier", desc: "Compiled outcome", color: "#10b981" }
                      ].map((n, idx) => (
                        <div key={idx} style={{
                          zIndex: 10,
                          textAlign: "center",
                          width: "120px",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center"
                        }}>
                          <div style={{
                            width: "36px",
                            height: "36px",
                            borderRadius: "50%",
                            background: n.color,
                            boxShadow: `0 0 15px ${n.color}`,
                            border: "2px solid #fff",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "12px",
                            fontWeight: 800,
                            color: "#fff"
                          }}>{idx + 1}</div>
                          <span style={{ fontSize: "11px", fontWeight: 700, color: "#fff", marginTop: "8px" }}>{n.label}</span>
                          <span style={{ fontSize: "9px", color: "var(--text-secondary)", marginTop: "2px" }}>{n.desc}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Risk Factors and Agent Details Tab panels */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
                    
                    {/* Left: Extracted Details */}
                    <div className="glass-panel" style={{ padding: "20px" }}>
                      <h4 style={{ fontSize: "14px", color: "#fff", borderBottom: "1px solid var(--glass-border)", paddingBottom: "8px", marginBottom: "12px" }}>
                        Extracted Verification Details
                      </h4>
                      <div style={{ display: "flex", flexDirection: "column", gap: "12px", fontSize: "13px" }}>
                        <div>
                          <span style={{ color: "var(--text-secondary)" }}>Incorporation Date:</span>
                          <span style={{ float: "right", fontWeight: 700, color: "#fff" }}>
                            {selectedMerchant.report?.extracted_data?.incorporation_date || "N/A"}
                          </span>
                        </div>
                        <div>
                          <span style={{ color: "var(--text-secondary)" }}>Tax Registry Status:</span>
                          <span style={{ float: "right", fontWeight: 700, color: selectedMerchant.report?.extracted_data?.tax_status === "ACTIVE" ? "var(--risk-low)" : "var(--risk-high)" }}>
                            {selectedMerchant.report?.extracted_data?.tax_status || "N/A"}
                          </span>
                        </div>
                        <div>
                          <span style={{ color: "var(--text-secondary)" }}>OCR confidence:</span>
                          <span style={{ float: "right", fontWeight: 700, color: "#fff" }}>
                            {selectedMerchant.report?.extracted_data?.match_accuracy_score || 0}%
                          </span>
                        </div>
                        <div>
                          <span style={{ color: "var(--text-secondary)" }}>Crawler SSL Status:</span>
                          <span style={{ float: "right", fontWeight: 700, color: selectedMerchant.report?.website_audit?.ssl_active ? "var(--risk-low)" : "var(--risk-high)" }}>
                            {selectedMerchant.report?.website_audit?.ssl_active ? "SECURE (HTTPS)" : "UNSECURE"}
                          </span>
                        </div>
                        <div>
                          <span style={{ color: "var(--text-secondary)" }}>Restricted Content Found:</span>
                          <span style={{ float: "right", fontWeight: 700, color: selectedMerchant.report?.website_audit?.restricted_categories_found?.length > 0 ? "var(--risk-high)" : "var(--risk-low)" }}>
                            {selectedMerchant.report?.website_audit?.restricted_categories_found?.join(", ") || "None"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Risk Factors Checklist */}
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

                  {/* Manual Overrides Form & Audit Timeline log */}
                  <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "24px" }}>
                    
                    {/* Override Form */}
                    <div className="glass-panel" style={{ padding: "20px" }}>
                      <h4 style={{ fontSize: "14px", color: "#fff", borderBottom: "1px solid var(--glass-border)", paddingBottom: "8px", marginBottom: "12px" }}>
                        Manual Verification Override
                      </h4>
                      <form onSubmit={submitOverride} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                        <div>
                          <label style={{ display: "block", fontSize: "11px", color: "var(--text-secondary)", marginBottom: "4px" }}>Auditor Action</label>
                          <select 
                            value={overrideAction}
                            onChange={(e) => setOverrideAction(e.target.value)}
                            className="text-input"
                            style={{ background: "rgba(8,10,15,0.8)" }}
                          >
                            <option value="MANUAL_APPROVE">MANUAL APPROVE (Set status: Approved)</option>
                            <option value="MANUAL_REJECT">MANUAL REJECT (Set status: Rejected)</option>
                            <option value="MANUAL_FLAG">MANUAL FLAG (Set status: Flagged/Review)</option>
                          </select>
                        </div>
                        <div>
                          <label style={{ display: "block", fontSize: "11px", color: "var(--text-secondary)", marginBottom: "4px" }}>Audit Rationale / Notes</label>
                          <input 
                            type="text" 
                            value={overrideNotes}
                            onChange={(e) => setOverrideNotes(e.target.value)}
                            className="text-input"
                            placeholder="Specify details for compliance trail..."
                            required
                          />
                        </div>
                        <button type="submit" className="btn btn-primary" style={{ width: "100%", height: "38px", fontSize: "13px" }}>
                          Commit Override Decison
                        </button>
                      </form>
                    </div>

                    {/* Timeline Log */}
                    <div className="glass-panel" style={{ padding: "20px" }}>
                      <h4 style={{ fontSize: "14px", color: "#fff", borderBottom: "1px solid var(--glass-border)", paddingBottom: "8px", marginBottom: "12px" }}>
                        Audit History Timeline
                      </h4>
                      <div style={{ display: "flex", flexDirection: "column", gap: "14px", maxHeight: "190px", overflowY: "auto" }}>
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
      ) : (
        /* Webhooks panel view */
        <div className="glass-panel" style={{ padding: "32px", maxWidth: "800px", margin: "0 auto" }}>
          <h3 style={{ fontSize: "20px", color: "#fff", marginBottom: "8px", display: "flex", alignItems: "center", gap: "10px" }}>
            <Settings style={{ color: "var(--primary)" }} />
            Webhook Callback Integrations
          </h3>
          <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "24px" }}>
            Register URLs to receive verification callbacks once an onboarding review processes.
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
                      X-SmartMerchant-Signature secret: {w.secret}
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

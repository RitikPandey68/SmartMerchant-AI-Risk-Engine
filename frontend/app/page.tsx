import Link from "next/link";
import { Shield, Sparkles, Zap, Users, BarChart3, Radio } from "lucide-react";

export default function HomePage() {
  return (
    <div style={{
      minHeight: "calc(100vh - 60px)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "60px 20px",
      textAlign: "center",
      position: "relative"
    }}>
      {/* Background blobs */}
      <div style={{
        position: "absolute",
        top: "20%",
        left: "50%",
        transform: "translateX(-50%)",
        width: "600px",
        height: "300px",
        background: "radial-gradient(circle, rgba(99,102,241,0.15) 0%, rgba(168,85,247,0.08) 50%, transparent 100%)",
        filter: "blur(50px)",
        pointerEvents: "none",
        zIndex: -1
      }} />

      {/* Hero Header */}
      <div style={{ maxWidth: "800px", margin: "0 auto" }}>
        <div style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "8px",
          background: "rgba(99, 102, 241, 0.1)",
          border: "1px solid rgba(99, 102, 241, 0.2)",
          padding: "6px 14px",
          borderRadius: "100px",
          fontSize: "13px",
          fontWeight: 600,
          color: "#c7d2fe",
          marginBottom: "24px"
        }}>
          <Sparkles size={14} style={{ color: "#a855f7" }} />
          0→1 Automated KYB Verification Engine
        </div>

        <h1 style={{
          fontSize: "56px",
          lineHeight: "1.1",
          marginBottom: "20px",
          background: "linear-gradient(to right, #ffffff, #a5b4fc, #c084fc)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          fontFamily: "var(--font-display)",
          fontWeight: 800
        }}>
          Automate Merchant Onboarding & Risk Analytics with AI Agents
        </h1>

        <p style={{
          fontSize: "18px",
          color: "var(--text-secondary)",
          lineHeight: "1.6",
          marginBottom: "36px",
          maxWidth: "680px",
          margin: "0 auto 36px"
        }}>
          Accelerate your compliance workflows by 70%. Our collaborative agent crew parses legal docs, audits business websites, verifies tax registries, and simulates payment gateways in real-time.
        </p>

        {/* CTAs */}
        <div style={{ display: "flex", gap: "16px", justifyContent: "center", marginBottom: "64px" }}>
          <Link href="/onboarding" className="btn btn-primary" style={{ padding: "14px 32px", fontSize: "15px" }}>
            <Zap size={16} />
            Start Merchant Onboarding
          </Link>
          <Link href="/dashboard" className="btn btn-secondary" style={{ padding: "14px 32px", fontSize: "15px" }}>
            <BarChart3 size={16} />
            Audit Control Panel
          </Link>
        </div>
      </div>

      {/* Grid Stats */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
        gap: "24px",
        width: "100%",
        maxWidth: "1100px",
        margin: "0 auto"
      }}>
        <div className="glass-card" style={{ padding: "24px", textAlign: "left" }}>
          <div style={{
            width: "42px",
            height: "42px",
            borderRadius: "8px",
            background: "rgba(99, 102, 241, 0.1)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: "16px",
            color: "var(--primary)"
          }}>
            <Users size={20} />
          </div>
          <h3 style={{ fontSize: "18px", marginBottom: "8px", color: "#fff" }}>Collaborative AI Crew</h3>
          <p style={{ fontSize: "14px", color: "var(--text-secondary)", lineHeight: "1.5" }}>
            Four dedicated agents work in parallel to scan documents, check registries, audit websites, and compile final risk scores.
          </p>
        </div>

        <div className="glass-card" style={{ padding: "24px", textAlign: "left" }}>
          <div style={{
            width: "42px",
            height: "42px",
            borderRadius: "8px",
            background: "rgba(168, 85, 247, 0.1)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: "16px",
            color: "var(--secondary)"
          }}>
            <Radio size={20} />
          </div>
          <h3 style={{ fontSize: "18px", marginBottom: "8px", color: "#fff" }}>Real-time Streaming Status</h3>
          <p style={{ fontSize: "14px", color: "var(--text-secondary)", lineHeight: "1.5" }}>
            Integrated WebSockets broadcast live agent updates, logs, and state transitions straight to your screen.
          </p>
        </div>

        <div className="glass-card" style={{ padding: "24px", textAlign: "left" }}>
          <div style={{
            width: "42px",
            height: "42px",
            borderRadius: "8px",
            background: "rgba(16, 185, 129, 0.1)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: "16px",
            color: "var(--risk-low)"
          }}>
            <Shield size={20} />
          </div>
          <h3 style={{ fontSize: "18px", marginBottom: "8px", color: "#fff" }}>Dynamic Gateway Routing</h3>
          <p style={{ fontSize: "14px", color: "var(--text-secondary)", lineHeight: "1.5" }}>
            Instantly map merchant risks to dynamic processor gateways, optimizing transaction fees and preventing compliance fines.
          </p>
        </div>
      </div>
    </div>
  );
}

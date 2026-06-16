import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";

export const metadata: Metadata = {
  title: "SmartMerchant AI — AI-Native Merchant Onboarding & Risk Engine",
  description: "Next-generation automated KYB verification and merchant risk analysis dashboard.",
};

export default function RootLayout({
  children,
): Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body>
        <nav style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 40px",
          background: "rgba(8, 10, 15, 0.7)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid var(--glass-border)",
          position: "sticky",
          top: 0,
          zIndex: 100
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{
              width: "12px",
              height: "12px",
              borderRadius: "50%",
              background: "var(--grad-primary)",
              boxShadow: "0 0 10px var(--primary)"
            }} />
            <Link href="/" style={{
              fontFamily: "var(--font-display)",
              fontSize: "18px",
              fontWeight: 800,
              color: "#fff",
              textDecoration: "none",
              letterSpacing: "-0.5px"
            }}>
              SmartMerchant <span style={{ color: "var(--primary)" }}>AI</span>
            </Link>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
            <Link href="/onboarding" className="nav-link" style={{
              fontSize: "14px",
              color: "var(--text-secondary)",
              textDecoration: "none",
              fontWeight: 500,
              transition: "color 0.2s"
            }}>
              Onboarding Portal
            </Link>
            <Link href="/dashboard" className="nav-link" style={{
              fontSize: "14px",
              color: "var(--text-secondary)",
              textDecoration: "none",
              fontWeight: 500,
              transition: "color 0.2s"
            }}>
              Compliance Dashboard
            </Link>
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              background: "rgba(16, 185, 129, 0.1)",
              border: "1px solid rgba(16, 185, 129, 0.2)",
              padding: "4px 10px",
              borderRadius: "100px",
              fontSize: "12px",
              fontWeight: 600,
              color: "var(--risk-low)"
            }}>
              <span style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                background: "var(--risk-low)",
                display: "inline-block"
              }} />
              API LIVE
            </div>
          </div>
        </nav>
        <main>{children}</main>
      </body>
    </html>
  );
}

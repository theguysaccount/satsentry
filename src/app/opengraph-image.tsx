import { ImageResponse } from "next/og";
import { SECURITY_ADVISORIES } from "@/lib/advisories";
import { getLiveMainnetRadar } from "@/lib/mainnet-radar";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const dynamic = "force-dynamic";

export default async function OpenGraphImage() {
  const radar = await getLiveMainnetRadar();
  const btc = radar.bitcoinCensus;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: "#090b0e",
          backgroundImage:
            "radial-gradient(circle at 20% 0%, rgba(247,147,26,0.22), transparent 55%)",
          color: "#ffffff",
          padding: "56px 64px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <div
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "10px",
                backgroundColor: "rgba(247,147,26,0.18)",
                border: "2px solid #f7931a",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#f7931a",
                fontSize: "24px",
                fontWeight: 800,
              }}
            >
              ₿
            </div>
            <span style={{ fontSize: "30px", fontWeight: 800, letterSpacing: "-0.02em" }}>
              SatSentry
            </span>
          </div>
          <div
            style={{
              fontSize: "18px",
              color: "#f7931a",
              border: "1px solid rgba(247,147,26,0.45)",
              borderRadius: "999px",
              padding: "8px 18px",
            }}
          >
            MIT FOSS · L402 · MCP · SARIF 2.1
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div style={{ fontSize: "52px", fontWeight: 800, lineHeight: 1.08 }}>
            Live Bitcoin &amp; Lightning CVE Exposure Radar
          </div>
          <div style={{ fontSize: "24px", color: "#94a3b8" }}>
            Bitcoin Core · Core Lightning · LND · LDK · Eclair · BTCPay · LNbits ({SECURITY_ADVISORIES.length} verified advisories)
          </div>
        </div>

        <div style={{ display: "flex", gap: "20px" }}>
          <div
            style={{
              flex: 1,
              backgroundColor: "#11151b",
              border: "1px solid #1e293b",
              borderRadius: "14px",
              padding: "20px 24px",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <span style={{ fontSize: "15px", color: "#94a3b8" }}>REACHABLE MAINNET NODES</span>
            <span style={{ fontSize: "38px", fontWeight: 800, marginTop: "6px" }}>
              {btc.totalReachableNodes.toLocaleString()}
            </span>
          </div>
          <div
            style={{
              flex: 1,
              backgroundColor: "#11151b",
              border: "1px solid rgba(239,68,68,0.45)",
              borderRadius: "14px",
              padding: "20px 24px",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <span style={{ fontSize: "15px", color: "#fca5a5" }}>EXPOSED TO ≥1 CVE</span>
            <span style={{ fontSize: "38px", fontWeight: 800, color: "#fca5a5", marginTop: "6px" }}>
              {btc.vulnerableAnyCvePct}%
            </span>
          </div>
          <div
            style={{
              flex: 1,
              backgroundColor: "#11151b",
              border: "1px solid rgba(245,158,11,0.45)",
              borderRadius: "14px",
              padding: "20px 24px",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <span style={{ fontSize: "15px", color: "#fcd34d" }}>EOL BRANCHES (≤29.X)</span>
            <span style={{ fontSize: "38px", fontWeight: 800, color: "#fcd34d", marginTop: "6px" }}>
              {btc.eolBranchPct}%
            </span>
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}

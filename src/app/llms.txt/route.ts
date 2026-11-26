import { NextRequest, NextResponse } from "next/server";
import { SECURITY_ADVISORIES } from "@/lib/advisories";
import { L402_PRICING } from "@/lib/l402";

export async function GET(request: NextRequest) {
  const origin = new URL(request.url).origin;

  const content = `# SatSentry

> Open-source, non-custodial Bitcoin & Lightning CVE exposure radar, node security posture auditor, local port/version CLI, MCP server, and L402-monetized fleet defense API.

## Key Links
- Web Platform: ${origin}
- Source Code (MIT): https://github.com/theguysaccount/satsentry
- L402 Service Discovery: ${origin}/.well-known/l402.json
- OpenAPI 3.1 Spec: ${origin}/api/openapi.json
- Streamable HTTP MCP Endpoint: ${origin}/api/mcp

## Live Telemetry & Audit Endpoints
- GET ${origin}/api/v1/radar — Live Bitcoin mainnet CVE exposure census computed from btcnodes.io and mempool.space.
- GET ${origin}/api/v1/advisories — ${SECURITY_ADVISORIES.length} primary-source verified security advisories covering Bitcoin Core, Core Lightning (CLN), LND, LDK (rust-lightning), Eclair, BTCPay Server, and LNbits.
- GET ${origin}/api/v1/releases — Live upstream GitHub latest release tracker across all 7 Bitcoin & Lightning repositories.
- POST ${origin}/api/v1/audit/stack — Audit a node stack or pasted CLI getinfo JSON (supports ?format=sarif for SARIF 2.1.0 GitHub Code Scanning).
- POST ${origin}/api/v1/audit/fleet — L402 Lightning pay-per-call (${L402_PRICING.fleetAuditSats} sats) batch audit for up to 50 Bitcoin & Lightning nodes.
- GET ${origin}/api/v1/lightning/node/{pubkey} — Live mainnet Lightning node security posture audit (?deep=true L402 ${L402_PRICING.deepLightningAuditSats} sats).
- GET ${origin}/api/v1/badge — Dynamic embeddable SVG badges (?type=mainnet, ?software=&version=, or ?pubkey=).

## MCP Tools (POST ${origin}/api/mcp)
- get_mainnet_cve_radar
- audit_node_stack
- audit_lightning_node
- search_advisories
`;

  return new NextResponse(content, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
    },
  });
}

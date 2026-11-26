import { NextRequest, NextResponse } from "next/server";
import { SECURITY_ADVISORIES } from "@/lib/advisories";
import { L402_PRICING } from "@/lib/l402";

export async function GET(request: NextRequest) {
  const origin = new URL(request.url).origin;

  const content = `# SatSentry v3.0

> Open-source, non-custodial Bitcoin & Lightning security + on-chain intelligence suite: live mainnet CVE radar, 7-stack CVE auditor, 30-channel Lightning posture scorer, Boltzmann transaction privacy entropy auditor, UTXO dust stress-tester, live fee/anchor oracle, DNSSEC BIP-353 resolver, MCP server (8 tools), and 6 live L402 Lightning pay-per-call APIs.

## Key Links
- Web Platform: ${origin}
- Source Code (MIT): https://github.com/theguysaccount/satsentry
- L402 Service Discovery: ${origin}/.well-known/l402.json
- L402 Manifest: ${origin}/.well-known/l402-manifest.json
- OpenAPI 3.1 Spec: ${origin}/api/openapi.json
- Streamable HTTP MCP Endpoint: ${origin}/api/mcp
- Lightning Zap Address: satsentry@coinos.io
- Zero-Gas Post-Quantum Payment Rail: NEWSATOSHI-PAYWORD-SHA256/1.0 (\`X-Newsatoshi-PayWord\` header · https://commons.newsatoshi.org/mcp)

## Live L402 Paid Endpoints (HTTP 402 over Lightning — Verified on 402index.io)
- POST ${origin}/api/v1/audit/fleet — ${L402_PRICING.fleetAuditSats} sats (batch CVE + EOL + LN posture audit for up to 50 nodes)
- GET ${origin}/api/v1/lightning/node/{pubkey}?deep=true — ${L402_PRICING.deepLightningAuditSats} sats (30-channel Lightning posture audit)
- POST ${origin}/api/v1/l402/tx-privacy — ${L402_PRICING.txPrivacyAuditSats} sats (exact Boltzmann entropy + CIOH + change fingerprinting)
- GET ${origin}/api/v1/l402/utxo-hygiene?address={addr} — ${L402_PRICING.utxoHygieneAuditSats} sats (UTXO dust stress-test + consolidation savings)
- GET ${origin}/api/v1/l402/fee-oracle — ${L402_PRICING.feeOracleSats} sats (live mempool targets, vByte matrix & LN anchor reserve)
- GET ${origin}/api/v1/l402/bip353?handle={user@domain} — ${L402_PRICING.bip353ResolveSats} sats (DNSSEC-verified BIP-353 -> on-chain / BOLT 12 / Silent Payments / Ark)

## Free Public Telemetry Endpoints
- GET ${origin}/api/v1/radar — Live Bitcoin mainnet CVE exposure census (${SECURITY_ADVISORIES.length} advisories across 7 stacks)
- GET ${origin}/api/v1/advisories — Verified advisory catalog
- GET ${origin}/api/v1/releases — Live upstream GitHub latest stable tags across 7 repos
- GET ${origin}/api/v1/badge — Dynamic embeddable SVG badges (?type=mainnet, ?software=&version=, ?pubkey=)

## MCP Tools (POST ${origin}/api/mcp)
- get_mainnet_cve_radar
- audit_node_stack
- audit_lightning_node
- search_advisories
- audit_tx_privacy
- audit_utxo_hygiene
- get_bitcoin_fee_oracle
- resolve_bip353_address
`;

  return new NextResponse(content, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
    },
  });
}

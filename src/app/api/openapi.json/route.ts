import { NextRequest, NextResponse } from "next/server";
import { L402_PRICING } from "@/lib/l402";

export async function GET(request: NextRequest) {
  const origin = new URL(request.url).origin;

  return NextResponse.json(
    {
      openapi: "3.1.0",
      info: {
        title: "SatSentry Bitcoin & Lightning Security & On-Chain Intelligence API",
        version: "3.0.0",
        license: { name: "MIT", url: "https://opensource.org/licenses/MIT" },
        description:
          "Live Bitcoin mainnet CVE exposure radar, 7-stack CVE/EOL auditor, 30-channel Lightning posture scorer, Boltzmann tx privacy auditor, UTXO dust stress-tester, live fee/anchor oracle, DNSSEC BIP-353 resolver, 8-tool MCP server, and 6 live L402 Lightning pay-per-call endpoints.",
      },
      servers: [{ url: origin }],
      paths: {
        "/api/v1/radar": {
          get: {
            summary: "Live Bitcoin mainnet CVE exposure radar",
            responses: { "200": { description: "Live mainnet CVE census JSON" } },
          },
        },
        "/api/v1/releases": {
          get: {
            summary: "Live upstream latest stable GitHub releases across 7 Bitcoin/Lightning stacks",
            responses: { "200": { description: "Live releases JSON" } },
          },
        },
        "/api/v1/advisories": {
          get: {
            summary: "Query 32 primary-source verified Bitcoin & Lightning security advisories",
            responses: { "200": { description: "Advisory catalog or version match report" } },
          },
        },
        "/api/v1/audit/stack": {
          post: {
            summary: "Audit a node stack or pasted CLI getinfo JSON (supports ?format=sarif)",
            responses: { "200": { description: "Stack audit JSON or SARIF 2.1.0" } },
          },
        },
        "/api/v1/audit/fleet": {
          post: {
            summary: `L402-gated batch fleet audit (${L402_PRICING.fleetAuditSats} sats)`,
            responses: {
              "200": { description: "Batch fleet audit report" },
              "402": { description: "L402 Payment Required with BOLT11 invoice and macaroon" },
            },
          },
        },
        "/api/v1/lightning/node/{pubkey}": {
          get: {
            summary: `Audit a live public mainnet Lightning node (?deep=true L402 ${L402_PRICING.deepLightningAuditSats} sats)`,
            responses: {
              "200": { description: "Lightning node posture report" },
              "402": { description: "L402 Payment Required when deep=true" },
            },
          },
        },
        "/api/v1/l402/tx-privacy": {
          post: {
            summary: `L402 Boltzmann transaction privacy & entropy auditor (${L402_PRICING.txPrivacyAuditSats} sats)`,
            responses: {
              "200": { description: "Boltzmann entropy & privacy heuristic report" },
              "402": { description: "L402 Payment Required" },
            },
          },
        },
        "/api/v1/l402/utxo-hygiene": {
          get: {
            summary: `L402 UTXO hygiene, dust stress-test & consolidation auditor (${L402_PRICING.utxoHygieneAuditSats} sats)`,
            responses: {
              "200": { description: "UTXO hygiene report" },
              "402": { description: "L402 Payment Required" },
            },
          },
        },
        "/api/v1/l402/fee-oracle": {
          get: {
            summary: `L402 Live Bitcoin fee, vByte cost matrix & Lightning anchor reserve oracle (${L402_PRICING.feeOracleSats} sats)`,
            responses: {
              "200": { description: "Fee oracle report" },
              "402": { description: "L402 Payment Required" },
            },
          },
        },
        "/api/v1/l402/bip353": {
          get: {
            summary: `L402 DNSSEC-verified BIP-353 Bitcoin payment instruction resolver (${L402_PRICING.bip353ResolveSats} sats)`,
            responses: {
              "200": { description: "Parsed on-chain / BOLT 12 / Silent Payments / Ark resolution" },
              "402": { description: "L402 Payment Required" },
            },
          },
        },
        "/api/v1/badge": {
          get: {
            summary: "Embeddable dynamic SVG security badges",
            responses: { "200": { description: "image/svg+xml" } },
          },
        },
        "/api/mcp": {
          post: {
            summary: "Streamable HTTP Model Context Protocol (8 Bitcoin & Lightning tools)",
            responses: { "200": { description: "MCP JSON-RPC response" } },
          },
        },
      },
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    }
  );
}

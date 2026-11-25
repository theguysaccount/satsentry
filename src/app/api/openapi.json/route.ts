import { NextRequest, NextResponse } from "next/server";
import { L402_PRICING } from "@/lib/l402";

export async function GET(request: NextRequest) {
  const origin = new URL(request.url).origin;

  return NextResponse.json(
    {
      openapi: "3.1.0",
      info: {
        title: "SatSentry Bitcoin & Lightning Security API",
        version: "1.0.0",
        license: { name: "MIT", url: "https://opensource.org/licenses/MIT" },
        description:
          "Live Bitcoin mainnet CVE exposure telemetry, node version/EOL auditing, Lightning node posture scoring, MCP tooling, and L402-gated fleet audits.",
      },
      servers: [{ url: origin }],
      paths: {
        "/api/v1/radar": {
          get: {
            summary: "Live Bitcoin mainnet CVE exposure radar",
            responses: { "200": { description: "Live mainnet CVE census JSON" } },
          },
        },
        "/api/v1/advisories": {
          get: {
            summary: "Query verified Bitcoin & Lightning security advisories",
            parameters: [
              { name: "software", in: "query", schema: { type: "string" } },
              { name: "version", in: "query", schema: { type: "string" } },
              { name: "severity", in: "query", schema: { type: "string" } },
              { name: "q", in: "query", schema: { type: "string" } },
            ],
            responses: { "200": { description: "Advisory list or version match report" } },
          },
        },
        "/api/v1/audit/stack": {
          post: {
            summary: "Audit a single node software stack or pasted CLI getinfo JSON",
            responses: { "200": { description: "Stack audit report" } },
          },
        },
        "/api/v1/audit/fleet": {
          post: {
            summary: `L402-gated batch fleet audit (${L402_PRICING.fleetAuditSats} sats when Lightning receiver configured)`,
            responses: {
              "200": { description: "Batch fleet audit report" },
              "402": { description: "L402 Payment Required with BOLT11 invoice and macaroon" },
            },
          },
        },
        "/api/v1/lightning/node/{pubkey}": {
          get: {
            summary: "Audit a live public mainnet Lightning node by pubkey",
            parameters: [
              { name: "pubkey", in: "path", required: true, schema: { type: "string" } },
              { name: "deep", in: "query", schema: { type: "boolean" } },
            ],
            responses: {
              "200": { description: "Lightning node posture report" },
              "402": { description: "L402 Payment Required when deep=true and billing enabled" },
            },
          },
        },
        "/api/mcp": {
          post: {
            summary: "Streamable HTTP Model Context Protocol (JSON-RPC 2.0) server",
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

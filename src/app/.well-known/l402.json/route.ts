import { NextRequest, NextResponse } from "next/server";
import { getL402BackendStatus, L402_PRICING } from "@/lib/l402";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const origin = new URL(request.url).origin;
  const status = getL402BackendStatus();

  return NextResponse.json(
    {
      schema: "l402-service-discovery/v1",
      name: "SatSentry",
      description:
        "Live Bitcoin & Lightning CVE exposure radar, node security posture auditor, and batch fleet security API.",
      repository: "https://github.com/theguysaccount/satsentry",
      license: "MIT",
      homepage: origin,
      openapi: `${origin}/api/openapi.json`,
      mcp: `${origin}/api/mcp`,
      payment: {
        protocol: "L402",
        currency: "BTC",
        unit: "sat",
        status: status.mode,
        enforcingPayments: status.enforcingPayments,
      },
      endpoints: [
        {
          path: "/api/v1/audit/fleet",
          method: "POST",
          scope: "audit:fleet",
          price_sats: L402_PRICING.fleetAuditSats,
          description:
            "Batch CVE + EOL + public Lightning posture audit for up to 50 Bitcoin/Lightning nodes.",
        },
        {
          path: "/api/v1/lightning/node/{pubkey}?deep=true",
          method: "GET",
          scope: "lightning:deep-audit",
          price_sats: L402_PRICING.deepLightningAuditSats,
          description:
            "Deep Lightning node security posture, BOLT feature-bit audit, ASN cloud concentration, and channel HHI force-close blast radius.",
        },
        {
          path: "/api/v1/radar",
          method: "GET",
          scope: "public",
          price_sats: 0,
          description:
            "Live Bitcoin mainnet CVE exposure census computed from reachable btcnodes.io nodes and mempool.space Lightning telemetry.",
        },
        {
          path: "/api/v1/advisories",
          method: "GET",
          scope: "public",
          price_sats: 0,
          description:
            "Primary-source verified Bitcoin Core, Core Lightning, LND, Eclair, BTCPay Server, and LNbits security advisories.",
        },
      ],
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    }
  );
}

import { NextResponse } from "next/server";
import { SECURITY_ADVISORIES } from "@/lib/advisories";
import { getL402BackendStatus, L402_PRICING } from "@/lib/l402";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    service: "SatSentry",
    version: "1.0.0",
    status: "ok",
    timestamp: new Date().toISOString(),
    advisoriesIndexed: SECURITY_ADVISORIES.length,
    l402: {
      ...getL402BackendStatus(),
      pricingSats: L402_PRICING,
    },
    endpoints: {
      radar: "/api/v1/radar",
      advisories: "/api/v1/advisories",
      stackAudit: "/api/v1/audit/stack",
      fleetAuditL402: "/api/v1/audit/fleet",
      lightningSearch: "/api/v1/lightning/search",
      lightningNodeAudit: "/api/v1/lightning/node/{pubkey}",
      l402Discovery: "/.well-known/l402.json",
      openApi: "/api/openapi.json",
      mcp: "/api/mcp",
    },
  });
}

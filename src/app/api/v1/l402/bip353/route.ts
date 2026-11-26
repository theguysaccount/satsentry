import { NextRequest, NextResponse } from "next/server";
import { parseBip353Handle, resolveBip353Handle } from "@/lib/bip353";
import { L402_PRICING } from "@/lib/l402";
import { enforceL402Gate } from "@/lib/l402-gate";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const gate = await enforceL402Gate(request, {
    scope: "bip353:resolve",
    priceSats: L402_PRICING.bip353ResolveSats,
    memo: "SatSentry L402 DNSSEC BIP-353 Bitcoin Payment Resolver",
  });
  if (!gate.allowed) return gate.response;

  const handle = new URL(request.url).searchParams.get("handle") ?? "";
  if (!parseBip353Handle(handle)) {
    return NextResponse.json(
      { error: "Provide a valid BIP-353 handle (?handle=matt@mattcorallo.com)." },
      { status: 400 }
    );
  }

  try {
    const report = await resolveBip353Handle(handle);
    return NextResponse.json(
      { ...report, billing: { mode: gate.mode, priceSats: L402_PRICING.bip353ResolveSats } },
      { headers: { "X-L402-Status": gate.mode } }
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "BIP-353 resolution failed" },
      { status: 404 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { L402_PRICING } from "@/lib/l402";
import { enforceL402Gate } from "@/lib/l402-gate";
import { fetchAndAuditUtxoHygiene, isValidBitcoinAddress } from "@/lib/utxo-hygiene";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const gate = await enforceL402Gate(request, {
    scope: "utxo:hygiene-audit",
    priceSats: L402_PRICING.utxoHygieneAuditSats,
    memo: "SatSentry L402 Bitcoin UTXO Hygiene & Dust Audit",
  });
  if (!gate.allowed) return gate.response;

  const address = new URL(request.url).searchParams.get("address") ?? "";
  if (!isValidBitcoinAddress(address)) {
    return NextResponse.json(
      { error: "Provide a valid mainnet Bitcoin address (?address=bc1...)." },
      { status: 400 }
    );
  }

  try {
    const report = await fetchAndAuditUtxoHygiene(address);
    return NextResponse.json(
      { ...report, billing: { mode: gate.mode, priceSats: L402_PRICING.utxoHygieneAuditSats } },
      { headers: { "X-L402-Status": gate.mode } }
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "UTXO audit failed" },
      { status: 502 }
    );
  }
}

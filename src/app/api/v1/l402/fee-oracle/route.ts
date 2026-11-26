import { NextRequest, NextResponse } from "next/server";
import { getLiveFeeOracle } from "@/lib/fee-oracle";
import { L402_PRICING } from "@/lib/l402";
import { enforceL402Gate } from "@/lib/l402-gate";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const gate = await enforceL402Gate(request, {
    scope: "bitcoin:fee-oracle",
    priceSats: L402_PRICING.feeOracleSats,
    memo: "SatSentry L402 Live Bitcoin Fee & Anchor Reserve Oracle",
  });
  if (!gate.allowed) return gate.response;

  const report = await getLiveFeeOracle();
  return NextResponse.json(
    { ...report, billing: { mode: gate.mode, priceSats: L402_PRICING.feeOracleSats } },
    { headers: { "X-L402-Status": gate.mode } }
  );
}

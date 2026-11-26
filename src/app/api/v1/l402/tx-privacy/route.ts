import { NextRequest, NextResponse } from "next/server";
import { L402_PRICING } from "@/lib/l402";
import { enforceL402Gate } from "@/lib/l402-gate";
import { fetchAndAuditTxPrivacy, isValidTxid } from "@/lib/tx-privacy";

export const dynamic = "force-dynamic";

async function handle(request: NextRequest) {
  const gate = await enforceL402Gate(request, {
    scope: "tx:privacy-audit",
    priceSats: L402_PRICING.txPrivacyAuditSats,
    memo: "SatSentry L402 Bitcoin Boltzmann Tx Privacy Audit",
  });
  if (!gate.allowed) return gate.response;

  let txid = new URL(request.url).searchParams.get("txid") ?? "";
  if (!txid && request.method === "POST") {
    try {
      const body = (await request.json()) as { txid?: string };
      txid = body.txid ?? "";
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }
  }

  if (!isValidTxid(txid)) {
    return NextResponse.json(
      { error: "Provide a valid 64-character hex mainnet Bitcoin txid." },
      { status: 400 }
    );
  }

  try {
    const report = await fetchAndAuditTxPrivacy(txid);
    return NextResponse.json(
      { ...report, billing: { mode: gate.mode, priceSats: L402_PRICING.txPrivacyAuditSats } },
      { headers: { "X-L402-Status": gate.mode } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Tx privacy audit failed";
    return NextResponse.json({ error: msg }, { status: msg.includes("not found") ? 404 : 502 });
  }
}

export const GET = handle;
export const POST = handle;

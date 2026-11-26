import { NextRequest, NextResponse } from "next/server";
import { fetchAndAuditTxPrivacy, isValidTxid } from "@/lib/tx-privacy";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const txid = new URL(request.url).searchParams.get("txid") ?? "";
  if (!isValidTxid(txid)) {
    return NextResponse.json(
      { error: "Provide a valid 64-character hex mainnet Bitcoin txid." },
      { status: 400 }
    );
  }
  try {
    const report = await fetchAndAuditTxPrivacy(txid);
    return NextResponse.json(report, {
      headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Transaction lookup failed";
    return NextResponse.json({ error: msg }, { status: msg.includes("not found") ? 404 : 502 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { fetchAndAuditUtxoHygiene, isValidBitcoinAddress } from "@/lib/utxo-hygiene";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const address = new URL(request.url).searchParams.get("address") ?? "";
  if (!isValidBitcoinAddress(address)) {
    return NextResponse.json(
      { error: "Provide a valid mainnet Bitcoin address (bc1p..., bc1q..., 1..., or 3...)." },
      { status: 400 }
    );
  }
  try {
    const report = await fetchAndAuditUtxoHygiene(address);
    return NextResponse.json(report, {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=180" },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "UTXO hygiene lookup failed" },
      { status: 502 }
    );
  }
}

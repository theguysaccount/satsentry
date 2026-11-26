import { NextResponse } from "next/server";
import { getLiveFeeOracle } from "@/lib/fee-oracle";

export const dynamic = "force-dynamic";

export async function GET() {
  const report = await getLiveFeeOracle();
  return NextResponse.json(report, {
    headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" },
  });
}

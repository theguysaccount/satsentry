import { NextRequest, NextResponse } from "next/server";
import { searchLightningNodes } from "@/lib/lightning-posture";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";

  if (!q.trim()) {
    return NextResponse.json({ nodes: [] });
  }

  try {
    const nodes = await searchLightningNodes(q);
    return NextResponse.json(
      { query: q.trim(), nodes },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
        },
      }
    );
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Lightning search unavailable",
      },
      { status: 502 }
    );
  }
}

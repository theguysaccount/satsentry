import { NextResponse } from "next/server";
import { getUpstreamReleases } from "@/lib/releases";

export const dynamic = "force-dynamic";

export async function GET() {
  const releases = await getUpstreamReleases();
  return NextResponse.json(
    {
      checkedAt: new Date().toISOString(),
      count: releases.length,
      releases,
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=900, stale-while-revalidate=1800",
      },
    }
  );
}

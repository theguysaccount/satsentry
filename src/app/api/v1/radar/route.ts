import { NextRequest, NextResponse } from "next/server";
import { getLiveMainnetRadar } from "@/lib/mainnet-radar";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const force = searchParams.get("refresh") === "1";

  try {
    const radar = await getLiveMainnetRadar(force);
    return NextResponse.json(radar, {
      headers: {
        "Cache-Control": force
          ? "no-store"
          : "public, s-maxage=300, stale-while-revalidate=600",
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Failed to load live mainnet radar",
      },
      { status: 502 }
    );
  }
}

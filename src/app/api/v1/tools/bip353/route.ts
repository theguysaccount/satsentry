import { NextRequest, NextResponse } from "next/server";
import { parseBip353Handle, resolveBip353Handle } from "@/lib/bip353";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const handle = new URL(request.url).searchParams.get("handle") ?? "";
  if (!parseBip353Handle(handle)) {
    return NextResponse.json(
      { error: "Provide a valid BIP-353 handle (e.g. matt@mattcorallo.com)." },
      { status: 400 }
    );
  }
  try {
    const report = await resolveBip353Handle(handle);
    return NextResponse.json(report, {
      headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300" },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "BIP-353 lookup failed" },
      { status: 404 }
    );
  }
}

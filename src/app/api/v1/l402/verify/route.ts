import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  createProtocolTestVector,
  getL402BackendStatus,
  L402_PRICING,
  verifyL402Token,
} from "@/lib/l402";

export const dynamic = "force-dynamic";

const verifySchema = z.object({
  authorizationHeader: z.string().min(10).max(4096),
  expectedScope: z.string().max(120).optional(),
});

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const scope = searchParams.get("scope") || "audit:fleet";
  const vector = createProtocolTestVector(scope, L402_PRICING.fleetAuditSats);

  return NextResponse.json({
    kind: "cryptographic-protocol-test-vector",
    note: "Non-payable cryptographic test vector using real HMAC-SHA256 macaroon signing and real SHA-256 preimage binding. Configure a Lightning backend env var to issue live payable BOLT11 challenges.",
    backendStatus: getL402BackendStatus(),
    scope,
    priceSats: L402_PRICING.fleetAuditSats,
    ...vector,
  });
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = verifySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation error", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const result = verifyL402Token(
    parsed.data.authorizationHeader,
    parsed.data.expectedScope
  );

  return NextResponse.json(result, { status: result.valid ? 200 : 401 });
}

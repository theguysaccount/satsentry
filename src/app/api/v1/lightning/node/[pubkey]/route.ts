import { NextRequest, NextResponse } from "next/server";
import {
  createLightningInvoice,
  getL402BackendStatus,
  L402_PRICING,
  mintL402Macaroon,
  verifyL402Token,
} from "@/lib/l402";
import {
  fetchAndAuditLightningNode,
  isValidLightningPubkey,
} from "@/lib/lightning-posture";

export const dynamic = "force-dynamic";

const DEEP_SCOPE = "lightning:deep-audit";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ pubkey: string }> }
) {
  const { pubkey } = await context.params;
  if (!isValidLightningPubkey(pubkey)) {
    return NextResponse.json(
      {
        error:
          "Invalid Lightning public key. Expected 66 hex characters beginning with 02 or 03.",
      },
      { status: 400 }
    );
  }

  const { searchParams } = new URL(request.url);
  const isDeep = searchParams.get("deep") === "true";
  const l402Status = getL402BackendStatus();
  let paidTokenId: string | null = null;

  if (isDeep) {
    const authHeader = request.headers.get("authorization");
    if (authHeader && /^(?:L402|LSAT)\s+/i.test(authHeader)) {
      const check = verifyL402Token(authHeader, DEEP_SCOPE);
      if (!check.valid) {
        return NextResponse.json(
          { error: "Invalid L402 credential", reason: check.reason },
          { status: 401 }
        );
      }
      paidTokenId = check.caveats?.id ?? null;
    } else if (l402Status.enforcingPayments) {
      try {
        const invoice = await createLightningInvoice(
          L402_PRICING.deepLightningAuditSats,
          `SatSentry Deep Lightning Audit ${pubkey.slice(0, 12)}`
        );
        if (invoice) {
          const macaroon = mintL402Macaroon({
            paymentHash: invoice.paymentHash,
            scope: DEEP_SCOPE,
            priceSats: L402_PRICING.deepLightningAuditSats,
            ttlSeconds: 3600,
          });
          return NextResponse.json(
            {
              error: "Payment Required",
              protocol: "L402",
              scope: DEEP_SCOPE,
              priceSats: L402_PRICING.deepLightningAuditSats,
              paymentHash: invoice.paymentHash,
              invoice: invoice.paymentRequest,
              macaroon,
            },
            {
              status: 402,
              headers: {
                "WWW-Authenticate": `L402 macaroon="${macaroon}", invoice="${invoice.paymentRequest}"`,
                "X-L402-Price-Sats": String(L402_PRICING.deepLightningAuditSats),
              },
            }
          );
        }
      } catch (err) {
        return NextResponse.json(
          {
            error: "Configured Lightning invoice provider failed",
            detail: err instanceof Error ? err.message : "Unknown error",
          },
          { status: 503 }
        );
      }
    }
  }

  try {
    const report = await fetchAndAuditLightningNode(pubkey);
    return NextResponse.json(
      {
        ...report,
        tier: isDeep ? "deep" : "standard",
        billing: isDeep
          ? {
              mode: l402Status.mode,
              priceSats: L402_PRICING.deepLightningAuditSats,
              verifiedL402TokenId: paidTokenId,
            }
          : { mode: "free", priceSats: 0, verifiedL402TokenId: null },
      },
      {
        headers: {
          "Cache-Control": isDeep
            ? "no-store"
            : "public, s-maxage=120, stale-while-revalidate=300",
        },
      }
    );
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : "Failed to audit Lightning node";
    const status = msg.includes("not found") ? 404 : 502;
    return NextResponse.json({ error: msg }, { status });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auditStack } from "@/lib/audit-engine";
import {
  createLightningInvoice,
  getL402BackendStatus,
  L402_PRICING,
  mintL402Macaroon,
  verifyL402Token,
} from "@/lib/l402";
import { fetchAndAuditLightningNode, isValidLightningPubkey } from "@/lib/lightning-posture";

export const dynamic = "force-dynamic";

const fleetSchema = z.object({
  nodes: z
    .array(
      z.object({
        name: z.string().min(1).max(120),
        components: z
          .array(
            z.object({
              software: z.enum([
                "bitcoin-core",
                "core-lightning",
                "lnd",
                "ldk",
                "eclair",
                "btcpay",
                "lnbits",
              ]),
              version: z.string().min(1).max(120),
            })
          )
          .min(1)
          .max(10),
        lightningPubkey: z.string().optional(),
      })
    )
    .min(1)
    .max(50),
});

const SCOPE = "audit:fleet";

export async function POST(request: NextRequest) {
  const l402Status = getL402BackendStatus();
  const authHeader = request.headers.get("authorization");

  let paidCaveats = null;

  if (authHeader && /^(?:L402|LSAT)\s+/i.test(authHeader)) {
    const verification = verifyL402Token(authHeader, SCOPE);
    if (!verification.valid) {
      return NextResponse.json(
        {
          error: "Invalid L402 credential",
          reason: verification.reason,
        },
        { status: 401 }
      );
    }
    paidCaveats = verification.caveats ?? null;
  } else if (l402Status.enforcingPayments) {
    try {
      const invoice = await createLightningInvoice(
        L402_PRICING.fleetAuditSats,
        "SatSentry L402 Fleet Audit (up to 50 nodes)"
      );
      if (invoice) {
        const macaroon = mintL402Macaroon({
          paymentHash: invoice.paymentHash,
          scope: SCOPE,
          priceSats: L402_PRICING.fleetAuditSats,
          ttlSeconds: 3600,
        });
        return NextResponse.json(
          {
            error: "Payment Required",
            protocol: "L402",
            scope: SCOPE,
            priceSats: L402_PRICING.fleetAuditSats,
            paymentHash: invoice.paymentHash,
            invoice: invoice.paymentRequest,
            macaroon,
            howToRetry:
              'Pay the BOLT11 invoice, extract the 32-byte hex preimage, and retry with header: Authorization: L402 <macaroon>:<preimage>',
          },
          {
            status: 402,
            headers: {
              "WWW-Authenticate": `L402 macaroon="${macaroon}", invoice="${invoice.paymentRequest}"`,
              "X-L402-Price-Sats": String(L402_PRICING.fleetAuditSats),
            },
          }
        );
      }
    } catch (err) {
      return NextResponse.json(
        {
          error: "Configured Lightning invoice provider failed",
          detail: err instanceof Error ? err.message : "Unknown invoice error",
        },
        { status: 503 }
      );
    }
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = fleetSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation error", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const nodeReports = await Promise.all(
    parsed.data.nodes.map(async (node) => {
      const stack = auditStack(node.components);
      let lightningPosture = null;
      let lightningError: string | null = null;

      if (node.lightningPubkey && isValidLightningPubkey(node.lightningPubkey)) {
        try {
          lightningPosture = await fetchAndAuditLightningNode(node.lightningPubkey);
        } catch (e) {
          lightningError =
            e instanceof Error ? e.message : "Lightning posture lookup failed";
        }
      }

      return {
        name: node.name,
        stack,
        lightningPosture,
        lightningError,
      };
    })
  );

  const failingNodes = nodeReports.filter((r) => r.stack.overallStatus === "fail").length;
  const warningNodes = nodeReports.filter((r) => r.stack.overallStatus === "warn").length;
  const passingNodes = nodeReports.filter((r) => r.stack.overallStatus === "pass").length;

  return NextResponse.json(
    {
      auditedAt: new Date().toISOString(),
      billing: {
        mode: l402Status.mode,
        priceSats: L402_PRICING.fleetAuditSats,
        verifiedL402TokenId: paidCaveats?.id ?? null,
        note: paidCaveats
          ? "Verified via cryptographic L402 preimage + macaroon."
          : l402Status.note,
      },
      summary: {
        totalNodes: nodeReports.length,
        failingNodes,
        warningNodes,
        passingNodes,
      },
      nodes: nodeReports,
    },
    {
      headers: {
        "X-L402-Status": paidCaveats ? "paid-verified" : l402Status.mode,
        "X-L402-Price-Sats": String(L402_PRICING.fleetAuditSats),
      },
    }
  );
}

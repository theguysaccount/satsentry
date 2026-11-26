import { NextRequest, NextResponse } from "next/server";
import {
  createLightningInvoice,
  getL402BackendStatus,
  mintL402Macaroon,
  verifyL402Token,
  type L402Caveats,
} from "./l402";

export type L402GateOutcome =
  | { allowed: true; paidCaveats: L402Caveats | null; mode: string }
  | { allowed: false; response: NextResponse };

export async function enforceL402Gate(
  request: NextRequest,
  opts: { scope: string; priceSats: number; memo: string }
): Promise<L402GateOutcome> {
  const status = getL402BackendStatus();
  const authHeader = request.headers.get("authorization");

  if (authHeader && /^(?:L402|LSAT)\s+/i.test(authHeader)) {
    const check = verifyL402Token(authHeader, opts.scope);
    if (!check.valid) {
      return {
        allowed: false,
        response: NextResponse.json(
          { error: "Invalid L402 credential", reason: check.reason },
          { status: 401 }
        ),
      };
    }
    return {
      allowed: true,
      paidCaveats: check.caveats ?? null,
      mode: "paid-verified",
    };
  }

  if (!status.enforcingPayments) {
    return {
      allowed: true,
      paidCaveats: null,
      mode: status.mode,
    };
  }

  try {
    const invoice = await createLightningInvoice(opts.priceSats, opts.memo);
    if (!invoice) {
      return { allowed: true, paidCaveats: null, mode: status.mode };
    }
    const macaroon = mintL402Macaroon({
      paymentHash: invoice.paymentHash,
      scope: opts.scope,
      priceSats: invoice.amountSats,
      ttlSeconds: 3600,
    });

    return {
      allowed: false,
      response: NextResponse.json(
        {
          error: "Payment Required",
          protocol: "L402",
          scope: opts.scope,
          priceSats: invoice.amountSats,
          paymentHash: invoice.paymentHash,
          invoice: invoice.paymentRequest,
          macaroon,
          howToRetry:
            "Pay the BOLT11 invoice, extract the 32-byte hex preimage, and retry with header: Authorization: L402 <macaroon>:<preimage>",
        },
        {
          status: 402,
          headers: {
            "WWW-Authenticate": `L402 macaroon="${macaroon}", invoice="${invoice.paymentRequest}"`,
            "X-L402-Price-Sats": String(invoice.amountSats),
          },
        }
      ),
    };
  } catch (err) {
    return {
      allowed: false,
      response: NextResponse.json(
        {
          error: "Configured Lightning invoice provider failed",
          detail: err instanceof Error ? err.message : "Unknown invoice error",
        },
        { status: 503 }
      ),
    };
  }
}

import crypto from "node:crypto";
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

export interface PayWordVerificationResult {
  valid: boolean;
  tip?: string;
  ticks?: number;
  reason?: string;
}

/**
 * Verifies a zero-gas, post-quantum Newsatoshi pure-SHA-256 PayWord header:
 * `X-Newsatoshi-PayWord: tip=<64hex>,token=<64hex>,ticks=<n>`
 * Valid iff SHA256^ticks(token) === tip (1 <= ticks <= 10,000).
 */
export function verifyNewsatoshiPayWordHeader(headerValue: string): PayWordVerificationResult {
  const fields: Record<string, string> = {};
  for (const part of headerValue.split(",")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim().toLowerCase();
    const v = part.slice(idx + 1).trim();
    if (k && v) fields[k] = v;
  }

  const tip = fields.tip?.toLowerCase();
  const token = fields.token?.toLowerCase();
  const ticks = Number.parseInt(fields.ticks ?? "", 10);

  if (!tip || !/^[0-9a-f]{64}$/.test(tip)) {
    return { valid: false, reason: "Invalid PayWord tip (expected 64-char hex SHA-256)" };
  }
  if (!token || !/^[0-9a-f]{64}$/.test(token)) {
    return { valid: false, reason: "Invalid PayWord token (expected 64-char hex)" };
  }
  if (!Number.isInteger(ticks) || ticks < 1 || ticks > 10_000) {
    return { valid: false, reason: "Invalid PayWord ticks (expected integer 1..10000)" };
  }

  let cur: Buffer = Buffer.from(token, "hex");
  for (let i = 0; i < ticks; i++) {
    cur = crypto.createHash("sha256").update(cur).digest();
  }
  const expected = Buffer.from(tip, "hex");
  if (!crypto.timingSafeEqual(cur, expected)) {
    return { valid: false, reason: "PayWord hash chain mismatch (SHA256^ticks(token) !== tip)" };
  }
  return { valid: true, tip, ticks };
}

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

  const paywordHeader = request.headers.get("x-newsatoshi-payword");
  if (paywordHeader) {
    const pw = verifyNewsatoshiPayWordHeader(paywordHeader);
    if (!pw.valid) {
      return {
        allowed: false,
        response: NextResponse.json(
          { error: "Invalid Newsatoshi PayWord credential", reason: pw.reason },
          { status: 401 }
        ),
      };
    }
    return {
      allowed: true,
      paidCaveats: null,
      mode: "newsatoshi-payword-verified",
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
            "Pay the BOLT11 invoice, extract the 32-byte hex preimage, and retry with header: Authorization: L402 <macaroon>:<preimage> (or zero-gas post-quantum PayWord via X-Newsatoshi-PayWord: tip=<64hex>,token=<64hex>,ticks=<n>)",
          newsatoshiPayWord: {
            protocol: "NEWSATOSHI-PAYWORD-SHA256/1.0",
            header: "X-Newsatoshi-PayWord: tip=<64hex>,token=<64hex>,ticks=<n>",
            commonsGateway: "https://commons.newsatoshi.org",
            mcp: "https://commons.newsatoshi.org/mcp",
          },
        },
        {
          status: 402,
          headers: {
            "WWW-Authenticate": `L402 macaroon="${macaroon}", invoice="${invoice.paymentRequest}"`,
            "X-L402-Price-Sats": String(invoice.amountSats),
            "X-Newsatoshi-PayWord-Supported": "true",
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

import crypto from "node:crypto";

export interface L402Caveats {
  id: string;
  payment_hash: string; // 64-char lowercase hex SHA-256 hash of payment preimage
  scope: string;
  price_sats: number;
  iat: number;
  exp: number;
}

export interface L402BackendStatus {
  mode: "live-l402" | "preview-unconfigured";
  provider: "lnbits" | "lnd-rest" | "lnurl-pay" | "none";
  enforcingPayments: boolean;
  note: string;
}

export interface L402Invoice {
  paymentRequest: string;
  paymentHash: string;
  amountSats: number;
  provider: L402BackendStatus["provider"];
}

export const L402_PRICING = {
  fleetAuditSats: 100,
  deepLightningAuditSats: 100,
  advisoryFeedBatchSats: 25,
} as const;

function getSigningSecret(explicitSecret?: string): string {
  return (
    explicitSecret ||
    process.env.SATSENTRY_L402_SECRET ||
    "satsentry-ephemeral-preview-secret-configure-SATSENTRY_L402_SECRET"
  );
}

export function getL402BackendStatus(): L402BackendStatus {
  if (process.env.SATSENTRY_LNBITS_URL && process.env.SATSENTRY_LNBITS_KEY) {
    return {
      mode: "live-l402",
      provider: "lnbits",
      enforcingPayments: true,
      note: "Live L402 invoice generation enabled via LNbits receiver.",
    };
  }
  if (process.env.SATSENTRY_LND_REST_URL && process.env.SATSENTRY_LND_MACAROON) {
    return {
      mode: "live-l402",
      provider: "lnd-rest",
      enforcingPayments: true,
      note: "Live L402 invoice generation enabled via LND REST invoice macaroon.",
    };
  }
  if (process.env.SATSENTRY_LNURL_ADDRESS) {
    return {
      mode: "live-l402",
      provider: "lnurl-pay",
      enforcingPayments: true,
      note: "Live L402 invoice generation enabled via Lightning Address (LNURL-pay).",
    };
  }
  return {
    mode: "preview-unconfigured",
    provider: "none",
    enforcingPayments: false,
    note: "No Lightning invoice backend configured yet. Paid routes return full data in public preview mode until SATSENTRY_LNBITS_URL+KEY, SATSENTRY_LND_REST_URL+MACAROON, or SATSENTRY_LNURL_ADDRESS is set.",
  };
}

/**
 * Mints a stateless HMAC-SHA256 L402 macaroon binding caveats + payment_hash.
 * Format: base64url(payloadJson).base64url(hmacSha256(payloadJson, secret))
 */
export function mintL402Macaroon(
  params: {
    paymentHash: string;
    scope: string;
    priceSats: number;
    ttlSeconds?: number;
  },
  secret?: string
): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: L402Caveats = {
    id: crypto.randomBytes(12).toString("hex"),
    payment_hash: params.paymentHash.toLowerCase(),
    scope: params.scope,
    price_sats: params.priceSats,
    iat: now,
    exp: now + (params.ttlSeconds ?? 3600),
  };

  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url"
  );
  const sig = crypto
    .createHmac("sha256", getSigningSecret(secret))
    .update(encoded)
    .digest("base64url");

  return `${encoded}.${sig}`;
}

export interface VerifyL402Result {
  valid: boolean;
  reason?: string;
  caveats?: L402Caveats;
}

/**
 * Verifies an Authorization header:
 * `Authorization: L402 <macaroon>:<64-hex-preimage>` (or legacy `LSAT <macaroon>:<preimage>`)
 */
export function verifyL402Token(
  authHeader: string,
  expectedScope?: string,
  secret?: string,
  nowUnixSeconds = Math.floor(Date.now() / 1000)
): VerifyL402Result {
  const trimmed = authHeader.trim();
  const match = trimmed.match(/^(?:L402|LSAT)\s+([^:\s]+):([0-9a-fA-F]{64})$/i);
  if (!match) {
    return {
      valid: false,
      reason:
        "Malformed Authorization header. Expected `L402 <macaroon>:<64-char-hex-preimage>`.",
    };
  }

  const [, macaroon, preimageHex] = match;
  const parts = macaroon.split(".");
  if (parts.length !== 2) {
    return { valid: false, reason: "Malformed macaroon token structure." };
  }

  const [encodedPayload, providedSig] = parts;
  const expectedSig = crypto
    .createHmac("sha256", getSigningSecret(secret))
    .update(encodedPayload)
    .digest("base64url");

  const sigA = Buffer.from(providedSig, "utf8");
  const sigB = Buffer.from(expectedSig, "utf8");
  if (sigA.length !== sigB.length || !crypto.timingSafeEqual(sigA, sigB)) {
    return { valid: false, reason: "Invalid macaroon HMAC signature." };
  }

  let caveats: L402Caveats;
  try {
    caveats = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8")
    ) as L402Caveats;
  } catch {
    return { valid: false, reason: "Unable to decode macaroon payload." };
  }

  if (typeof caveats.exp !== "number" || nowUnixSeconds > caveats.exp) {
    return { valid: false, reason: "L402 macaroon has expired." };
  }

  if (expectedScope && caveats.scope !== expectedScope && caveats.scope !== "*") {
    return {
      valid: false,
      reason: `Macaroon scope '${caveats.scope}' does not authorize '${expectedScope}'.`,
    };
  }

  // Cryptographic L402 proof-of-payment: SHA256(preimage) === payment_hash
  const computedHash = crypto
    .createHash("sha256")
    .update(Buffer.from(preimageHex, "hex"))
    .digest("hex");

  const hashA = Buffer.from(computedHash, "hex");
  const hashB = Buffer.from(caveats.payment_hash, "hex");
  if (hashA.length !== hashB.length || !crypto.timingSafeEqual(hashA, hashB)) {
    return {
      valid: false,
      reason: "Payment preimage SHA-256 digest does not match macaroon payment_hash.",
    };
  }

  return { valid: true, caveats };
}

/**
 * Generates a real BOLT11 invoice via the operator's configured non-custodial receiver backend.
 */
export async function createLightningInvoice(
  amountSats: number,
  memo: string
): Promise<L402Invoice | null> {
  const status = getL402BackendStatus();
  if (status.provider === "none") return null;

  if (status.provider === "lnbits") {
    const base = process.env.SATSENTRY_LNBITS_URL!.replace(/\/+$/, "");
    const res = await fetch(`${base}/api/v1/payments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": process.env.SATSENTRY_LNBITS_KEY!,
      },
      body: JSON.stringify({ out: false, amount: amountSats, memo }),
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) {
      throw new Error(`LNbits invoice request failed (${res.status})`);
    }
    const data = (await res.json()) as {
      payment_hash: string;
      payment_request: string;
    };
    return {
      paymentRequest: data.payment_request,
      paymentHash: data.payment_hash,
      amountSats,
      provider: "lnbits",
    };
  }

  if (status.provider === "lnd-rest") {
    const base = process.env.SATSENTRY_LND_REST_URL!.replace(/\/+$/, "");
    const res = await fetch(`${base}/v1/invoices`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Grpc-Metadata-macaroon": process.env.SATSENTRY_LND_MACAROON!,
      },
      body: JSON.stringify({ value: String(amountSats), memo, expiry: "900" }),
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) {
      throw new Error(`LND REST invoice request failed (${res.status})`);
    }
    const data = (await res.json()) as {
      r_hash: string; // base64
      payment_request: string;
    };
    const paymentHash = Buffer.from(data.r_hash, "base64").toString("hex");
    return {
      paymentRequest: data.payment_request,
      paymentHash,
      amountSats,
      provider: "lnd-rest",
    };
  }

  if (status.provider === "lnurl-pay") {
    const address = process.env.SATSENTRY_LNURL_ADDRESS!;
    const [name, domain] = address.split("@");
    if (!name || !domain) {
      throw new Error("SATSENTRY_LNURL_ADDRESS must be formatted as user@domain.com");
    }
    const metaRes = await fetch(
      `https://${domain}/.well-known/lnurlp/${encodeURIComponent(name)}`,
      { signal: AbortSignal.timeout(8_000) }
    );
    if (!metaRes.ok) {
      throw new Error(`LNURL-pay discovery failed (${metaRes.status})`);
    }
    const meta = (await metaRes.json()) as {
      callback?: string;
      minSendable?: number;
      maxSendable?: number;
      commentAllowed?: number;
    };
    if (!meta.callback) {
      throw new Error("LNURL-pay metadata missing callback URL");
    }
    const requestedMsat = amountSats * 1000;
    const effectiveMsat = Math.max(requestedMsat, meta.minSendable ?? 1000);
    if (meta.maxSendable && effectiveMsat > meta.maxSendable) {
      throw new Error("Requested invoice amount exceeds LNURL-pay maxSendable");
    }
    const sep = meta.callback.includes("?") ? "&" : "?";
    const commentMax = typeof meta.commentAllowed === "number" ? meta.commentAllowed : 0;
    const commentQuery =
      commentMax > 0
        ? `&comment=${encodeURIComponent(memo.slice(0, commentMax))}`
        : "";
    const invRes = await fetch(
      `${meta.callback}${sep}amount=${effectiveMsat}${commentQuery}`,
      { signal: AbortSignal.timeout(8_000) }
    );
    if (!invRes.ok) {
      throw new Error(`LNURL-pay invoice callback failed (${invRes.status})`);
    }
    const inv = (await invRes.json()) as { pr?: string; status?: string; reason?: string };
    if (!inv.pr) {
      throw new Error(inv.reason || "LNURL-pay callback returned no BOLT11 invoice");
    }

    // Extract payment_hash from BOLT11 tagged field p (type 1, 52 5-bit words = 32 bytes)
    const paymentHash = extractBolt11PaymentHash(inv.pr);
    if (!paymentHash) {
      throw new Error("Unable to parse payment_hash from BOLT11 invoice");
    }
    return {
      paymentRequest: inv.pr,
      paymentHash,
      amountSats: Math.ceil(effectiveMsat / 1000),
      provider: "lnurl-pay",
    };
  }

  return null;
}

const BECH32_CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";

/**
 * Pure-JS BOLT11 payment_hash extractor (bech32 data part tagged field 'p' = tag 1, len 52).
 */
export function extractBolt11PaymentHash(bolt11: string): string | null {
  const lower = bolt11.trim().toLowerCase();
  const sepIdx = lower.lastIndexOf("1");
  if (sepIdx < 4 || sepIdx + 120 > lower.length) return null;

  const dataStr = lower.slice(sepIdx + 1);
  // Strip signature (104 chars) + checksum (6 chars) = 110 chars at end
  const payloadStr = dataStr.slice(0, -110);
  const words: number[] = [];
  for (const ch of payloadStr) {
    const val = BECH32_CHARSET.indexOf(ch);
    if (val === -1) return null;
    words.push(val);
  }

  // First 7 words (35 bits) = timestamp
  let idx = 7;
  while (idx + 3 <= words.length) {
    const tag = words[idx];
    const dataLen = words[idx + 1] * 32 + words[idx + 2];
    idx += 3;
    if (idx + dataLen > words.length) break;
    if (tag === 1 && dataLen === 52) {
      // Convert 52 5-bit words -> 32 bytes (256 bits)
      const bytes: number[] = [];
      let acc = 0;
      let bits = 0;
      for (let i = 0; i < 52; i++) {
        acc = (acc << 5) | words[idx + i];
        bits += 5;
        while (bits >= 8) {
          bits -= 8;
          bytes.push((acc >> bits) & 0xff);
        }
      }
      if (bytes.length >= 32) {
        return Buffer.from(bytes.slice(0, 32)).toString("hex");
      }
    }
    idx += dataLen;
  }

  return null;
}

/**
 * Generates an interactive cryptographic L402 test vector (random preimage + SHA-256 payment_hash + signed macaroon)
 * strictly for protocol verification & developer testing (clearly marked non-payable).
 */
export function createProtocolTestVector(scope: string, priceSats: number) {
  const preimage = crypto.randomBytes(32).toString("hex");
  const paymentHash = crypto
    .createHash("sha256")
    .update(Buffer.from(preimage, "hex"))
    .digest("hex");
  const macaroon = mintL402Macaroon({
    paymentHash,
    scope,
    priceSats,
    ttlSeconds: 900,
  });
  return {
    preimage,
    paymentHash,
    macaroon,
    authorizationHeader: `L402 ${macaroon}:${preimage}`,
  };
}

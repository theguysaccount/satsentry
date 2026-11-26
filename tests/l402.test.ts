import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  createProtocolTestVector,
  mintL402Macaroon,
  verifyL402Token,
} from "../src/lib/l402";
import { verifyNewsatoshiPayWordHeader } from "../src/lib/l402-gate";

describe("L402 stateless macaroon + preimage verification", () => {
  const secret = "unit-test-hmac-secret";

  it("verifies a valid L402 macaroon + matching SHA-256 preimage", () => {
    const preimage = crypto.randomBytes(32).toString("hex");
    const paymentHash = crypto
      .createHash("sha256")
      .update(Buffer.from(preimage, "hex"))
      .digest("hex");

    const macaroon = mintL402Macaroon(
      { paymentHash, scope: "audit:fleet", priceSats: 100, ttlSeconds: 600 },
      secret
    );

    const res = verifyL402Token(`L402 ${macaroon}:${preimage}`, "audit:fleet", secret);
    expect(res.valid).toBe(true);
    expect(res.caveats?.price_sats).toBe(100);
  });

  it("rejects mismatched preimage, tampered macaroon, wrong scope, and expired tokens", () => {
    const preimage = crypto.randomBytes(32).toString("hex");
    const wrongPreimage = crypto.randomBytes(32).toString("hex");
    const paymentHash = crypto
      .createHash("sha256")
      .update(Buffer.from(preimage, "hex"))
      .digest("hex");

    const macaroon = mintL402Macaroon(
      { paymentHash, scope: "audit:fleet", priceSats: 100, ttlSeconds: 60 },
      secret
    );

    expect(
      verifyL402Token(`L402 ${macaroon}:${wrongPreimage}`, "audit:fleet", secret).valid
    ).toBe(false);

    expect(
      verifyL402Token(`L402 ${macaroon}x:${preimage}`, "audit:fleet", secret).valid
    ).toBe(false);

    expect(
      verifyL402Token(`L402 ${macaroon}:${preimage}`, "lightning:deep-audit", secret).valid
    ).toBe(false);

    const future = Math.floor(Date.now() / 1000) + 120;
    expect(
      verifyL402Token(`L402 ${macaroon}:${preimage}`, "audit:fleet", secret, future).valid
    ).toBe(false);
  });

  it("generates self-consistent protocol test vectors", () => {
    const vec = createProtocolTestVector("audit:fleet", 100);
    const verified = verifyL402Token(vec.authorizationHeader, "audit:fleet");
    expect(verified.valid).toBe(true);
  });

  it("verifies valid Newsatoshi SHA-256 PayWord headers and rejects forgeries", () => {
    const seed = crypto.randomBytes(32);
    const tok1 = crypto.createHash("sha256").update(seed).digest();
    const tok2 = crypto.createHash("sha256").update(tok1).digest();
    const tip = crypto.createHash("sha256").update(tok2).digest();

    const ok = verifyNewsatoshiPayWordHeader(
      `tip=${tip.toString("hex")},token=${tok1.toString("hex")},ticks=2`
    );
    expect(ok.valid).toBe(true);
    expect(ok.ticks).toBe(2);

    const bad = verifyNewsatoshiPayWordHeader(
      `tip=${tip.toString("hex")},token=${tok1.toString("hex")},ticks=1`
    );
    expect(bad.valid).toBe(false);
  });
});

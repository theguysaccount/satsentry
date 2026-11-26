import { NextRequest, NextResponse } from "next/server";
import { getL402BackendStatus, L402_PRICING } from "@/lib/l402";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const origin = new URL(request.url).origin;
  const status = getL402BackendStatus();

  return NextResponse.json(
    {
      schema: "l402-service-discovery/v1",
      name: "SatSentry",
      version: "3.0.0",
      description:
        "Non-custodial Bitcoin & Lightning security and on-chain intelligence suite: live mainnet CVE radar, 7-stack CVE auditing, Lightning posture scoring, Boltzmann transaction privacy entropy, UTXO dust hygiene, live fee/anchor oracle, and DNSSEC BIP-353 resolution.",
      repository: "https://github.com/theguysaccount/satsentry",
      license: "MIT",
      homepage: origin,
      openapi: `${origin}/api/openapi.json`,
      mcp: `${origin}/api/mcp`,
      llms_txt: `${origin}/llms.txt`,
      lightning_address: "satsentry@coinos.io",
      payment: {
        protocol: "L402",
        currency: "BTC",
        unit: "sat",
        status: status.mode,
        enforcingPayments: status.enforcingPayments,
      },
      endpoints: [
        {
          path: "/api/v1/audit/fleet",
          method: "POST",
          scope: "audit:fleet",
          price_sats: L402_PRICING.fleetAuditSats,
          description:
            "Batch CVE + EOL + public Lightning posture audit for up to 50 Bitcoin/Lightning nodes.",
        },
        {
          path: "/api/v1/lightning/node/{pubkey}?deep=true",
          method: "GET",
          scope: "lightning:deep-audit",
          price_sats: L402_PRICING.deepLightningAuditSats,
          description:
            "Deep 30-channel Lightning node security posture, BOLT feature-bit audit, ASN cloud concentration, and HHI force-close blast radius.",
        },
        {
          path: "/api/v1/l402/tx-privacy",
          method: "POST",
          scope: "tx:privacy-audit",
          price_sats: L402_PRICING.txPrivacyAuditSats,
          description:
            "Exact Boltzmann combinatorial transaction entropy (E=log2 N), CIOH, address reuse, script-mismatch change fingerprinting, and fee hygiene for any mainnet Bitcoin txid.",
        },
        {
          path: "/api/v1/l402/utxo-hygiene",
          method: "GET",
          scope: "utxo:hygiene-audit",
          price_sats: L402_PRICING.utxoHygieneAuditSats,
          description:
            "Bitcoin address UTXO hygiene, multi-regime fee-spike dust stress test (1–200 sat/vB), and consolidation savings calculator.",
        },
        {
          path: "/api/v1/l402/fee-oracle",
          method: "GET",
          scope: "bitcoin:fee-oracle",
          price_sats: L402_PRICING.feeOracleSats,
          description:
            "Live Bitcoin mempool fee targets, vByte transaction cost matrix (P2TR/P2WPKH/Multisig/Lightning open/Anchor CPFP), and recommended Lightning on-chain anchor reserve.",
        },
        {
          path: "/api/v1/l402/bip353",
          method: "GET",
          scope: "bip353:resolve",
          price_sats: L402_PRICING.bip353ResolveSats,
          description:
            "DNSSEC-verified BIP-353 human-readable Bitcoin address resolver returning parsed on-chain, Silent Payments (BIP-352), BOLT 12 offer, and Ark payment instructions.",
        },
      ],
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    }
  );
}

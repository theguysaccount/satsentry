import { describe, expect, it } from "vitest";
import {
  parseBip21Uri,
  parseBip353Handle,
  unquoteDnsTxtRecord,
} from "../src/lib/bip353";
import {
  analyzeTransactionPrivacy,
  computeBoltzmannEntropy,
  type MempoolTx,
} from "../src/lib/tx-privacy";
import {
  detectAddressScriptType,
  evaluateUtxoHygiene,
} from "../src/lib/utxo-hygiene";

describe("SatSentry v3 on-chain privacy, UTXO hygiene, and BIP-353 engines", () => {
  it("computes exact Boltzmann entropy for equal-output 2x2 CoinJoin vs deterministic 1x2 spend", () => {
    const det = computeBoltzmannEntropy([100_000], [60_000, 39_000], 1_000);
    expect(det.interpretations).toBe(1);
    expect(det.entropyBits).toBe(0);
    expect(det.deterministicLinks).toBe(true);

    // Classic 2-in / 2-out symmetric CoinJoin (2 inputs of 100k -> 2 outputs of 99k, fee 2k)
    // Has 3 valid decompositions: 1 combined + 2 split pairings -> log2(3) ≈ 1.58 bits
    const cj = computeBoltzmannEntropy([100_000, 100_000], [99_000, 99_000], 2_000);
    expect(cj.interpretations).toBe(3);
    expect(cj.entropyBits).toBeCloseTo(1.58, 1);
    expect(cj.deterministicLinks).toBe(false);
  });

  it("flags address reuse, script-type mismatch, and round-number change leaks", () => {
    const tx: MempoolTx = {
      txid: "a".repeat(64),
      version: 2,
      locktime: 977500,
      size: 225,
      weight: 564,
      fee: 1410,
      status: { confirmed: true, block_height: 977501 },
      vin: [
        {
          txid: "b".repeat(64),
          vout: 0,
          sequence: 0xfffffffd,
          prevout: {
            scriptpubkey_type: "v0_p2wpkh",
            scriptpubkey_address: "bc1qsameaddress000000000000000000000000000",
            value: 200_000,
          },
        },
      ],
      vout: [
        {
          scriptpubkey_type: "v1_p2tr",
          scriptpubkey_address: "bc1ppayment000000000000000000000000000000000000000000000000000",
          value: 100_000, // round number
        },
        {
          scriptpubkey_type: "v0_p2wpkh",
          scriptpubkey_address: "bc1qsameaddress000000000000000000000000000", // reused input address
          value: 98_590, // jagged change
        },
      ],
    };

    const report = analyzeTransactionPrivacy(tx, 5);
    const triggeredIds = report.heuristics.filter((h) => h.triggered).map((h) => h.id);
    expect(triggeredIds).toContain("address-reuse");
    expect(triggeredIds).toContain("script-mismatch-change");
    expect(triggeredIds).toContain("round-number-change");
    expect(report.summary.rbfSignaling).toBe(true);
    expect(report.privacyScore).toBeLessThan(65);
  });

  it("stress-tests UTXO economic dust across fee regimes and calculates consolidation savings", () => {
    expect(detectAddressScriptType("bc1p" + "q".repeat(58)).scriptType).toBe("p2tr");
    const report = evaluateUtxoHygiene(
      "bc1qztwy6xen3zdtt7z0vrgapmjtfz8acjkfp5fp7l",
      {
        address: "bc1qztwy6xen3zdtt7z0vrgapmjtfz8acjkfp5fp7l",
        chain_stats: {
          funded_txo_count: 5,
          funded_txo_sum: 250_000,
          spent_txo_count: 1,
          spent_txo_sum: 50_000,
          tx_count: 5,
        },
        mempool_stats: {
          funded_txo_count: 0,
          funded_txo_sum: 0,
          spent_txo_count: 0,
          spent_txo_sum: 0,
          tx_count: 0,
        },
      },
      [
        { txid: "1".repeat(64), vout: 0, value: 1_500, status: { confirmed: true } }, // dust at 50 sat/vB (68*50=3400)
        { txid: "2".repeat(64), vout: 0, value: 2_000, status: { confirmed: true } }, // dust at 50 sat/vB
        { txid: "3".repeat(64), vout: 0, value: 100_000, status: { confirmed: true } },
        { txid: "4".repeat(64), vout: 0, value: 96_500, status: { confirmed: true } },
      ],
      1
    );

    expect(report.metrics.addressReused).toBe(true);
    expect(report.consolidation.recommended).toBe(true);
    expect(report.consolidation.savingsVs50SatVbSats).toBeGreaterThan(10_000);
    const regime50 = report.dustStressTest.find((r) => r.feeRateSatVb === 50);
    expect(regime50?.uneconomicUtxoCount).toBe(2);
  });

  it("parses BIP-353 handles, multi-chunk DNS TXT quotes, and BIP-21 Silent Payments / BOLT 12 URIs", () => {
    expect(parseBip353Handle("₿Matt@MattCorallo.com")).toEqual({
      user: "matt",
      domain: "mattcorallo.com",
    });
    const joined = unquoteDnsTxtRecord(
      '"bitcoin:bc1qztwy6xen3zdtt7z0vrgapmjtfz8acjkfp5fp7l?" "lno=lno1testoffer&sp=sp1qtestsilent&ark=ark1test"'
    );
    const parsed = parseBip21Uri(joined);
    expect(parsed.onChainAddress).toBe("bc1qztwy6xen3zdtt7z0vrgapmjtfz8acjkfp5fp7l");
    expect(parsed.bolt12Offer).toBe("lno1testoffer");
    expect(parsed.silentPaymentAddress).toBe("sp1qtestsilent");
    expect(parsed.arkAddress).toBe("ark1test");
  });
});

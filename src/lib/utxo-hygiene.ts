export interface MempoolUtxo {
  txid: string;
  vout: number;
  value: number;
  status: {
    confirmed: boolean;
    block_height?: number;
  };
}

export interface MempoolAddressInfo {
  address: string;
  chain_stats: {
    funded_txo_count: number;
    funded_txo_sum: number;
    spent_txo_count: number;
    spent_txo_sum: number;
    tx_count: number;
  };
  mempool_stats: {
    funded_txo_count: number;
    funded_txo_sum: number;
    spent_txo_count: number;
    spent_txo_sum: number;
    tx_count: number;
  };
}

export interface DustRegimeRow {
  feeRateSatVb: number;
  spendCostPerInputSats: number;
  uneconomicUtxoCount: number;
  uneconomicSats: number;
  totalSweepFeeSats: number;
}

export interface UtxoHygieneReport {
  auditedAt: string;
  sourceUrl: string;
  address: string;
  scriptType: "p2tr" | "p2wpkh" | "p2wsh" | "p2sh" | "p2pkh";
  inputSpendVbytes: number;
  metrics: {
    utxoCount: number;
    confirmedBalanceSats: number;
    unconfirmedBalanceSats: number;
    historicalTxCount: number;
    addressReused: boolean;
    smallestUtxoSats: number | null;
    largestUtxoSats: number | null;
    medianUtxoSats: number | null;
  };
  liveFeeRateSatVb: number;
  consolidation: {
    recommended: boolean;
    estimatedConsolidationVbytes: number;
    costNowSats: number;
    costAt50SatVbSats: number;
    savingsVs50SatVbSats: number;
    verdict: string;
  };
  dustStressTest: DustRegimeRow[];
  hygieneScore: number;
  grade: "A" | "B" | "C" | "D" | "F";
  warnings: string[];
}

export function isValidBitcoinAddress(address: string): boolean {
  const a = address.trim();
  return (
    /^bc1p[a-z0-9]{58}$/i.test(a) ||
    /^bc1q[a-z0-9]{38,58}$/i.test(a) ||
    /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(a)
  );
}

export function detectAddressScriptType(address: string): {
  scriptType: UtxoHygieneReport["scriptType"];
  inputSpendVbytes: number;
} {
  const a = address.trim();
  if (/^bc1p/i.test(a)) return { scriptType: "p2tr", inputSpendVbytes: 58 };
  if (/^bc1q/i.test(a)) {
    return a.length > 46
      ? { scriptType: "p2wsh", inputSpendVbytes: 105 }
      : { scriptType: "p2wpkh", inputSpendVbytes: 68 };
  }
  if (a.startsWith("3")) return { scriptType: "p2sh", inputSpendVbytes: 91 };
  return { scriptType: "p2pkh", inputSpendVbytes: 148 };
}

export function evaluateUtxoHygiene(
  address: string,
  info: MempoolAddressInfo,
  utxos: MempoolUtxo[],
  liveFeeRateSatVb: number
): UtxoHygieneReport {
  const { scriptType, inputSpendVbytes } = detectAddressScriptType(address);
  const confirmedBalanceSats = utxos
    .filter((u) => u.status.confirmed)
    .reduce((s, u) => s + u.value, 0);
  const unconfirmedBalanceSats = utxos
    .filter((u) => !u.status.confirmed)
    .reduce((s, u) => s + u.value, 0);

  const values = utxos.map((u) => u.value).sort((a, b) => a - b);
  const smallestUtxoSats = values.length > 0 ? values[0] : null;
  const largestUtxoSats = values.length > 0 ? values[values.length - 1] : null;
  const medianUtxoSats =
    values.length > 0 ? values[Math.floor(values.length / 2)] : null;

  const historicalTxCount =
    (info.chain_stats?.tx_count ?? 0) + (info.mempool_stats?.tx_count ?? 0);
  const totalFundedCount =
    (info.chain_stats?.funded_txo_count ?? 0) +
    (info.mempool_stats?.funded_txo_count ?? 0);
  const addressReused = totalFundedCount > 1;

  // Overhead (11 vB) + 1 P2TR output (43 vB) + N * inputSpendVbytes
  const estimatedConsolidationVbytes =
    utxos.length > 0 ? 54 + utxos.length * inputSpendVbytes : 0;
  const costNowSats = Math.ceil(estimatedConsolidationVbytes * liveFeeRateSatVb);
  const costAt50SatVbSats = Math.ceil(estimatedConsolidationVbytes * 50);
  const savingsVs50SatVbSats = Math.max(0, costAt50SatVbSats - costNowSats);

  const regimes = Array.from(new Set([liveFeeRateSatVb, 25, 50, 100, 200])).sort(
    (a, b) => a - b
  );
  const dustStressTest: DustRegimeRow[] = regimes.map((rate) => {
    const spendCost = Math.ceil(inputSpendVbytes * rate);
    const uneconomic = utxos.filter((u) => u.value <= spendCost);
    return {
      feeRateSatVb: rate,
      spendCostPerInputSats: spendCost,
      uneconomicUtxoCount: uneconomic.length,
      uneconomicSats: uneconomic.reduce((s, u) => s + u.value, 0),
      totalSweepFeeSats: Math.ceil(estimatedConsolidationVbytes * rate),
    };
  });

  const dustAt50 = dustStressTest.find((d) => d.feeRateSatVb === 50);
  const dustNow = dustStressTest.find((d) => d.feeRateSatVb === liveFeeRateSatVb);

  const warnings: string[] = [];
  let penalty = 0;

  if (addressReused) {
    penalty += 25;
    warnings.push(
      `Address received ${totalFundedCount} separate funding outputs (address reuse leaks balance history to counterparties).`
    );
  }
  if (scriptType === "p2pkh") {
    penalty += 15;
    warnings.push(
      "Legacy P2PKH address requires ~148 vB per input spend (2.5x higher fee burden than Taproot bc1p)."
    );
  }
  if (dustNow && dustNow.uneconomicUtxoCount > 0) {
    penalty += 25;
    warnings.push(
      `${dustNow.uneconomicUtxoCount} UTXO(s) are uneconomic to spend even at today's ${liveFeeRateSatVb} sat/vB fee rate.`
    );
  } else if (dustAt50 && dustAt50.uneconomicUtxoCount > 0) {
    penalty += 15;
    warnings.push(
      `${dustAt50.uneconomicUtxoCount} UTXO(s) (${dustAt50.uneconomicSats.toLocaleString()} sats) would become unspendable dust during a 50 sat/vB fee spike.`
    );
  }
  if (utxos.length >= 15) {
    penalty += 15;
    warnings.push(
      `Fragmented UTXO set (${utxos.length} unspent outputs); consolidating during low fees cuts future fee-spike exposure.`
    );
  }

  const recommended = utxos.length >= 3 && liveFeeRateSatVb <= 10;
  const verdict =
    utxos.length <= 1
      ? "No consolidation needed (0–1 unspent UTXO)."
      : recommended
      ? `Favorable consolidation window (${liveFeeRateSatVb} sat/vB): consolidating ${utxos.length} UTXOs costs ~${costNowSats.toLocaleString()} sats now vs ~${costAt50SatVbSats.toLocaleString()} sats at 50 sat/vB (saving ~${savingsVs50SatVbSats.toLocaleString()} sats).`
      : `Elevated fee rate (${liveFeeRateSatVb} sat/vB): wait for <10 sat/vB before consolidating ${utxos.length} UTXOs unless urgent.`;

  const hygieneScore = Math.max(0, 100 - penalty);
  const grade: UtxoHygieneReport["grade"] =
    hygieneScore >= 90
      ? "A"
      : hygieneScore >= 78
      ? "B"
      : hygieneScore >= 64
      ? "C"
      : hygieneScore >= 48
      ? "D"
      : "F";

  return {
    auditedAt: new Date().toISOString(),
    sourceUrl: `https://mempool.space/address/${address}`,
    address,
    scriptType,
    inputSpendVbytes,
    metrics: {
      utxoCount: utxos.length,
      confirmedBalanceSats,
      unconfirmedBalanceSats,
      historicalTxCount,
      addressReused,
      smallestUtxoSats,
      largestUtxoSats,
      medianUtxoSats,
    },
    liveFeeRateSatVb,
    consolidation: {
      recommended,
      estimatedConsolidationVbytes,
      costNowSats,
      costAt50SatVbSats,
      savingsVs50SatVbSats,
      verdict,
    },
    dustStressTest,
    hygieneScore,
    grade,
    warnings,
  };
}

export async function fetchAndAuditUtxoHygiene(
  address: string
): Promise<UtxoHygieneReport> {
  const clean = address.trim();
  if (!isValidBitcoinAddress(clean)) {
    throw new Error(
      "Invalid mainnet Bitcoin address. Expected bc1p..., bc1q..., 1..., or 3... format."
    );
  }

  const [infoRes, utxoRes, feeRes] = await Promise.all([
    fetch(`https://mempool.space/api/address/${encodeURIComponent(clean)}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    }),
    fetch(`https://mempool.space/api/address/${encodeURIComponent(clean)}/utxo`, {
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    }),
    fetch("https://mempool.space/api/v1/fees/recommended", {
      cache: "no-store",
      signal: AbortSignal.timeout(6_000),
    }).catch(() => null),
  ]);

  if (!infoRes.ok || !utxoRes.ok) {
    throw new Error(`Upstream mempool.space address lookup failed (${infoRes.status}/${utxoRes.status}).`);
  }

  const info = (await infoRes.json()) as MempoolAddressInfo;
  const utxos = (await utxoRes.json()) as MempoolUtxo[];
  let feeRate = 1;
  if (feeRes && feeRes.ok) {
    try {
      const f = (await feeRes.json()) as { hourFee?: number; fastestFee?: number };
      feeRate = Math.max(1, f.hourFee ?? f.fastestFee ?? 1);
    } catch {}
  }

  return evaluateUtxoHygiene(clean, info, utxos, feeRate);
}

export interface MempoolTxVin {
  txid: string;
  vout: number;
  sequence: number;
  prevout: {
    scriptpubkey_type: string;
    scriptpubkey_address?: string;
    value: number;
  } | null;
}

export interface MempoolTxVout {
  scriptpubkey_type: string;
  scriptpubkey_address?: string;
  value: number;
}

export interface MempoolTx {
  txid: string;
  version: number;
  locktime: number;
  size: number;
  weight: number;
  fee: number;
  vin: MempoolTxVin[];
  vout: MempoolTxVout[];
  status: {
    confirmed: boolean;
    block_height?: number;
    block_time?: number;
  };
}

export interface PrivacyHeuristic {
  id: string;
  title: string;
  triggered: boolean;
  severity: "high" | "medium" | "low" | "info";
  penalty: number;
  evidence: string;
  remediation: string;
}

export interface TxPrivacyReport {
  auditedAt: string;
  sourceUrl: string;
  txid: string;
  confirmed: boolean;
  blockHeight: number | null;
  summary: {
    inputsCount: number;
    outputsCount: number;
    totalInputSats: number;
    totalOutputSats: number;
    feeSats: number;
    vsize: number;
    feeRateSatVb: number;
    isCoinbase: boolean;
    rbfSignaling: boolean;
    antiFeeSnipingLocktime: boolean;
    isBip69Ordered: boolean;
    inputScriptTypes: string[];
    outputScriptTypes: string[];
  };
  boltzmann: {
    computed: boolean;
    interpretations: number | null;
    entropyBits: number | null;
    efficiencyRatio: number | null;
    deterministicLinks: boolean;
    note: string;
  };
  privacyScore: number;
  grade: "A" | "B" | "C" | "D" | "F";
  heuristics: PrivacyHeuristic[];
}

export function isValidTxid(txid: string): boolean {
  return /^[0-9a-fA-F]{64}$/.test(txid.trim());
}

/**
 * Exact Boltzmann combinatorial interpretation counter for transactions where
 * sum(inputs) >= sum(outputs) and fee = sum(inputs) - sum(outputs).
 * Counts the number of valid non-empty bipartitions (sub-transactions) up to a safe cap
 * to measure transaction ambiguity E = log2(N).
 */
export function computeBoltzmannEntropy(
  inputValues: number[],
  outputValues: number[],
  feeSats: number
): TxPrivacyReport["boltzmann"] {
  const nIn = inputValues.length;
  const nOut = outputValues.length;

  if (nIn === 0 || nOut === 0) {
    return {
      computed: false,
      interpretations: null,
      entropyBits: null,
      efficiencyRatio: null,
      deterministicLinks: true,
      note: "Transaction has zero non-coinbase inputs or zero value outputs.",
    };
  }

  // Single input or single output always has exactly 1 deterministic mapping (0 bits entropy)
  if (nIn === 1 || nOut === 1) {
    return {
      computed: true,
      interpretations: 1,
      entropyBits: 0,
      efficiencyRatio: 0,
      deterministicLinks: true,
      note:
        nIn === 1 && nOut === 1
          ? "1-in / 1-out sweep has 1 deterministic input-output mapping (0 bits entropy)."
          : "Single-input or single-output topology yields 1 deterministic link (0 bits entropy).",
    };
  }

  // Detect equal-output CoinJoin structure quickly when dimensions are large
  if (nIn > 10 || nOut > 10) {
    const freq = new Map<number, number>();
    for (const v of outputValues) {
      freq.set(v, (freq.get(v) ?? 0) + 1);
    }
    const maxEqual = Math.max(0, ...freq.values());
    if (maxEqual >= 3) {
      // Lower bound entropy from identical-denomination anonymity set k!
      let log2Fact = 0;
      for (let i = 2; i <= maxEqual; i++) log2Fact += Math.log2(i);
      const bits = Math.round(log2Fact * 100) / 100;
      return {
        computed: true,
        interpretations: null,
        entropyBits: bits,
        efficiencyRatio: null,
        deterministicLinks: false,
        note: `Large multi-party transaction (${nIn} in / ${nOut} out) with ${maxEqual} equal-value outputs (CoinJoin anonymity set lower bound ~${bits} bits).`,
      };
    }
    return {
      computed: false,
      interpretations: null,
      entropyBits: null,
      efficiencyRatio: null,
      deterministicLinks: false,
      note: `Transaction (${nIn} in / ${nOut} out) exceeds synchronous exact subset-sum bound (10×10); heuristic privacy checks still evaluated in full.`,
    };
  }

  // Exact subset-sum partition count: find all non-empty proper input subsets S
  // and output subsets T such that 0 <= sum(S) - sum(T) <= feeSats AND
  // remaining inputs cover remaining outputs with total fee exact.
  // Count valid ordered sub-transaction decompositions (including trivial 1-block).
  const fullInMask = (1 << nIn) - 1;
  const fullOutMask = (1 << nOut) - 1;

  const inSum = new Int32Array(1 << nIn);
  const outSum = new Int32Array(1 << nOut);
  // Use regular number array to support >21 BTC (>2^31 sats) safely
  const inSums: number[] = new Array(1 << nIn).fill(0);
  const outSums: number[] = new Array(1 << nOut).fill(0);
  for (let m = 1; m <= fullInMask; m++) {
    const lsb = m & -m;
    const idx = Math.clz32(lsb) ^ 31;
    inSums[m] = inSums[m ^ lsb] + inputValues[idx];
  }
  for (let m = 1; m <= fullOutMask; m++) {
    const lsb = m & -m;
    const idx = Math.clz32(lsb) ^ 31;
    outSums[m] = outSums[m ^ lsb] + outputValues[idx];
  }
  void inSum;
  void outSum;

  // Precompute valid single-component pairs (inMask, outMask) where 0 <= in - out <= fee
  // Then DP over masks to count set partitions into independent sub-transactions.
  // To avoid overcounting permutations of components, enforce that each component contains
  // the lowest-indexed remaining input bit.
  const memo = new Map<number, number>();
  const MAX_INTERP = 100_000;

  function countPartitions(remIn: number, remOut: number, remFee: number): number {
    if (remIn === 0 && remOut === 0) return 1;
    if (remIn === 0 || remOut === 0) return 0;

    const key = remIn * 1024 + remOut;
    const cached = memo.get(key);
    if (cached !== undefined) return cached;

    const anchorBit = remIn & -remIn;
    const restIn = remIn ^ anchorBit;

    let total = 0;
    // Iterate subsets of restIn (combined with anchorBit)
    for (let subIn = restIn; ; subIn = (subIn - 1) & restIn) {
      const compIn = subIn | anchorBit;
      const compInSum = inSums[compIn];

      // Iterate non-empty subsets of remOut
      for (let compOut = remOut; compOut > 0; compOut = (compOut - 1) & remOut) {
        const compOutSum = outSums[compOut];
        const diff = compInSum - compOutSum;
        if (diff >= 0 && diff <= remFee) {
          const nextIn = remIn ^ compIn;
          const nextOut = remOut ^ compOut;
          if (nextIn === 0 && nextOut === 0) {
            total += 1;
          } else if (nextIn !== 0 && nextOut !== 0) {
            total += countPartitions(nextIn, nextOut, remFee - diff);
          }
          if (total >= MAX_INTERP) {
            memo.set(key, MAX_INTERP);
            return MAX_INTERP;
          }
        }
      }

      if (subIn === 0) break;
    }

    memo.set(key, total);
    return total;
  }

  const interpretations = Math.max(1, countPartitions(fullInMask, fullOutMask, feeSats));
  const entropyBits = Math.round(Math.log2(interpretations) * 100) / 100;
  const maxPossible = Math.log2(Math.min(nIn, nOut) * Math.max(nIn, nOut));
  const efficiencyRatio =
    maxPossible > 0 ? Math.min(1, Math.round((entropyBits / maxPossible) * 100) / 100) : 0;

  return {
    computed: true,
    interpretations,
    entropyBits,
    efficiencyRatio,
    deterministicLinks: interpretations === 1,
    note:
      interpretations === 1
        ? "Only 1 valid input-output decomposition exists (0 bits Boltzmann entropy; deterministic links)."
        : `${interpretations.toLocaleString()} valid input-output decompositions (${entropyBits} bits Boltzmann entropy).`,
  };
}

function isRoundBitcoinAmount(sats: number): boolean {
  if (sats <= 0) return false;
  // Round multiples of 10,000 sats (0.0001 BTC) or 50,000 sats
  return sats % 10_000 === 0;
}

export function analyzeTransactionPrivacy(
  tx: MempoolTx,
  recommendedFastFeeSatVb?: number | null
): TxPrivacyReport {
  const isCoinbase = tx.vin.length === 1 && tx.vin[0].prevout === null;
  const inputValues = tx.vin
    .map((v) => v.prevout?.value ?? 0)
    .filter((v) => v > 0);
  const outputValues = tx.vout.map((v) => v.value).filter((v) => v > 0);

  const totalInputSats = inputValues.reduce((a, b) => a + b, 0);
  const totalOutputSats = outputValues.reduce((a, b) => a + b, 0);
  const vsize = Math.max(1, Math.ceil(tx.weight / 4));
  const feeRateSatVb = Math.round((tx.fee / vsize) * 100) / 100;

  const rbfSignaling = tx.vin.some((v) => v.sequence < 0xfffffffe);
  const antiFeeSnipingLocktime =
    tx.locktime > 0 &&
    tx.locktime < 500_000_000 &&
    (tx.status.block_height
      ? Math.abs(tx.status.block_height - tx.locktime) <= 200
      : true);

  const inputScriptTypes = Array.from(
    new Set(
      tx.vin
        .map((v) => v.prevout?.scriptpubkey_type)
        .filter((s): s is string => Boolean(s))
    )
  );
  const outputScriptTypes = Array.from(
    new Set(
      tx.vout
        .map((v) => v.scriptpubkey_type)
        .filter((s): s is string => Boolean(s))
    )
  );

  // BIP-69 lexicographical ordering check (only meaningful if >1 input or >1 output)
  const inputsSorted = tx.vin.every((v, i) => {
    if (i === 0) return true;
    const prev = tx.vin[i - 1];
    if (prev.txid !== v.txid) return prev.txid < v.txid;
    return prev.vout <= v.vout;
  });
  const outputsSorted = tx.vout.every((v, i) => {
    if (i === 0) return true;
    const prev = tx.vout[i - 1];
    if (prev.value !== v.value) return prev.value < v.value;
    return (prev.scriptpubkey_address ?? "") <= (v.scriptpubkey_address ?? "");
  });
  const isBip69Ordered =
    (tx.vin.length > 1 || tx.vout.length > 1) && inputsSorted && outputsSorted;

  const boltzmann = isCoinbase
    ? {
        computed: false,
        interpretations: null,
        entropyBits: null,
        efficiencyRatio: null,
        deterministicLinks: false,
        note: "Coinbase block-reward transaction.",
      }
    : computeBoltzmannEntropy(inputValues, outputValues, tx.fee);

  const heuristics: PrivacyHeuristic[] = [];

  // 1. Address Reuse (input address == output address OR duplicate output addresses)
  const inAddrs = new Set(
    tx.vin
      .map((v) => v.prevout?.scriptpubkey_address)
      .filter((a): a is string => Boolean(a))
  );
  const outAddrs = tx.vout
    .map((v) => v.scriptpubkey_address)
    .filter((a): a is string => Boolean(a));
  const selfReuse = outAddrs.filter((a) => inAddrs.has(a));
  const dupOut = outAddrs.length !== new Set(outAddrs).size;
  const hasAddressReuse = selfReuse.length > 0 || dupOut;
  heuristics.push({
    id: "address-reuse",
    title: "Address Reuse Detected",
    triggered: hasAddressReuse,
    severity: hasAddressReuse ? "high" : "info",
    penalty: hasAddressReuse ? 30 : 0,
    evidence:
      selfReuse.length > 0
        ? `Change or payout sent back to an input address (${selfReuse[0].slice(0, 14)}...).`
        : dupOut
        ? "Duplicate destination address appears across multiple outputs."
        : "No intra-transaction address reuse detected.",
    remediation:
      "Always derive a fresh change/receive address per transaction or adopt Silent Payments (BIP-352).",
  });

  // 2. Common Input Ownership Heuristic (CIOH)
  const multiInputNoEntropy =
    !isCoinbase &&
    tx.vin.length >= 2 &&
    (boltzmann.entropyBits === null || boltzmann.entropyBits < 1);
  heuristics.push({
    id: "cioh-cluster",
    title: "Common Input Ownership (Multi-Input Clustering)",
    triggered: multiInputNoEntropy,
    severity: multiInputNoEntropy ? "medium" : "info",
    penalty: multiInputNoEntropy ? 18 : 0,
    evidence: multiInputNoEntropy
      ? `${tx.vin.length} inputs merged with <1 bit of Boltzmann ambiguity; chain surveillance links all ${tx.vin.length} input UTXOs to one entity.`
      : tx.vin.length >= 2
      ? `${tx.vin.length} inputs with ${boltzmann.entropyBits} bits of Boltzmann ambiguity (mitigates naive CIOH).`
      : "Single-input spend avoids multi-input UTXO clustering.",
    remediation:
      "Use strict coin control to avoid merging KYC and non-KYC UTXOs, or coordinate collaborative spends via Payjoin (BIP-77).",
  });

  // 3. Script-Type Mismatch Change Fingerprinting (classic 2-output spend)
  let scriptChangeLeak = false;
  let scriptEvidence = "No obvious script-type change mismatch.";
  if (
    !isCoinbase &&
    tx.vout.length === 2 &&
    inputScriptTypes.length === 1 &&
    outputScriptTypes.length === 2 &&
    outputScriptTypes.includes(inputScriptTypes[0])
  ) {
    scriptChangeLeak = true;
    const otherType = outputScriptTypes.find((t) => t !== inputScriptTypes[0]);
    scriptEvidence = `Input uses ${inputScriptTypes[0]}, while outputs split between ${inputScriptTypes[0]} (probable change) and ${otherType} (probable payment).`;
  }
  heuristics.push({
    id: "script-mismatch-change",
    title: "Script-Type Mismatch Change Fingerprinting",
    triggered: scriptChangeLeak,
    severity: scriptChangeLeak ? "medium" : "info",
    penalty: scriptChangeLeak ? 18 : 0,
    evidence: scriptEvidence,
    remediation:
      "Match wallet script types (e.g. Taproot P2TR or SegWit P2WPKH) or use Payjoin / changeless sends when possible.",
  });

  // 4. Round-Number Payment Detection (2-output spend)
  let roundLeak = false;
  let roundEvidence = "No round-number payment vs jagged-change contrast detected.";
  if (!isCoinbase && outputValues.length === 2) {
    const r0 = isRoundBitcoinAmount(outputValues[0]);
    const r1 = isRoundBitcoinAmount(outputValues[1]);
    if (r0 !== r1) {
      roundLeak = true;
      const roundVal = r0 ? outputValues[0] : outputValues[1];
      const jaggedVal = r0 ? outputValues[1] : outputValues[0];
      roundEvidence = `One output is a clean round denomination (${roundVal.toLocaleString()} sats) while the other is jagged (${jaggedVal.toLocaleString()} sats), exposing likely change.`;
    }
  }
  heuristics.push({
    id: "round-number-change",
    title: "Round-Number Payment vs Jagged Change Leak",
    triggered: roundLeak,
    severity: roundLeak ? "low" : "info",
    penalty: roundLeak ? 10 : 0,
    evidence: roundEvidence,
    remediation:
      "Prefer exact UTXO sweeps (changeless spends) or Lightning / Payjoin for round-value payouts.",
  });

  // 5. Unnecessary Input Heuristic (smallest input wasn't needed to cover payment + fee)
  let unnecessaryInput = false;
  let uiEvidence = "Input selection appears minimal for output values.";
  if (!isCoinbase && inputValues.length >= 2 && outputValues.length >= 1) {
    const minInput = Math.min(...inputValues);
    const maxOutput = Math.max(...outputValues);
    if (totalInputSats - minInput >= maxOutput + tx.fee && outputValues.length === 2) {
      unnecessaryInput = true;
      uiEvidence = `Removing the smallest input (${minInput.toLocaleString()} sats) still covers the largest output + fee; suggests consolidation or coin-selection leak.`;
    }
  }
  heuristics.push({
    id: "unnecessary-input",
    title: "Unnecessary Input / Optimal Change Heuristic",
    triggered: unnecessaryInput,
    severity: unnecessaryInput ? "low" : "info",
    penalty: unnecessaryInput ? 8 : 0,
    evidence: uiEvidence,
    remediation:
      "Use Branch-and-Bound / changeless coin selection (Bitcoin Core / Sparrow) to avoid exposing extra UTXOs.",
  });

  // 6. Legacy Non-SegWit Weight Waste
  const usesLegacy =
    inputScriptTypes.includes("p2pkh") || outputScriptTypes.includes("p2pkh");
  heuristics.push({
    id: "legacy-script-weight",
    title: "Legacy P2PKH Script Weight & Fingerprint",
    triggered: usesLegacy,
    severity: usesLegacy ? "low" : "info",
    penalty: usesLegacy ? 8 : 0,
    evidence: usesLegacy
      ? `Legacy script type present (inputs: ${inputScriptTypes.join(", ")}; outputs: ${outputScriptTypes.join(", ")}), paying ~2x higher vByte fees than Taproot P2TR.`
      : `Modern SegWit/Taproot scripts used (${inputScriptTypes.join(", ") || "coinbase"}).`,
    remediation:
      "Migrate to Native SegWit (bc1q) or Taproot (bc1p) descriptors to cut fees and blend with modern wallets.",
  });

  // 7. Fee Overpayment Check (only when live recommended fee is known & tx unconfirmed or recent)
  let overpaid = false;
  let feeEvidence = `Effective fee rate is ${feeRateSatVb} sat/vB (${tx.fee.toLocaleString()} sats across ${vsize} vB).`;
  if (
    !isCoinbase &&
    recommendedFastFeeSatVb &&
    recommendedFastFeeSatVb > 0 &&
    !tx.status.confirmed &&
    feeRateSatVb > recommendedFastFeeSatVb * 2.5 &&
    tx.fee > 1000
  ) {
    overpaid = true;
    const estExcess = Math.round(tx.fee - recommendedFastFeeSatVb * vsize);
    feeEvidence = `Unconfirmed tx pays ${feeRateSatVb} sat/vB vs live fastest-block target ${recommendedFastFeeSatVb} sat/vB (~${estExcess.toLocaleString()} sats excess fee).`;
  }
  heuristics.push({
    id: "fee-hygiene",
    title: "Mempool Fee Rate Hygiene",
    triggered: overpaid,
    severity: overpaid ? "low" : "info",
    penalty: overpaid ? 6 : 0,
    evidence: feeEvidence,
    remediation:
      "Query live mempool fee targets and enable BIP-125 RBF so transactions can start lean and bump only if needed.",
  });

  const totalPenalty = heuristics.reduce((s, h) => s + h.penalty, 0);
  // Bonus if true multi-party Boltzmann entropy > 2 bits
  const entropyBonus =
    boltzmann.entropyBits !== null && boltzmann.entropyBits >= 2 ? 12 : 0;
  const privacyScore = Math.max(0, Math.min(100, 100 - totalPenalty + entropyBonus));
  const grade: TxPrivacyReport["grade"] =
    privacyScore >= 90
      ? "A"
      : privacyScore >= 78
      ? "B"
      : privacyScore >= 64
      ? "C"
      : privacyScore >= 48
      ? "D"
      : "F";

  return {
    auditedAt: new Date().toISOString(),
    sourceUrl: `https://mempool.space/tx/${tx.txid}`,
    txid: tx.txid,
    confirmed: tx.status.confirmed,
    blockHeight: tx.status.block_height ?? null,
    summary: {
      inputsCount: tx.vin.length,
      outputsCount: tx.vout.length,
      totalInputSats,
      totalOutputSats,
      feeSats: tx.fee,
      vsize,
      feeRateSatVb,
      isCoinbase,
      rbfSignaling,
      antiFeeSnipingLocktime,
      isBip69Ordered,
      inputScriptTypes,
      outputScriptTypes,
    },
    boltzmann,
    privacyScore,
    grade,
    heuristics,
  };
}

export async function fetchAndAuditTxPrivacy(txid: string): Promise<TxPrivacyReport> {
  const clean = txid.trim().toLowerCase();
  if (!isValidTxid(clean)) {
    throw new Error("Invalid Bitcoin transaction ID. Expected 64 lowercase/uppercase hex characters.");
  }

  const [txRes, feesRes] = await Promise.all([
    fetch(`https://mempool.space/api/tx/${clean}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    }),
    fetch("https://mempool.space/api/v1/fees/recommended", {
      cache: "no-store",
      signal: AbortSignal.timeout(6_000),
    }).catch(() => null),
  ]);

  if (txRes.status === 404) {
    throw new Error("Bitcoin transaction ID not found on mainnet.");
  }
  if (!txRes.ok) {
    throw new Error(`Upstream mempool.space error (${txRes.status}).`);
  }

  const tx = (await txRes.json()) as MempoolTx;
  let fastFee: number | null = null;
  if (feesRes && feesRes.ok) {
    try {
      const f = (await feesRes.json()) as { fastestFee?: number };
      if (typeof f.fastestFee === "number") fastFee = f.fastestFee;
    } catch {}
  }

  return analyzeTransactionPrivacy(tx, fastFee);
}

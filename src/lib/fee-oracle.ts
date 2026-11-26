export interface FeeOracleReport {
  fetchedAt: string;
  tipHeight: number | null;
  regime: "ultra-low" | "normal" | "elevated" | "fee-spike";
  mempool: {
    txCount: number;
    vsizeMb: number;
    totalFeeBtc: number;
    projectedBlocks: number;
  } | null;
  targetsSatVb: {
    nextBlock: number;
    halfHour: number;
    oneHour: number;
    economy: number;
    minimumRelay: number;
  };
  transactionCostsSats: {
    p2trSingleSpend1In2Out: { vbytes: number; fastSats: number; economySats: number };
    p2wpkhSingleSpend1In2Out: { vbytes: number; fastSats: number; economySats: number };
    multisig2of3P2wsh: { vbytes: number; fastSats: number; economySats: number };
    lightningChannelOpen: { vbytes: number; fastSats: number; economySats: number };
    lightningAnchorCpfpSweep: { vbytes: number; fastSats: number; spike100SatVbSats: number };
  };
  lightningAnchorReserveAdvice: {
    recommendedOnChainReserveSats: number;
    consolidationWindowOpen: boolean;
    note: string;
  };
}

export async function getLiveFeeOracle(): Promise<FeeOracleReport> {
  const [feesRes, mempoolRes, blocksRes, tipRes] = await Promise.allSettled([
    fetch("https://mempool.space/api/v1/fees/recommended", {
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    }),
    fetch("https://mempool.space/api/mempool", {
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    }),
    fetch("https://mempool.space/api/v1/fees/mempool-blocks", {
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    }),
    fetch("https://mempool.space/api/blocks/tip/height", {
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    }),
  ]);

  let nextBlock = 1;
  let halfHour = 1;
  let oneHour = 1;
  let economy = 1;
  let minimumRelay = 1;

  if (feesRes.status === "fulfilled" && feesRes.value.ok) {
    const f = (await feesRes.value.json()) as Record<string, number>;
    nextBlock = Math.max(1, f.fastestFee ?? 1);
    halfHour = Math.max(1, f.halfHourFee ?? nextBlock);
    oneHour = Math.max(1, f.hourFee ?? halfHour);
    economy = Math.max(1, f.economyFee ?? 1);
    minimumRelay = Math.max(1, f.minimumFee ?? 1);
  }

  let mempool: FeeOracleReport["mempool"] = null;
  let projectedBlocks = 0;
  if (blocksRes.status === "fulfilled" && blocksRes.value.ok) {
    try {
      const b = (await blocksRes.value.json()) as unknown[];
      if (Array.isArray(b)) projectedBlocks = b.length;
    } catch {}
  }

  if (mempoolRes.status === "fulfilled" && mempoolRes.value.ok) {
    try {
      const m = (await mempoolRes.value.json()) as {
        count?: number;
        vsize?: number;
        total_fee?: number;
      };
      mempool = {
        txCount: m.count ?? 0,
        vsizeMb: Math.round(((m.vsize ?? 0) / 1e6) * 100) / 100,
        totalFeeBtc: Math.round(((m.total_fee ?? 0) / 1e8) * 10000) / 10000,
        projectedBlocks,
      };
    } catch {}
  }

  let tipHeight: number | null = null;
  if (tipRes.status === "fulfilled" && tipRes.value.ok) {
    const n = Number.parseInt((await tipRes.value.text()).trim(), 10);
    if (!Number.isNaN(n)) tipHeight = n;
  }

  const regime: FeeOracleReport["regime"] =
    nextBlock <= 3
      ? "ultra-low"
      : nextBlock <= 20
      ? "normal"
      : nextBlock <= 60
      ? "elevated"
      : "fee-spike";

  // Anchor CPFP force-close sweep ~360 vB; keep >= 2x concurrent sweeps at 100 sat/vB minimum
  const recommendedOnChainReserveSats = Math.max(100_000, nextBlock * 360 * 4);
  const consolidationWindowOpen = nextBlock <= 8;

  return {
    fetchedAt: new Date().toISOString(),
    tipHeight,
    regime,
    mempool,
    targetsSatVb: {
      nextBlock,
      halfHour,
      oneHour,
      economy,
      minimumRelay,
    },
    transactionCostsSats: {
      p2trSingleSpend1In2Out: {
        vbytes: 154,
        fastSats: 154 * nextBlock,
        economySats: 154 * economy,
      },
      p2wpkhSingleSpend1In2Out: {
        vbytes: 141,
        fastSats: 141 * nextBlock,
        economySats: 141 * economy,
      },
      multisig2of3P2wsh: {
        vbytes: 215,
        fastSats: 215 * nextBlock,
        economySats: 215 * economy,
      },
      lightningChannelOpen: {
        vbytes: 154,
        fastSats: 154 * nextBlock,
        economySats: 154 * economy,
      },
      lightningAnchorCpfpSweep: {
        vbytes: 360,
        fastSats: 360 * nextBlock,
        spike100SatVbSats: 360 * 100,
      },
    },
    lightningAnchorReserveAdvice: {
      recommendedOnChainReserveSats,
      consolidationWindowOpen,
      note: consolidationWindowOpen
        ? `Optimal window (${nextBlock} sat/vB) to consolidate UTXOs, open/splice Lightning channels, and pre-fund dedicated anchor CPFP reserve UTXOs.`
        : `Mempool elevated (${nextBlock} sat/vB); defer non-urgent UTXO consolidation and verify Lightning anchor reserve exceeds ${recommendedOnChainReserveSats.toLocaleString()} sats.`,
    },
  };
}

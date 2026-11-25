import { SECURITY_ADVISORIES, type Severity } from "./advisories";
import { getLifecycleStatus, matchesAnyClause, parseBitcoinUserAgent } from "./version";

export interface CveExposureRow {
  id: string;
  title: string;
  severity: Severity;
  publishedDate: string;
  affectedSummary: string;
  fixedVersions: string[];
  sourceUrl: string;
  discoveryTag?: string;
  vulnerableNodes: number;
  vulnerablePct: number;
}

export interface VersionBranchBucket {
  branch: string;
  nodes: number;
  pct: number;
  isEol: boolean;
  vulnerableNodes: number;
  topUserAgent: string;
}

export interface MainnetRadarReport {
  fetchedAt: string;
  snapshotTimestamp: number | null;
  source: {
    nodesCensus: string;
    chainStats: string;
  };
  tipHeight: number | null;
  recommendedFees: {
    fastestFee: number;
    halfHourFee: number;
    hourFee: number;
    economyFee: number;
  } | null;
  lightningNetwork: {
    nodeCount: number;
    channelCount: number;
    totalCapacityBtc: number;
    torNodes: number;
    clearnetNodes: number;
    clearnetTorNodes: number;
    unannouncedNodes: number;
    clearnetSharePct: number;
  } | null;
  bitcoinCensus: {
    totalReachableNodes: number;
    parsedCoreNodes: number;
    knotsNodes: number;
    otherClientNodes: number;
    vulnerableAnyCveNodes: number;
    vulnerableAnyCvePct: number;
    vulnerableHighCriticalNodes: number;
    vulnerableHighCriticalPct: number;
    eolBranchNodes: number;
    eolBranchPct: number;
    fullyPatchedNodes: number;
    fullyPatchedPct: number;
  };
  cveExposure: CveExposureRow[];
  branchDistribution: VersionBranchBucket[];
  topVulnerableUserAgents: Array<{
    userAgent: string;
    nodes: number;
    pct: number;
    cveIds: string[];
    isEol: boolean;
  }>;
  upstreamStatus: "live" | "partial" | "unavailable";
  warnings: string[];
}

interface BtcnodesSnapshot {
  timestamp: number;
  total_nodes: number;
  latest_height?: number;
  nodes: Record<string, [number, string, ...unknown[]]>;
}

interface MempoolLightningStats {
  latest?: {
    node_count: number;
    channel_count: number;
    total_capacity: number;
    tor_nodes: number;
    clearnet_nodes: number;
    clearnet_tor_nodes: number;
    unannounced_nodes: number;
  };
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
let cachedReport: { data: MainnetRadarReport; expiresAt: number } | null = null;

function roundPct(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((part / total) * 1000) / 10;
}

export function computeRadarFromCensus(
  userAgentCounts: Map<string, number>,
  totalReachableNodes: number,
  snapshotTimestamp: number | null,
  tipHeight: number | null,
  recommendedFees: MainnetRadarReport["recommendedFees"],
  lightningNetwork: MainnetRadarReport["lightningNetwork"],
  warnings: string[] = []
): MainnetRadarReport {
  const coreAdvisories = SECURITY_ADVISORIES.filter(
    (a) => a.software === "bitcoin-core"
  );

  const cveCounts = new Map<string, number>();
  for (const adv of coreAdvisories) {
    cveCounts.set(adv.id, 0);
  }

  let parsedCoreNodes = 0;
  let knotsNodes = 0;
  let otherClientNodes = 0;
  let vulnerableAnyCveNodes = 0;
  let vulnerableHighCriticalNodes = 0;
  let eolBranchNodes = 0;
  let fullyPatchedNodes = 0;

  const branchMap = new Map<
    string,
    {
      nodes: number;
      isEol: boolean;
      vulnerableNodes: number;
      topUa: string;
      topUaCount: number;
    }
  >();

  const vulnerableUaRows: Array<{
    userAgent: string;
    nodes: number;
    pct: number;
    cveIds: string[];
    isEol: boolean;
  }> = [];

  for (const [ua, count] of userAgentCounts.entries()) {
    const info = parseBitcoinUserAgent(ua);
    if (!info.version) {
      otherClientNodes += count;
      continue;
    }

    parsedCoreNodes += count;
    if (info.isKnots) knotsNodes += count;

    const lifecycle = getLifecycleStatus("bitcoin-core", info.version);
    const matchingCves = coreAdvisories.filter((adv) =>
      matchesAnyClause(info.version!, adv.affectedClauses)
    );

    const isVulnerable = matchingCves.length > 0;
    const hasHighOrCrit = matchingCves.some(
      (c) => c.severity === "high" || c.severity === "critical"
    );

    if (lifecycle.isEol) eolBranchNodes += count;
    if (isVulnerable) {
      vulnerableAnyCveNodes += count;
      for (const cve of matchingCves) {
        cveCounts.set(cve.id, (cveCounts.get(cve.id) ?? 0) + count);
      }
      vulnerableUaRows.push({
        userAgent: ua,
        nodes: count,
        pct: roundPct(count, parsedCoreNodes > 0 ? totalReachableNodes : 1),
        cveIds: matchingCves.map((c) => c.id),
        isEol: lifecycle.isEol,
      });
    } else if (!lifecycle.isEol) {
      fullyPatchedNodes += count;
    }

    if (hasHighOrCrit) {
      vulnerableHighCriticalNodes += count;
    }

    const branchKey =
      info.version.major === 0
        ? `0.${info.version.minor}.x`
        : `${info.version.major}.x`;
    const existing = branchMap.get(branchKey);
    if (!existing) {
      branchMap.set(branchKey, {
        nodes: count,
        isEol: lifecycle.isEol,
        vulnerableNodes: isVulnerable ? count : 0,
        topUa: ua,
        topUaCount: count,
      });
    } else {
      existing.nodes += count;
      if (isVulnerable) existing.vulnerableNodes += count;
      if (count > existing.topUaCount) {
        existing.topUa = ua;
        existing.topUaCount = count;
      }
    }
  }

  const denominator = parsedCoreNodes > 0 ? parsedCoreNodes : totalReachableNodes;

  const cveExposure: CveExposureRow[] = coreAdvisories
    .map((adv) => {
      const vulnerableNodes = cveCounts.get(adv.id) ?? 0;
      return {
        id: adv.id,
        title: adv.title,
        severity: adv.severity,
        publishedDate: adv.publishedDate,
        affectedSummary: adv.affectedSummary,
        fixedVersions: adv.fixedVersions,
        sourceUrl: adv.sourceUrl,
        discoveryTag: adv.discoveryTag,
        vulnerableNodes,
        vulnerablePct: roundPct(vulnerableNodes, denominator),
      };
    })
    .filter((row) => row.vulnerableNodes > 0)
    .sort((a, b) => b.vulnerableNodes - a.vulnerableNodes);

  const branchDistribution: VersionBranchBucket[] = Array.from(branchMap.entries())
    .map(([branch, b]) => ({
      branch,
      nodes: b.nodes,
      pct: roundPct(b.nodes, denominator),
      isEol: b.isEol,
      vulnerableNodes: b.vulnerableNodes,
      topUserAgent: b.topUa,
    }))
    .sort((a, b) => b.nodes - a.nodes)
    .slice(0, 12);

  vulnerableUaRows.sort((a, b) => b.nodes - a.nodes);
  const topVulnerableUserAgents = vulnerableUaRows.slice(0, 12).map((row) => ({
    ...row,
    pct: roundPct(row.nodes, denominator),
  }));

  const upstreamStatus: MainnetRadarReport["upstreamStatus"] =
    totalReachableNodes > 0 && lightningNetwork
      ? "live"
      : totalReachableNodes > 0 || lightningNetwork
      ? "partial"
      : "unavailable";

  return {
    fetchedAt: new Date().toISOString(),
    snapshotTimestamp,
    source: {
      nodesCensus: "https://btcnodes.io/api/v1/snapshots/latest/",
      chainStats: "https://mempool.space/api/v1/lightning/statistics/latest",
    },
    tipHeight,
    recommendedFees,
    lightningNetwork,
    bitcoinCensus: {
      totalReachableNodes,
      parsedCoreNodes,
      knotsNodes,
      otherClientNodes,
      vulnerableAnyCveNodes,
      vulnerableAnyCvePct: roundPct(vulnerableAnyCveNodes, denominator),
      vulnerableHighCriticalNodes,
      vulnerableHighCriticalPct: roundPct(vulnerableHighCriticalNodes, denominator),
      eolBranchNodes,
      eolBranchPct: roundPct(eolBranchNodes, denominator),
      fullyPatchedNodes,
      fullyPatchedPct: roundPct(fullyPatchedNodes, denominator),
    },
    cveExposure,
    branchDistribution,
    topVulnerableUserAgents,
    upstreamStatus,
    warnings,
  };
}

export async function getLiveMainnetRadar(
  forceRefresh = false
): Promise<MainnetRadarReport> {
  if (!forceRefresh && cachedReport && Date.now() < cachedReport.expiresAt) {
    return cachedReport.data;
  }

  const warnings: string[] = [];
  const uaCounts = new Map<string, number>();
  let totalReachableNodes = 0;
  let snapshotTimestamp: number | null = null;
  let tipHeight: number | null = null;
  let recommendedFees: MainnetRadarReport["recommendedFees"] = null;
  let lightningNetwork: MainnetRadarReport["lightningNetwork"] = null;

  const [nodesResult, tipResult, feesResult, lnStatsResult] =
    await Promise.allSettled([
      fetch("https://btcnodes.io/api/v1/snapshots/latest/", {
        cache: "no-store",
        headers: { "User-Agent": "SatSentry/1.0 (+https://github.com/theguysaccount/satsentry)" },
        signal: AbortSignal.timeout(12_000),
      }),
      fetch("https://mempool.space/api/blocks/tip/height", {
        cache: "no-store",
        signal: AbortSignal.timeout(8_000),
      }),
      fetch("https://mempool.space/api/v1/fees/recommended", {
        cache: "no-store",
        signal: AbortSignal.timeout(8_000),
      }),
      fetch("https://mempool.space/api/v1/lightning/statistics/latest", {
        cache: "no-store",
        signal: AbortSignal.timeout(8_000),
      }),
    ]);

  if (nodesResult.status === "fulfilled" && nodesResult.value.ok) {
    try {
      const snap = (await nodesResult.value.json()) as BtcnodesSnapshot;
      totalReachableNodes = snap.total_nodes ?? 0;
      snapshotTimestamp = snap.timestamp ?? null;
      if (snap.latest_height && !tipHeight) {
        tipHeight = snap.latest_height;
      }
      for (const entry of Object.values(snap.nodes ?? {})) {
        const ua = typeof entry[1] === "string" ? entry[1] : "";
        if (!ua) continue;
        uaCounts.set(ua, (uaCounts.get(ua) ?? 0) + 1);
      }
      if (totalReachableNodes === 0) {
        totalReachableNodes = Array.from(uaCounts.values()).reduce((a, b) => a + b, 0);
      }
    } catch {
      warnings.push("Failed to parse btcnodes.io live snapshot payload.");
    }
  } else {
    warnings.push("Live btcnodes.io census temporarily unreachable.");
  }

  if (tipResult.status === "fulfilled" && tipResult.value.ok) {
    const raw = (await tipResult.value.text()).trim();
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isNaN(parsed)) tipHeight = parsed;
  }

  if (feesResult.status === "fulfilled" && feesResult.value.ok) {
    try {
      const f = (await feesResult.value.json()) as Record<string, number>;
      if (typeof f.fastestFee === "number") {
        recommendedFees = {
          fastestFee: f.fastestFee,
          halfHourFee: f.halfHourFee ?? f.fastestFee,
          hourFee: f.hourFee ?? f.fastestFee,
          economyFee: f.economyFee ?? 1,
        };
      }
    } catch {
      warnings.push("Failed to parse mempool.space fee recommendations.");
    }
  }

  if (lnStatsResult.status === "fulfilled" && lnStatsResult.value.ok) {
    try {
      const stats = (await lnStatsResult.value.json()) as MempoolLightningStats;
      if (stats.latest) {
        const l = stats.latest;
        const clearnetTotal = (l.clearnet_nodes ?? 0) + (l.clearnet_tor_nodes ?? 0);
        lightningNetwork = {
          nodeCount: l.node_count,
          channelCount: l.channel_count,
          totalCapacityBtc: Math.round((l.total_capacity / 1e8) * 100) / 100,
          torNodes: l.tor_nodes,
          clearnetNodes: l.clearnet_nodes,
          clearnetTorNodes: l.clearnet_tor_nodes,
          unannouncedNodes: l.unannounced_nodes,
          clearnetSharePct: roundPct(clearnetTotal, l.node_count),
        };
      }
    } catch {
      warnings.push("Failed to parse mempool.space Lightning statistics.");
    }
  } else {
    warnings.push("Live mempool.space Lightning stats temporarily unreachable.");
  }

  const report = computeRadarFromCensus(
    uaCounts,
    totalReachableNodes,
    snapshotTimestamp,
    tipHeight,
    recommendedFees,
    lightningNetwork,
    warnings
  );

  if (report.upstreamStatus !== "unavailable") {
    cachedReport = {
      data: report,
      expiresAt: Date.now() + CACHE_TTL_MS,
    };
  }

  return report;
}

import type { Severity } from "./advisories";

export interface MempoolLightningFeature {
  bit: number;
  name: string;
  is_required: boolean;
  is_known: boolean;
}

export interface MempoolLightningNode {
  public_key: string;
  alias: string;
  first_seen: number;
  updated_at: number;
  color: string;
  sockets: string;
  as_number: number | null;
  as_organization: string | null;
  iso_code: string | null;
  country: { en?: string } | null;
  active_channel_count?: number;
  capacity?: string | number;
  features: MempoolLightningFeature[];
}

export interface MempoolLightningChannel {
  status: number;
  capacity: number;
  short_id: string;
  id: string;
  fee_rate: number;
  node?: {
    alias: string;
    public_key: string;
    channels: number;
    capacity: string | number;
  };
}

export interface PostureCheck {
  id: string;
  category: "network" | "protocol" | "liquidity" | "liveness";
  title: string;
  status: "pass" | "warn" | "fail";
  severity: Severity | "info";
  weight: number;
  earned: number;
  evidence: string;
  remediation: string;
}

export interface LightningPostureReport {
  auditedAt: string;
  sourceUrl: string;
  publicKey: string;
  alias: string;
  color: string;
  firstSeenIso: string | null;
  updatedAtIso: string | null;
  transport: {
    hasClearnet: boolean;
    hasTor: boolean;
    mode: "tor-only" | "hybrid-clearnet-tor" | "clearnet-only" | "unannounced";
    sockets: string[];
    asNumber: number | null;
    asOrganization: string | null;
    isMajorCloudHost: boolean;
    country: string | null;
  };
  metrics: {
    activeChannelsSampled: number;
    totalReportedChannels: number | null;
    totalCapacitySats: number;
    topPeerSharePct: number;
    top3PeersSharePct: number;
    hhiConcentration: number;
    medianFeeRatePpm: number | null;
    maxFeeRatePpm: number | null;
  };
  features: {
    supportedCount: number;
    hasDataLossProtect: boolean;
    hasStaticRemoteKey: boolean;
    hasZeroFeeAnchors: boolean;
    hasRouteBlinding: boolean;
    hasOnionMessages: boolean;
    hasDualFund: boolean;
    hasWumbo: boolean;
    rawNames: string[];
  };
  score: number;
  grade: "A" | "B" | "C" | "D" | "F";
  checks: PostureCheck[];
  topPeers: Array<{
    alias: string;
    publicKey: string;
    capacitySats: number;
    sharePct: number;
    channelCount: number;
  }>;
}

const MAJOR_CLOUD_PATTERNS = [
  /amazon/i,
  /aws/i,
  /google/i,
  /microsoft/i,
  /azure/i,
  /hetzner/i,
  /digitalocean/i,
  /\bovh\b/i,
  /linode/i,
  /akamai/i,
  /vultr/i,
  /oracle/i,
  /alibaba/i,
  /contabo/i,
  /choopa/i,
];

export function isValidLightningPubkey(pubkey: string): boolean {
  return /^(02|03)[0-9a-fA-F]{64}$/.test(pubkey.trim());
}

export function evaluateLightningPosture(
  node: MempoolLightningNode,
  openChannels: MempoolLightningChannel[],
  nowUnixSeconds = Math.floor(Date.now() / 1000)
): LightningPostureReport {
  const sockets = (node.sockets || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const hasTor = sockets.some((s) => s.includes(".onion"));
  const hasClearnet = sockets.some((s) => !s.includes(".onion"));
  const mode: LightningPostureReport["transport"]["mode"] =
    hasClearnet && hasTor
      ? "hybrid-clearnet-tor"
      : hasTor
      ? "tor-only"
      : hasClearnet
      ? "clearnet-only"
      : "unannounced";

  const asOrg = node.as_organization || null;
  const isMajorCloudHost = Boolean(
    asOrg && MAJOR_CLOUD_PATTERNS.some((rx) => rx.test(asOrg))
  );

  // BOLT feature bits (even = required, odd = optional)
  const featureBits = new Set((node.features || []).map((f) => f.bit));
  const featureNames = (node.features || []).map((f) => f.name).filter(Boolean);
  const hasBitPair = (evenBit: number) =>
    featureBits.has(evenBit) || featureBits.has(evenBit + 1);

  const hasDataLossProtect = hasBitPair(0);
  const hasStaticRemoteKey = hasBitPair(12);
  const hasZeroFeeAnchors = hasBitPair(22);
  const hasRouteBlinding = hasBitPair(24);
  const hasOnionMessages = hasBitPair(38);
  const hasDualFund = hasBitPair(28);
  const hasWumbo = hasBitPair(18);

  // Peer concentration & force-close blast radius from real open channels
  const peerAgg = new Map<
    string,
    { alias: string; publicKey: string; capacitySats: number; channelCount: number }
  >();

  let sampledCapacitySats = 0;
  const feeRates: number[] = [];

  for (const ch of openChannels) {
    const cap = Number(ch.capacity || 0);
    sampledCapacitySats += cap;
    if (typeof ch.fee_rate === "number" && Number.isFinite(ch.fee_rate)) {
      feeRates.push(ch.fee_rate);
    }
    const peerKey = ch.node?.public_key ?? ch.short_id;
    const peerAlias = ch.node?.alias || peerKey.slice(0, 12);
    const existing = peerAgg.get(peerKey);
    if (existing) {
      existing.capacitySats += cap;
      existing.channelCount += 1;
    } else {
      peerAgg.set(peerKey, {
        alias: peerAlias,
        publicKey: peerKey,
        capacitySats: cap,
        channelCount: 1,
      });
    }
  }

  const reportedCapacitySats =
    node.capacity !== undefined ? Number(node.capacity) : sampledCapacitySats;
  const effectiveCapacitySats =
    sampledCapacitySats > 0 ? sampledCapacitySats : reportedCapacitySats;

  const sortedPeers = Array.from(peerAgg.values()).sort(
    (a, b) => b.capacitySats - a.capacitySats
  );

  const topPeers = sortedPeers.slice(0, 8).map((p) => ({
    ...p,
    sharePct:
      sampledCapacitySats > 0
        ? Math.round((p.capacitySats / sampledCapacitySats) * 1000) / 10
        : 0,
  }));

  const topPeerSharePct = topPeers[0]?.sharePct ?? 0;
  const top3PeersSharePct =
    Math.round(
      topPeers.slice(0, 3).reduce((acc, p) => acc + p.sharePct, 0) * 10
    ) / 10;

  // Herfindahl-Hirschman Index (0..10000; >2500 indicates high concentration)
  let hhiConcentration = 0;
  if (sampledCapacitySats > 0) {
    for (const p of sortedPeers) {
      const share = (p.capacitySats / sampledCapacitySats) * 100;
      hhiConcentration += share * share;
    }
    hhiConcentration = Math.round(hhiConcentration);
  }

  feeRates.sort((a, b) => a - b);
  const medianFeeRatePpm =
    feeRates.length > 0 ? feeRates[Math.floor(feeRates.length / 2)] : null;
  const maxFeeRatePpm =
    feeRates.length > 0 ? feeRates[feeRates.length - 1] : null;

  const checks: PostureCheck[] = [];

  // 1. Data-loss-protect (BOLT 2 bits 0/1)
  checks.push({
    id: "bolt-dlp",
    category: "protocol",
    title: "Option Data-Loss-Protect (DLP) advertised",
    status: hasDataLossProtect ? "pass" : "fail",
    severity: hasDataLossProtect ? "info" : "high",
    weight: 20,
    earned: hasDataLossProtect ? 20 : 0,
    evidence: hasDataLossProtect
      ? "Feature bit 0/1 (data-loss-protect) is enabled in node gossip."
      : "Feature bit 0/1 (data-loss-protect) is missing from node_announcement.",
    remediation:
      "Enable option_data_loss_protect (default in all modern LND, CLN, Eclair, and LDK builds) to prevent penalty loss after state recovery.",
  });

  // 2. Static remote key (bits 12/13)
  checks.push({
    id: "bolt-static-remotekey",
    category: "protocol",
    title: "Static Remote Key enabled (crash-safe sweep)",
    status: hasStaticRemoteKey ? "pass" : "fail",
    severity: hasStaticRemoteKey ? "info" : "high",
    weight: 15,
    earned: hasStaticRemoteKey ? 15 : 0,
    evidence: hasStaticRemoteKey
      ? "Feature bit 12/13 (option_static_remotekey) is active."
      : "Feature bit 12/13 (option_static_remotekey) not advertised.",
    remediation:
      "Upgrade node and rotate legacy channels to option_static_remotekey so funds remain recoverable from seed alone.",
  });

  // 3. Zero-fee HTLC Anchor Outputs (bits 22/23)
  checks.push({
    id: "bolt-anchors-zero-fee",
    category: "protocol",
    title: "Zero-Fee Anchor Outputs (mempool fee-spike defense)",
    status: hasZeroFeeAnchors ? "pass" : "warn",
    severity: hasZeroFeeAnchors ? "info" : "medium",
    weight: 20,
    earned: hasZeroFeeAnchors ? 20 : 6,
    evidence: hasZeroFeeAnchors
      ? "Feature bit 22/23 (option_anchors_zero_fee_htlc_tx) is enabled."
      : "Feature bit 22/23 (zero-fee anchors) is missing; force-close sweeps face fee-spike pin risk.",
    remediation:
      "Enable anchor channels (zero-fee HTLC) and maintain an on-chain reserve UTXO for CPFP force-close fee bumping.",
  });

  // 4. Modern Privacy & BOLT12 readiness (Route Blinding 24/25 + Onion Messages 38/39)
  const modernPrivacyEarned =
    (hasRouteBlinding ? 5 : 0) + (hasOnionMessages ? 5 : 0);
  checks.push({
    id: "bolt-modern-privacy",
    category: "protocol",
    title: "Route Blinding & Onion Messages (BOLT 12 readiness)",
    status:
      hasRouteBlinding && hasOnionMessages
        ? "pass"
        : hasRouteBlinding || hasOnionMessages
        ? "warn"
        : "warn",
    severity: hasRouteBlinding && hasOnionMessages ? "info" : "low",
    weight: 10,
    earned: modernPrivacyEarned,
    evidence: `Route Blinding (24/25): ${hasRouteBlinding ? "yes" : "no"} | Onion Messages (38/39): ${hasOnionMessages ? "yes" : "no"}`,
    remediation:
      "Enable onion messages and route blinding (supported in modern CLN, Eclair, LDK, and LND) to protect receiver topology and support BOLT 12.",
  });

  // 5. Transport & DoS/Privacy Exposure
  const transportStatus: PostureCheck["status"] =
    mode === "tor-only" || mode === "hybrid-clearnet-tor"
      ? "pass"
      : mode === "clearnet-only"
      ? "warn"
      : "warn";
  const transportEarned =
    mode === "hybrid-clearnet-tor"
      ? 10
      : mode === "tor-only"
      ? 10
      : mode === "clearnet-only"
      ? 6
      : 5;
  checks.push({
    id: "net-transport",
    category: "network",
    title: "Network Transport & Tor Redundancy",
    status: transportStatus,
    severity: transportStatus === "pass" ? "info" : "low",
    weight: 10,
    earned: transportEarned,
    evidence:
      sockets.length > 0
        ? `Mode: ${mode} (${sockets.length} announced socket${sockets.length === 1 ? "" : "s"}).`
        : "No public P2P sockets announced in gossip.",
    remediation:
      mode === "clearnet-only"
        ? "Add a Tor v3 onion endpoint alongside clearnet (or firewall admin ports strictly off clearnet IP) to improve censorship resilience and isolate RPC/REST ports."
        : "Verify that P2P port 9735 is the only publicly reachable service on clearnet interfaces.",
  });

  // 6. Hosting / ASN Centralization Check
  checks.push({
    id: "net-asn-hosting",
    category: "network",
    title: "Cloud / ASN Infrastructure Exposure",
    status: hasClearnet && isMajorCloudHost ? "warn" : "pass",
    severity: hasClearnet && isMajorCloudHost ? "low" : "info",
    weight: 5,
    earned: hasClearnet && isMajorCloudHost ? 2 : 5,
    evidence: hasClearnet
      ? `Announced IP maps to ${asOrg ?? "Unknown ASN"}${node.as_number ? ` (AS${node.as_number})` : ""}${node.iso_code ? ` [${node.iso_code}]` : ""}.`
      : "No clearnet IP exposed in public gossip.",
    remediation:
      hasClearnet && isMajorCloudHost
        ? "Public IP is hosted on a major hyperscaler/VPS provider; avoid running signing keys on shared cloud instances without HSM/remote-signer (VLS) isolation and strict firewalling."
        : "Good infrastructure isolation from centralized hyperscaler ASN footprints.",
  });

  // 7. Peer Concentration & Force-Close Blast Radius
  let liqStatus: PostureCheck["status"] = "pass";
  let liqSeverity: PostureCheck["severity"] = "info";
  let liqEarned = 15;
  let liqEvidence = "";
  if (openChannels.length === 0) {
    liqStatus = "warn";
    liqSeverity = "low";
    liqEarned = 8;
    liqEvidence = "No open public channels returned by mempool.space gossip.";
  } else if (topPeerSharePct >= 50 || hhiConcentration >= 3500) {
    liqStatus = "fail";
    liqSeverity = "medium";
    liqEarned = 4;
    liqEvidence = `Top peer (${topPeers[0]?.alias}) holds ${topPeerSharePct}% of sampled channel capacity (HHI ${hhiConcentration}). High single-peer force-close blast radius.`;
  } else if (topPeerSharePct >= 25 || hhiConcentration >= 1800) {
    liqStatus = "warn";
    liqSeverity = "low";
    liqEarned = 10;
    liqEvidence = `Top peer (${topPeers[0]?.alias}) holds ${topPeerSharePct}% of sampled capacity; top 3 peers hold ${top3PeersSharePct}% (HHI ${hhiConcentration}).`;
  } else {
    liqEvidence = `Well-diversified across sampled peers: top peer ${topPeerSharePct}%, top 3 peers ${top3PeersSharePct}% (HHI ${hhiConcentration}).`;
  }

  checks.push({
    id: "liq-concentration",
    category: "liquidity",
    title: "Channel Peer Diversity & Force-Close Blast Radius",
    status: liqStatus,
    severity: liqSeverity,
    weight: 15,
    earned: liqEarned,
    evidence: liqEvidence,
    remediation:
      "Keep single-peer capacity below 25% of total routing capital so a single unresponsive peer or mass force-close cannot trap liquidity or exhaust CPFP reserves.",
  });

  // 8. Gossip Liveness
  const ageDays =
    node.updated_at > 0
      ? Math.max(0, Math.round(((nowUnixSeconds - node.updated_at) / 86400) * 10) / 10)
      : null;
  const staleFail = ageDays !== null && ageDays > 30;
  const staleWarn = ageDays !== null && ageDays > 14 && ageDays <= 30;
  checks.push({
    id: "live-gossip",
    category: "liveness",
    title: "Gossip Announcement Freshness",
    status: staleFail ? "fail" : staleWarn ? "warn" : "pass",
    severity: staleFail ? "medium" : staleWarn ? "low" : "info",
    weight: 5,
    earned: staleFail ? 0 : staleWarn ? 3 : 5,
    evidence:
      ageDays !== null
        ? `Last gossip node_announcement was ${ageDays} days ago.`
        : "No gossip timestamp recorded.",
    remediation:
      "Verify node uptime, gossip propagation, and watchtower coverage; nodes silent >14 days risk pruning from routing tables and undetected channel breaches.",
  });

  const maxWeight = checks.reduce((s, c) => s + c.weight, 0);
  const earnedWeight = checks.reduce((s, c) => s + c.earned, 0);
  const score = maxWeight > 0 ? Math.round((earnedWeight / maxWeight) * 100) : 0;

  const grade: LightningPostureReport["grade"] =
    score >= 90 ? "A" : score >= 80 ? "B" : score >= 68 ? "C" : score >= 50 ? "D" : "F";

  return {
    auditedAt: new Date().toISOString(),
    sourceUrl: `https://mempool.space/lightning/node/${node.public_key}`,
    publicKey: node.public_key,
    alias: node.alias || "(unnamed node)",
    color: node.color || "#F7931A",
    firstSeenIso: node.first_seen
      ? new Date(node.first_seen * 1000).toISOString()
      : null,
    updatedAtIso: node.updated_at
      ? new Date(node.updated_at * 1000).toISOString()
      : null,
    transport: {
      hasClearnet,
      hasTor,
      mode,
      sockets,
      asNumber: node.as_number ?? null,
      asOrganization: asOrg,
      isMajorCloudHost,
      country: node.country?.en ?? node.iso_code ?? null,
    },
    metrics: {
      activeChannelsSampled: openChannels.length,
      totalReportedChannels:
        typeof node.active_channel_count === "number"
          ? node.active_channel_count
          : null,
      totalCapacitySats: effectiveCapacitySats,
      topPeerSharePct,
      top3PeersSharePct,
      hhiConcentration,
      medianFeeRatePpm,
      maxFeeRatePpm,
    },
    features: {
      supportedCount: featureNames.length,
      hasDataLossProtect,
      hasStaticRemoteKey,
      hasZeroFeeAnchors,
      hasRouteBlinding,
      hasOnionMessages,
      hasDualFund,
      hasWumbo,
      rawNames: featureNames,
    },
    score,
    grade,
    checks,
    topPeers,
  };
}

export async function fetchAndAuditLightningNode(
  pubkey: string
): Promise<LightningPostureReport> {
  const cleanKey = pubkey.trim().toLowerCase();
  if (!isValidLightningPubkey(cleanKey)) {
    throw new Error(
      "Invalid Lightning public key. Expected a 66-character hex compressed secp256k1 pubkey starting with 02 or 03."
    );
  }

  const [nodeRes, chRes] = await Promise.all([
    fetch(`https://mempool.space/api/v1/lightning/nodes/${cleanKey}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    }),
    fetch(
      `https://mempool.space/api/v1/lightning/channels?public_key=${cleanKey}&status=open&index=0`,
      {
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      }
    ),
  ]);

  if (nodeRes.status === 404) {
    throw new Error("Lightning node public key was not found in public mainnet gossip.");
  }
  if (!nodeRes.ok) {
    throw new Error(`Upstream mempool.space error (${nodeRes.status}).`);
  }

  const node = (await nodeRes.json()) as MempoolLightningNode;
  let openChannels: MempoolLightningChannel[] = [];
  if (chRes.ok) {
    const chJson = (await chRes.json()) as unknown;
    if (Array.isArray(chJson)) {
      openChannels = chJson as MempoolLightningChannel[];
    }
  }

  return evaluateLightningPosture(node, openChannels);
}

export interface LightningSearchHit {
  publicKey: string;
  alias: string;
  capacitySats: number | null;
  channels: number | null;
  active: boolean;
}

export async function searchLightningNodes(
  query: string
): Promise<LightningSearchHit[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const res = await fetch(
    `https://mempool.space/api/v1/lightning/search?searchText=${encodeURIComponent(trimmed)}`,
    {
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    }
  );

  if (!res.ok) {
    throw new Error(`Upstream search error (${res.status}).`);
  }

  const data = (await res.json()) as {
    nodes?: Array<{
      public_key: string;
      alias: string;
      capacity: number | null;
      channels: number | null;
      status: number;
    }>;
  };

  return (data.nodes ?? []).slice(0, 12).map((n) => ({
    publicKey: n.public_key,
    alias: n.alias || "(unnamed)",
    capacitySats: n.capacity,
    channels: n.channels,
    active: n.status === 1,
  }));
}

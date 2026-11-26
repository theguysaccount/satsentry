import { NextRequest, NextResponse } from "next/server";
import { SOFTWARE_CATALOG } from "@/lib/advisories";
import { auditComponent } from "@/lib/audit-engine";
import { renderSvgBadge } from "@/lib/badge";
import {
  fetchAndAuditLightningNode,
  isValidLightningPubkey,
} from "@/lib/lightning-posture";
import { getLiveMainnetRadar } from "@/lib/mainnet-radar";
import type { SoftwareId } from "@/lib/version";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");
  const software = searchParams.get("software") as SoftwareId | null;
  const version = searchParams.get("version");
  const pubkey = searchParams.get("pubkey");

  let svg = "";
  let cacheHeader = "public, s-maxage=300, stale-while-revalidate=600";

  if (software && version && software in SOFTWARE_CATALOG) {
    const res = auditComponent({ software, version });
    const shortName = SOFTWARE_CATALOG[software].name.split(" ")[0];
    if (res.status === "secure") {
      svg = renderSvgBadge(
        "SatSentry",
        `${shortName} ${res.parsedVersion ?? version} · Patched`,
        "#10b981"
      );
    } else if (res.status === "eol") {
      svg = renderSvgBadge(
        "SatSentry",
        `${shortName} ${res.parsedVersion ?? version} · EOL`,
        "#f59e0b"
      );
    } else if (res.status === "vulnerable") {
      const color =
        res.highestSeverity === "critical" || res.highestSeverity === "high"
          ? "#ef4444"
          : "#f59e0b";
      svg = renderSvgBadge(
        "SatSentry",
        `${shortName} ${res.parsedVersion ?? version} · ${res.findings.length} CVE`,
        color
      );
    } else {
      svg = renderSvgBadge("SatSentry", "Invalid Version", "#94a3b8");
    }
  } else if (pubkey && isValidLightningPubkey(pubkey)) {
    try {
      const report = await fetchAndAuditLightningNode(pubkey);
      const color =
        report.grade === "A" || report.grade === "B"
          ? "#10b981"
          : report.grade === "C"
          ? "#f59e0b"
          : "#ef4444";
      const alias = report.alias.slice(0, 18);
      svg = renderSvgBadge(
        "SatSentry LN",
        `${alias} · Grade ${report.grade} (${report.score}/100)`,
        color
      );
      cacheHeader = "public, s-maxage=180, stale-while-revalidate=360";
    } catch {
      svg = renderSvgBadge("SatSentry LN", "Node Not Found", "#94a3b8");
    }
  } else if (type === "mainnet" || (!software && !pubkey)) {
    const radar = await getLiveMainnetRadar();
    const pct = radar.bitcoinCensus.vulnerableAnyCvePct;
    const color = pct >= 50 ? "#ef4444" : pct >= 25 ? "#f59e0b" : "#10b981";
    svg = renderSvgBadge(
      "SatSentry Mainnet",
      `${pct}% Nodes CVE-Exposed (${radar.bitcoinCensus.totalReachableNodes.toLocaleString()} scanned)`,
      color
    );
  } else {
    svg = renderSvgBadge("SatSentry", "Unknown Query", "#94a3b8");
  }

  return new NextResponse(svg, {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": cacheHeader,
    },
  });
}

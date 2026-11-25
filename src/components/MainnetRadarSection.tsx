"use client";

import { useState } from "react";
import {
  Activity,
  AlertTriangle,
  ExternalLink,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Zap,
} from "lucide-react";
import type { MainnetRadarReport } from "@/lib/mainnet-radar";

function severityBadge(severity: string) {
  switch (severity) {
    case "critical":
      return "bg-red-500/15 text-red-300 border-red-500/35";
    case "high":
      return "bg-orange-500/15 text-orange-300 border-orange-500/35";
    case "medium":
      return "bg-amber-500/15 text-amber-300 border-amber-500/35";
    default:
      return "bg-sky-500/15 text-sky-300 border-sky-500/35";
  }
}

export function MainnetRadarSection({
  initialRadar,
}: {
  initialRadar: MainnetRadarReport;
}) {
  const [radar, setRadar] = useState<MainnetRadarReport>(initialRadar);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRefresh() {
    setRefreshing(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/radar?refresh=1");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const fresh = (await res.json()) as MainnetRadarReport;
      setRadar(fresh);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to refresh live census."
      );
    } finally {
      setRefreshing(false);
    }
  }

  const { bitcoinCensus: btc, lightningNetwork: ln } = radar;
  const maxCveNodes = Math.max(
    1,
    ...radar.cveExposure.map((c) => c.vulnerableNodes)
  );

  return (
    <section id="radar" className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-[#f7931a]/30 bg-[#f7931a]/10 px-3 py-1 text-xs font-mono text-[#f7931a]">
            <Activity className="h-3.5 w-3.5" />
            LIVE MAINNET TELEMETRY · ZERO SIMULATED DATA
          </div>
          <h2 className="mt-2 font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Bitcoin Network CVE Exposure Radar
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Computed directly from live reachable node user-agents (
            <a
              href="https://btcnodes.io"
              target="_blank"
              rel="noreferrer"
              className="text-slate-300 underline decoration-slate-600 hover:text-[#f7931a]"
            >
              btcnodes.io
            </a>
            ) matched against official{" "}
            <a
              href="https://bitcoincore.org/en/security-advisories/"
              target="_blank"
              rel="noreferrer"
              className="text-slate-300 underline decoration-slate-600 hover:text-[#f7931a]"
            >
              bitcoincore.org
            </a>{" "}
            security advisories.
          </p>
        </div>

        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-700 bg-[#11151b] px-3.5 py-2 text-xs font-mono text-slate-200 transition hover:border-[#f7931a]/60 hover:text-white disabled:opacity-50"
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${refreshing ? "animate-spin text-[#f7931a]" : ""}`}
          />
          {refreshing ? "Fetching Live Census..." : "Refresh Live Census"}
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-xs font-mono text-red-300">
          Upstream refresh error: {error}
        </div>
      )}

      {radar.warnings.length > 0 && (
        <div className="rounded-lg border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-xs text-amber-200">
          {radar.warnings.join(" ")}
        </div>
      )}

      {/* KPI Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-800 bg-[#11151b]/90 p-5">
          <div className="flex items-center justify-between text-xs font-mono uppercase tracking-wider text-slate-400">
            <span>Reachable Nodes</span>
            <Activity className="h-4 w-4 text-[#f7931a]" />
          </div>
          <div className="mt-2 font-mono text-3xl font-bold text-white">
            {btc.totalReachableNodes.toLocaleString()}
          </div>
          <div className="mt-1 text-xs text-slate-400">
            {btc.parsedCoreNodes.toLocaleString()} Satoshi/Knots parsed ·{" "}
            {btc.knotsNodes.toLocaleString()} Knots
          </div>
        </div>

        <div className="rounded-xl border border-red-500/30 bg-[#11151b]/90 p-5">
          <div className="flex items-center justify-between text-xs font-mono uppercase tracking-wider text-red-300">
            <span>Exposed to ≥1 CVE</span>
            <ShieldAlert className="h-4 w-4 text-red-400" />
          </div>
          <div className="mt-2 font-mono text-3xl font-bold text-red-300">
            {btc.vulnerableAnyCvePct}%
          </div>
          <div className="mt-1 text-xs text-slate-400">
            {btc.vulnerableAnyCveNodes.toLocaleString()} nodes ·{" "}
            <span className="text-orange-300">
              {btc.vulnerableHighCriticalNodes.toLocaleString()} High/Crit
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-amber-500/30 bg-[#11151b]/90 p-5">
          <div className="flex items-center justify-between text-xs font-mono uppercase tracking-wider text-amber-300">
            <span>EOL Branches (≤29.x)</span>
            <AlertTriangle className="h-4 w-4 text-amber-400" />
          </div>
          <div className="mt-2 font-mono text-3xl font-bold text-amber-300">
            {btc.eolBranchPct}%
          </div>
          <div className="mt-1 text-xs text-slate-400">
            {btc.eolBranchNodes.toLocaleString()} nodes receive no security backports
          </div>
        </div>

        <div className="rounded-xl border border-emerald-500/25 bg-[#11151b]/90 p-5">
          <div className="flex items-center justify-between text-xs font-mono uppercase tracking-wider text-emerald-300">
            <span>Fully Patched Core</span>
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="mt-2 font-mono text-3xl font-bold text-emerald-300">
            {btc.fullyPatchedPct}%
          </div>
          <div className="mt-1 text-xs text-slate-400">
            {btc.fullyPatchedNodes.toLocaleString()} nodes on 30.5+ / 31.3+ / 32.1+
          </div>
        </div>
      </div>

      {/* Lightning Live Strip */}
      {ln && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-800 bg-[#0e1218] px-5 py-3.5 text-xs">
          <div className="flex items-center gap-2 font-mono text-[#f7931a]">
            <Zap className="h-4 w-4" />
            <span>MAINNET LIGHTNING GRAPH (MEMPOOL.SPACE)</span>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-1 font-mono text-slate-300">
            <span>
              Nodes: <strong className="text-white">{ln.nodeCount.toLocaleString()}</strong>
            </span>
            <span>
              Channels: <strong className="text-white">{ln.channelCount.toLocaleString()}</strong>
            </span>
            <span>
              Capacity: <strong className="text-white">{ln.totalCapacityBtc.toLocaleString()} BTC</strong>
            </span>
            <span>
              Clearnet-Exposed:{" "}
              <strong className="text-amber-300">{ln.clearnetSharePct}%</strong>{" "}
              <span className="text-slate-500">
                ({(ln.clearnetNodes + ln.clearnetTorNodes).toLocaleString()} clearnet/hybrid vs{" "}
                {ln.torNodes.toLocaleString()} Tor-only)
              </span>
            </span>
          </div>
        </div>
      )}

      {/* Exposure by CVE + Branch Breakdown */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="rounded-xl border border-slate-800 bg-[#11151b]/90 p-5 lg:col-span-7">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="font-display text-base font-semibold text-white">
              Live Reachable Nodes Exposed by CVE
            </h3>
            <span className="font-mono text-xs text-slate-400">
              Snapshot:{" "}
              {radar.snapshotTimestamp
                ? new Date(radar.snapshotTimestamp * 1000).toUTCString().replace("GMT", "UTC")
                : "Live"}
            </span>
          </div>

          {radar.cveExposure.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">
              No live CVE exposure data available right now. Check upstream census connectivity.
            </p>
          ) : (
            <div className="mt-4 space-y-3.5">
              {radar.cveExposure.slice(0, 9).map((cve) => {
                const barWidth = Math.max(
                  3,
                  Math.round((cve.vulnerableNodes / maxCveNodes) * 100)
                );
                return (
                  <div key={cve.id} className="space-y-1.5">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase ${severityBadge(
                            cve.severity
                          )}`}
                        >
                          {cve.severity}
                        </span>
                        <a
                          href={cve.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 font-mono font-semibold text-white hover:text-[#f7931a]"
                        >
                          {cve.id}
                          <ExternalLink className="h-3 w-3 text-slate-500" />
                        </a>
                        {cve.discoveryTag && (
                          <span className="rounded bg-[#f7931a]/15 px-1.5 py-0.5 font-mono text-[10px] text-[#f7931a]">
                            {cve.discoveryTag}
                          </span>
                        )}
                      </div>
                      <div className="font-mono text-slate-200">
                        <strong>{cve.vulnerableNodes.toLocaleString()}</strong>{" "}
                        <span className="text-slate-400">({cve.vulnerablePct}%)</span>
                      </div>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800/90">
                      <div
                        className={`h-full rounded-full ${
                          cve.severity === "high" || cve.severity === "critical"
                            ? "bg-gradient-to-r from-orange-500 to-red-500"
                            : cve.severity === "medium"
                            ? "bg-gradient-to-r from-amber-500 to-orange-400"
                            : "bg-sky-500"
                        }`}
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                    <div className="flex flex-wrap justify-between gap-2 text-[11px] text-slate-400">
                      <span className="truncate">{cve.title}</span>
                      <span className="font-mono text-slate-500">
                        Fixed: {cve.fixedVersions.join(", ")}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-800 bg-[#11151b]/90 p-5 lg:col-span-5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="font-display text-base font-semibold text-white">
              Top Vulnerable Mainnet Versions
            </h3>
            <span className="font-mono text-xs text-slate-400">Live P2P User-Agents</span>
          </div>

          {radar.topVulnerableUserAgents.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">
              No vulnerable user-agents reported in current snapshot.
            </p>
          ) : (
            <div className="mt-3 divide-y divide-slate-800/80">
              {radar.topVulnerableUserAgents.slice(0, 9).map((row) => (
                <div
                  key={row.userAgent}
                  className="flex items-start justify-between gap-3 py-2.5 text-xs"
                >
                  <div className="min-w-0">
                    <div className="truncate font-mono text-slate-200" title={row.userAgent}>
                      {row.userAgent}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {row.isEol && (
                        <span className="rounded bg-red-500/15 px-1.5 py-0.5 font-mono text-[10px] text-red-300">
                          EOL
                        </span>
                      )}
                      {row.cveIds.slice(0, 3).map((id) => (
                        <span
                          key={id}
                          className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] text-slate-300"
                        >
                          {id}
                        </span>
                      ))}
                      {row.cveIds.length > 3 && (
                        <span className="font-mono text-[10px] text-slate-500">
                          +{row.cveIds.length - 3} more
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 text-right font-mono">
                    <div className="font-semibold text-white">
                      {row.nodes.toLocaleString()}
                    </div>
                    <div className="text-[11px] text-slate-500">{row.pct}%</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

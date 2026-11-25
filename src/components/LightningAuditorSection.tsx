"use client";

import { useState } from "react";
import {
  CheckCircle2,
  ExternalLink,
  Globe,
  Search,
  ShieldAlert,
  ShieldCheck,
  Zap,
} from "lucide-react";
import type {
  LightningPostureReport,
  LightningSearchHit,
} from "@/lib/lightning-posture";

const QUICK_MAINNET_NODES = [
  {
    alias: "ACINQ",
    pubkey:
      "03864ef025fde8fb587d989186ce6a4a186895ee44a926bfc370e2c366597a3f8f",
  },
  {
    alias: "Kraken 🐙⚡",
    pubkey:
      "02f1a8c87607f415c8f22c00593002775941dea48869ce23096af27b0cfdcc0b69",
  },
  {
    alias: "River Financial 1",
    pubkey:
      "03037dc08e9ac63b82581f79b662a4d0ceca8a8ca162b1af3551595b8f2d97b70a",
  },
];

export function LightningAuditorSection() {
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<LightningSearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [auditing, setAuditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<LightningPostureReport | null>(null);

  async function handleSearchOrAudit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;

    setError(null);
    if (/^(02|03)[0-9a-fA-F]{64}$/.test(trimmed)) {
      setSearchResults([]);
      await auditPubkey(trimmed);
      return;
    }

    setSearching(true);
    try {
      const res = await fetch(
        `/api/v1/lightning/search?q=${encodeURIComponent(trimmed)}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Search failed");
      setSearchResults(data.nodes ?? []);
      if ((data.nodes ?? []).length === 0) {
        setError(`No public mainnet Lightning nodes matched "${trimmed}".`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setSearching(false);
    }
  }

  async function auditPubkey(pubkey: string) {
    setAuditing(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/lightning/node/${encodeURIComponent(pubkey)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Audit failed (HTTP ${res.status})`);
      setReport(data as LightningPostureReport);
      setSearchResults([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Node posture audit failed.");
    } finally {
      setAuditing(false);
    }
  }

  return (
    <section id="lightning-audit" className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-[#11151b] px-3 py-1 text-xs font-mono text-slate-300">
            <Zap className="h-3.5 w-3.5 text-[#f7931a]" />
            LIVE MAINNET GOSSIP + OPEN CHANNELS
          </div>
          <h2 className="mt-2 font-display text-2xl font-bold tracking-tight text-white">
            Public Lightning Node Security Posture Auditor
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Inspect any public mainnet Lightning node for BOLT safety feature bits, clearnet/cloud ASN exposure, gossip staleness, and single-peer force-close blast radius.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {QUICK_MAINNET_NODES.map((n) => (
            <button
              key={n.pubkey}
              type="button"
              onClick={() => {
                setQuery(n.pubkey);
                void auditPubkey(n.pubkey);
              }}
              className="rounded-lg border border-slate-700 bg-[#11151b] px-2.5 py-1.5 font-mono text-xs text-slate-300 transition hover:border-[#f7931a]/60 hover:text-white"
            >
              Inspect {n.alias}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-[#11151b]/90 p-5">
        <form onSubmit={handleSearchOrAudit} className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search node alias (e.g. ACINQ, River, WalletOfSatoshi) or paste 66-char hex pubkey..."
              className="w-full rounded-lg border border-slate-700 bg-[#090b0e] py-2.5 pl-9 pr-3 font-mono text-xs text-white placeholder:text-slate-600 focus:border-[#f7931a] focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={searching || auditing}
            className="rounded-lg bg-[#f7931a] px-5 py-2.5 font-mono text-xs font-semibold text-black transition hover:bg-[#ff9f2e] disabled:opacity-50"
          >
            {auditing
              ? "Auditing Live Gossip..."
              : searching
              ? "Searching..."
              : "Audit Mainnet Node"}
          </button>
        </form>

        {error && (
          <div className="mt-3 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">
            {error}
          </div>
        )}

        {searchResults.length > 0 && (
          <div className="mt-4 divide-y divide-slate-800 rounded-lg border border-slate-800 bg-[#0b0e13]">
            {searchResults.map((hit) => (
              <button
                key={hit.publicKey}
                type="button"
                onClick={() => auditPubkey(hit.publicKey)}
                className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition hover:bg-slate-800/50"
              >
                <div className="min-w-0">
                  <div className="font-mono text-xs font-semibold text-white">
                    {hit.alias}
                  </div>
                  <div className="truncate font-mono text-[11px] text-slate-500">
                    {hit.publicKey}
                  </div>
                </div>
                <div className="shrink-0 text-right font-mono text-[11px] text-slate-300">
                  {hit.channels !== null ? `${hit.channels} ch` : "—"} ·{" "}
                  {hit.capacitySats !== null
                    ? `${(hit.capacitySats / 1e8).toFixed(2)} BTC`
                    : "—"}
                </div>
              </button>
            ))}
          </div>
        )}

        {report && (
          <div className="mt-6 space-y-5 border-t border-slate-800 pt-5">
            {/* Summary header */}
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: report.color }}
                  />
                  <h3 className="font-display text-xl font-bold text-white">
                    {report.alias}
                  </h3>
                  <a
                    href={report.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded border border-slate-700 px-2 py-0.5 font-mono text-[11px] text-slate-300 hover:border-[#f7931a] hover:text-[#f7931a]"
                  >
                    mempool.space <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                <div className="mt-1 break-all font-mono text-xs text-slate-500">
                  {report.publicKey}
                </div>
                <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 font-mono text-xs text-slate-300">
                  <span>
                    Transport: <strong className="text-white">{report.transport.mode}</strong>
                  </span>
                  <span>
                    ASN:{" "}
                    <strong className="text-white">
                      {report.transport.asOrganization ?? "None / Tor"}
                    </strong>
                  </span>
                  <span>
                    Sampled Channels:{" "}
                    <strong className="text-white">
                      {report.metrics.activeChannelsSampled}
                    </strong>
                  </span>
                  <span>
                    Top Peer Share:{" "}
                    <strong className="text-white">{report.metrics.topPeerSharePct}%</strong>
                  </span>
                  <span>
                    HHI: <strong className="text-white">{report.metrics.hhiConcentration}</strong>
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-xl border border-slate-700 bg-[#0b0e13] px-4 py-3 font-mono">
                <div className="text-right">
                  <div className="text-xs text-slate-400">Posture Score</div>
                  <div className="text-2xl font-bold text-white">
                    {report.score}
                    <span className="text-sm text-slate-500">/100</span>
                  </div>
                </div>
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-lg border text-xl font-bold ${
                    report.grade === "A" || report.grade === "B"
                      ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
                      : report.grade === "C"
                      ? "border-amber-500/40 bg-amber-500/15 text-amber-300"
                      : "border-red-500/40 bg-red-500/15 text-red-300"
                  }`}
                >
                  {report.grade}
                </div>
              </div>
            </div>

            {/* BOLT Feature Safety Grid */}
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-7">
              {[
                { label: "Data-Loss-Protect", ok: report.features.hasDataLossProtect },
                { label: "Static RemoteKey", ok: report.features.hasStaticRemoteKey },
                { label: "Zero-Fee Anchors", ok: report.features.hasZeroFeeAnchors },
                { label: "Route Blinding", ok: report.features.hasRouteBlinding },
                { label: "Onion Messages", ok: report.features.hasOnionMessages },
                { label: "Dual Funding", ok: report.features.hasDualFund },
                { label: "Wumbo Channels", ok: report.features.hasWumbo },
              ].map((feat) => (
                <div
                  key={feat.label}
                  className={`rounded-lg border px-2.5 py-2 text-center font-mono text-[11px] ${
                    feat.ok
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                      : "border-slate-800 bg-[#0b0e13] text-slate-500"
                  }`}
                >
                  <div className="truncate font-semibold">{feat.label}</div>
                  <div className="mt-0.5 text-[10px]">
                    {feat.ok ? "ENABLED" : "NOT SET"}
                  </div>
                </div>
              ))}
            </div>

            {/* 8 Deterministic Rule Checks + Top Peers */}
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
              <div className="space-y-2.5 lg:col-span-8">
                <h4 className="font-mono text-xs uppercase tracking-wider text-slate-400">
                  Transparent Posture Rules ({report.checks.length})
                </h4>
                {report.checks.map((c) => (
                  <div
                    key={c.id}
                    className="rounded-lg border border-slate-800 bg-[#0b0e13] p-3.5 text-xs"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2">
                        {c.status === "pass" ? (
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                        ) : c.status === "warn" ? (
                          <ShieldAlert className="h-4 w-4 shrink-0 text-amber-400" />
                        ) : (
                          <ShieldAlert className="h-4 w-4 shrink-0 text-red-400" />
                        )}
                        <span className="font-semibold text-white">{c.title}</span>
                      </div>
                      <span className="shrink-0 font-mono text-[11px] text-slate-400">
                        {c.earned}/{c.weight} pts
                      </span>
                    </div>
                    <p className="mt-1.5 pl-6 text-slate-300">{c.evidence}</p>
                    {c.status !== "pass" && (
                      <p className="mt-1 pl-6 text-[11px] text-slate-400">
                        Remediation: {c.remediation}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              <div className="space-y-2.5 lg:col-span-4">
                <h4 className="font-mono text-xs uppercase tracking-wider text-slate-400">
                  Top Channel Counterparties
                </h4>
                <div className="rounded-lg border border-slate-800 bg-[#0b0e13] p-3.5">
                  {report.topPeers.length === 0 ? (
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <Globe className="h-4 w-4" />
                      No open public channels sampled.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {report.topPeers.map((p) => (
                        <div key={p.publicKey} className="space-y-1 text-xs">
                          <div className="flex justify-between gap-2 font-mono">
                            <span className="truncate text-slate-200">{p.alias}</span>
                            <span className="shrink-0 text-slate-300">{p.sharePct}%</span>
                          </div>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                            <div
                              className="h-full rounded-full bg-[#f7931a]"
                              style={{ width: `${Math.max(4, Math.min(100, p.sharePct))}%` }}
                            />
                          </div>
                          <div className="flex justify-between font-mono text-[10px] text-slate-500">
                            <span>{(p.capacitySats / 1e8).toFixed(2)} BTC</span>
                            <span>
                              {p.channelCount} ch
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-lg border border-slate-800 bg-[#0b0e13] p-3.5 text-xs text-slate-400">
                  <div className="flex items-center gap-1.5 font-mono text-slate-200">
                    <ShieldCheck className="h-3.5 w-3.5 text-[#f7931a]" />
                    Deep Fleet API
                  </div>
                  <p className="mt-1 text-[11px]">
                    Programmatic batch monitoring across up to 50 nodes is available via{" "}
                    <code className="font-mono text-slate-300">POST /api/v1/audit/fleet</code>{" "}
                    (L402 Lightning pay-per-call) or via our MCP endpoint{" "}
                    <code className="font-mono text-slate-300">/api/mcp</code>.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

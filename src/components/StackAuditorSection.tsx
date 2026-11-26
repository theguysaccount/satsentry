"use client";

import { useState } from "react";
import {
  CheckCircle2,
  ExternalLink,
  FileJson,
  Layers,
  Plus,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import type { StackAuditReport } from "@/lib/audit-engine";
import type { SoftwareId } from "@/lib/version";

interface RowInput {
  id: string;
  software: SoftwareId;
  version: string;
}

const SOFTWARE_OPTIONS: Array<{ id: SoftwareId; label: string; placeholder: string }> = [
  { id: "bitcoin-core", label: "Bitcoin Core", placeholder: "e.g. 31.2.0 or 32.1.0" },
  { id: "core-lightning", label: "Core Lightning (CLN)", placeholder: "e.g. 26.06.8 or 26.06.10" },
  { id: "lnd", label: "LND", placeholder: "e.g. 0.20.6-beta or 0.21.8-beta" },
  { id: "ldk", label: "LDK (rust-lightning)", placeholder: "e.g. 0.2.6 or 0.2.8" },
  { id: "eclair", label: "Eclair", placeholder: "e.g. 0.14.4 or 0.14.6" },
  { id: "btcpay", label: "BTCPay Server", placeholder: "e.g. 2.4.4 or 2.4.7" },
  { id: "lnbits", label: "LNbits", placeholder: "e.g. 1.6.2 or 1.7.1" },
];

export function StackAuditorSection() {
  const [mode, setMode] = useState<"versions" | "cli-json">("versions");
  const [rows, setRows] = useState<RowInput[]>([
    { id: "r1", software: "bitcoin-core", version: "" },
    { id: "r2", software: "lnd", version: "" },
  ]);
  const [cliJson, setCliJson] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<StackAuditReport | null>(null);

  function addRow() {
    if (rows.length >= 8) return;
    setRows((prev) => [
      ...prev,
      { id: `r-${Date.now()}`, software: "core-lightning", version: "" },
    ]);
  }

  function removeRow(id: string) {
    setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.id !== id) : prev));
  }

  function updateRow(id: string, patch: Partial<RowInput>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  async function runAudit(
    overridePayload?: { components?: Array<{ software: SoftwareId; version: string }>; cliJson?: string }
  ) {
    setLoading(true);
    setError(null);
    try {
      const payload =
        overridePayload ??
        (mode === "versions"
          ? {
              components: rows
                .filter((r) => r.version.trim().length > 0)
                .map((r) => ({ software: r.software, version: r.version.trim() })),
            }
          : { cliJson });

      const res = await fetch("/api/v1/audit/stack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Audit failed (HTTP ${res.status})`);
      }
      setReport(data as StackAuditReport);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to run audit.");
    } finally {
      setLoading(false);
    }
  }

  function loadTestPreset(kind: "vulnerable" | "patched") {
    setMode("versions");
    const next: RowInput[] =
      kind === "vulnerable"
        ? [
            { id: "p1", software: "bitcoin-core", version: "31.2.0" },
            { id: "p2", software: "ldk", version: "0.2.6" },
            { id: "p3", software: "core-lightning", version: "26.06.8" },
            { id: "p4", software: "lnbits", version: "1.6.2" },
          ]
        : [
            { id: "p1", software: "bitcoin-core", version: "32.1.0" },
            { id: "p2", software: "ldk", version: "0.2.8" },
            { id: "p3", software: "lnd", version: "0.21.8-beta" },
            { id: "p4", software: "btcpay", version: "2.4.7" },
          ];
    setRows(next);
    void runAudit({
      components: next.map((r) => ({ software: r.software, version: r.version })),
    });
  }

  async function downloadSarif() {
    if (!report) return;
    const payload = {
      components: report.components.map((c) => ({
        software: c.software,
        version: c.parsedVersion ?? c.inputVersion,
      })),
    };
    const res = await fetch("/api/v1/audit/stack?format=sarif", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return;
    const sarif = await res.json();
    const blob = new Blob([JSON.stringify(sarif, null, 2)], {
      type: "application/sarif+json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "satsentry-audit.sarif";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section id="stack-audit" className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-[#11151b] px-3 py-1 text-xs font-mono text-slate-300">
            <Layers className="h-3.5 w-3.5 text-[#f7931a]" />
            READ-ONLY · NO KEYS · NO CREDENTIALS
          </div>
          <h2 className="mt-2 font-display text-2xl font-bold tracking-tight text-white">
            Node &amp; Stack CVE Auditor
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Enter your software versions or paste raw output from{" "}
            <code className="font-mono text-xs text-slate-300">bitcoin-cli getnetworkinfo</code>,{" "}
            <code className="font-mono text-xs text-slate-300">lncli getinfo</code>, or{" "}
            <code className="font-mono text-xs text-slate-300">lightning-cli getinfo</code>.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => loadTestPreset("vulnerable")}
            className="rounded-lg border border-orange-500/35 bg-orange-500/10 px-3 py-1.5 font-mono text-xs text-orange-300 transition hover:bg-orange-500/20"
          >
            Test Unpatched Stack
          </button>
          <button
            type="button"
            onClick={() => loadTestPreset("patched")}
            className="rounded-lg border border-emerald-500/35 bg-emerald-500/10 px-3 py-1.5 font-mono text-xs text-emerald-300 transition hover:bg-emerald-500/20"
          >
            Test Current Baseline
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Input panel */}
        <div className="rounded-xl border border-slate-800 bg-[#11151b]/90 p-5 lg:col-span-5">
          <div className="flex gap-2 border-b border-slate-800 pb-3">
            <button
              type="button"
              onClick={() => setMode("versions")}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-mono text-xs transition ${
                mode === "versions"
                  ? "bg-[#f7931a] font-semibold text-black"
                  : "bg-slate-900 text-slate-300 hover:text-white"
              }`}
            >
              <Layers className="h-3.5 w-3.5" />
              Version Inputs
            </button>
            <button
              type="button"
              onClick={() => setMode("cli-json")}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-mono text-xs transition ${
                mode === "cli-json"
                  ? "bg-[#f7931a] font-semibold text-black"
                  : "bg-slate-900 text-slate-300 hover:text-white"
              }`}
            >
              <FileJson className="h-3.5 w-3.5" />
              Paste CLI JSON
            </button>
          </div>

          {mode === "versions" ? (
            <div className="mt-4 space-y-3">
              {rows.map((row) => {
                const placeholder =
                  SOFTWARE_OPTIONS.find((s) => s.id === row.software)?.placeholder ?? "";
                return (
                  <div key={row.id} className="flex items-center gap-2">
                    <select
                      aria-label="Software"
                      value={row.software}
                      onChange={(e) =>
                        updateRow(row.id, { software: e.target.value as SoftwareId })
                      }
                      className="w-44 rounded-lg border border-slate-700 bg-[#090b0e] px-2.5 py-2 text-xs text-slate-100 focus:border-[#f7931a] focus:outline-none"
                    >
                      {SOFTWARE_OPTIONS.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={row.version}
                      onChange={(e) => updateRow(row.id, { version: e.target.value })}
                      placeholder={placeholder}
                      className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-[#090b0e] px-3 py-2 font-mono text-xs text-white placeholder:text-slate-600 focus:border-[#f7931a] focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => removeRow(row.id)}
                      aria-label="Remove component"
                      className="rounded-lg border border-slate-800 p-2 text-slate-500 transition hover:border-red-500/40 hover:text-red-400"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}

              <button
                type="button"
                onClick={addRow}
                className="inline-flex items-center gap-1.5 text-xs font-mono text-slate-400 hover:text-[#f7931a]"
              >
                <Plus className="h-3.5 w-3.5" />
                Add software layer
              </button>
            </div>
          ) : (
            <div className="mt-4">
              <textarea
                rows={7}
                value={cliJson}
                onChange={(e) => setCliJson(e.target.value)}
                placeholder={'{\n  "subversion": "/Satoshi:31.2.0/"\n}'}
                className="w-full rounded-lg border border-slate-700 bg-[#090b0e] p-3 font-mono text-xs text-white placeholder:text-slate-600 focus:border-[#f7931a] focus:outline-none"
              />
              <p className="mt-1.5 text-[11px] text-slate-500">
                Supports single objects or JSON arrays combining Bitcoin Core, LND, and Core Lightning outputs. Never paste private keys or macaroons.
              </p>
            </div>
          )}

          {error && (
            <div className="mt-3 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={() => runAudit()}
            disabled={loading}
            className="mt-5 w-full rounded-lg bg-[#f7931a] px-4 py-2.5 font-mono text-xs font-semibold text-black transition hover:bg-[#ff9f2e] disabled:opacity-50"
          >
            {loading ? "Auditing Stack..." : "Run CVE & Lifecycle Audit"}
          </button>
        </div>

        {/* Report Output */}
        <div className="rounded-xl border border-slate-800 bg-[#11151b]/90 p-5 lg:col-span-7">
          {!report ? (
            <div className="flex h-full min-h-[260px] flex-col items-center justify-center text-center">
              <ShieldAlert className="h-9 w-9 text-slate-600" />
              <h3 className="mt-3 font-display text-base font-semibold text-slate-200">
                No audit run yet
              </h3>
              <p className="mt-1 max-w-md text-xs text-slate-400">
                Enter your actual Bitcoin Core, Lightning, BTCPay, or LNbits versions on the left—or click a quick version-check preset above—to match against all 29 verified advisories.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
                <div>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-xs uppercase ${
                      report.overallStatus === "pass"
                        ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
                        : report.overallStatus === "warn"
                        ? "border-amber-500/40 bg-amber-500/15 text-amber-300"
                        : "border-red-500/40 bg-red-500/15 text-red-300"
                    }`}
                  >
                    {report.overallStatus === "pass" ? (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    ) : (
                      <ShieldAlert className="h-3.5 w-3.5" />
                    )}
                    STATUS: {report.overallStatus.toUpperCase()}
                  </span>
                  <p className="mt-1.5 text-xs text-slate-400">
                    {report.totalFindings} advisory match
                    {report.totalFindings === 1 ? "" : "es"} across{" "}
                    {report.components.length} component
                    {report.components.length === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={downloadSarif}
                    className="rounded-lg border border-slate-700 bg-[#0b0e13] px-3 py-1.5 font-mono text-[11px] text-slate-300 transition hover:border-[#f7931a]/60 hover:text-white"
                  >
                    Export SARIF 2.1
                  </button>
                  <div className="text-right font-mono">
                    <div className="text-2xl font-bold text-white">
                      {report.overallScore}
                      <span className="text-sm text-slate-500">/100</span>
                    </div>
                    <div className="text-[11px] text-slate-500">Deterministic Stack Score</div>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                {report.components.map((comp, idx) => (
                  <div
                    key={`${comp.software}-${idx}`}
                    className="rounded-lg border border-slate-800 bg-[#0b0e13] p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="font-mono text-sm font-semibold text-white">
                        {comp.softwareName}{" "}
                        <span className="text-[#f7931a]">
                          {comp.parsedVersion ?? comp.inputVersion}
                        </span>
                      </div>
                      <span
                        className={`rounded px-2 py-0.5 font-mono text-[11px] uppercase ${
                          comp.status === "secure"
                            ? "bg-emerald-500/15 text-emerald-300"
                            : comp.status === "eol"
                            ? "bg-amber-500/15 text-amber-300"
                            : "bg-red-500/15 text-red-300"
                        }`}
                      >
                        {comp.status === "secure"
                          ? "Patched"
                          : `${comp.findings.length} Advisory Match${comp.findings.length === 1 ? "" : "es"}`}
                      </span>
                    </div>

                    {comp.lifecycle && (
                      <p className="mt-1.5 text-xs text-slate-400">
                        {comp.lifecycle.note}{" "}
                        <span className="font-mono text-slate-300">
                          Recommended: {comp.lifecycle.latestRecommended}
                        </span>
                      </p>
                    )}

                    {comp.findings.length > 0 && (
                      <div className="mt-3 space-y-2 border-t border-slate-800/80 pt-3">
                        {comp.findings.map((f) => (
                          <div key={f.id} className="text-xs">
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={`rounded px-1.5 py-0.5 font-mono text-[10px] uppercase ${
                                  f.severity === "critical"
                                    ? "bg-red-500/20 text-red-300"
                                    : f.severity === "high"
                                    ? "bg-orange-500/20 text-orange-300"
                                    : f.severity === "medium"
                                    ? "bg-amber-500/20 text-amber-300"
                                    : "bg-sky-500/20 text-sky-300"
                                }`}
                              >
                                {f.severity}
                              </span>
                              <a
                                href={f.sourceUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 font-mono font-semibold text-white hover:text-[#f7931a]"
                              >
                                {f.id}
                                <ExternalLink className="h-3 w-3 text-slate-500" />
                              </a>
                              <span className="text-slate-300">{f.title}</span>
                            </div>
                            <p className="mt-1 text-[11px] text-slate-400">
                              {f.remediation}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

"use client";

import { useState } from "react";
import {
  CheckCircle2,
  Cpu,
  KeyRound,
  Terminal,
  XCircle,
  Zap,
} from "lucide-react";
import type { L402BackendStatus } from "@/lib/l402";

interface TestVector {
  preimage: string;
  paymentHash: string;
  macaroon: string;
  authorizationHeader: string;
  scope: string;
  priceSats: number;
}

export function L402MonetizationSection({
  l402Status,
  fleetPriceSats,
  deepLightningPriceSats,
}: {
  l402Status: L402BackendStatus;
  fleetPriceSats: number;
  deepLightningPriceSats: number;
}) {
  const [vector, setVector] = useState<TestVector | null>(null);
  const [authInput, setAuthInput] = useState("");
  const [verifyOutput, setVerifyOutput] = useState<{
    valid: boolean;
    reason?: string;
    caveats?: Record<string, unknown>;
  } | null>(null);
  const [busy, setBusy] = useState(false);

  async function mintTestVector() {
    setBusy(true);
    setVerifyOutput(null);
    try {
      const res = await fetch("/api/v1/l402/verify?scope=audit:fleet");
      const data = await res.json();
      setVector(data);
      setAuthInput(data.authorizationHeader);
    } finally {
      setBusy(false);
    }
  }

  async function runVerification() {
    if (!authInput.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/v1/l402/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          authorizationHeader: authInput.trim(),
          expectedScope: "audit:fleet",
        }),
      });
      const data = await res.json();
      setVerifyOutput(data);
    } finally {
      setBusy(false);
    }
  }

  function tamperPreimage() {
    if (!authInput.includes(":")) return;
    const [left, preimage] = authInput.split(":");
    const flipped =
      (preimage[0] === "a" ? "b" : "a") + preimage.slice(1);
    setAuthInput(`${left}:${flipped}`);
    setVerifyOutput(null);
  }

  return (
    <section id="l402-api" className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-[#f7931a]/30 bg-[#f7931a]/10 px-3 py-1 text-xs font-mono text-[#f7931a]">
            <Zap className="h-3.5 w-3.5" />
            NON-CUSTODIAL L402 PAY-PER-CALL + MCP + CLI
          </div>
          <h2 className="mt-2 font-display text-2xl font-bold tracking-tight text-white">
            Lightning Monetization (HTTP 402), MCP Server &amp; Local CLI
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Zero accounts, zero API keys, zero custody. Autonomous agents, LSPs, and DevSecOps pipelines pay sats per batch fleet audit via L402 macaroons and SHA-256 preimage proofs.
          </p>
        </div>

        <div
          className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 font-mono text-xs ${
            l402Status.enforcingPayments
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
              : "border-amber-500/35 bg-amber-500/10 text-amber-200"
          }`}
        >
          <span
            className={`h-2 w-2 rounded-full ${
              l402Status.enforcingPayments ? "bg-emerald-400" : "bg-amber-400"
            }`}
          />
          {l402Status.enforcingPayments
            ? `L402 Receiver Active (${l402Status.provider})`
            : "L402 Receiver Unconfigured (Public Preview Mode)"}
        </div>
      </div>

      {/* Pricing & Protocol Matrix */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-slate-800 bg-[#11151b]/90 p-5">
          <div className="font-mono text-xs text-emerald-300">PUBLIC FOSS TIER · 0 SATS</div>
          <h3 className="mt-1 font-display text-lg font-bold text-white">
            Radar, Single Audits &amp; Local CLI
          </h3>
          <ul className="mt-3 space-y-1.5 text-xs text-slate-400">
            <li>• <code className="font-mono text-slate-300">GET /api/v1/radar</code> — Live 21,500+ node CVE census</li>
            <li>• <code className="font-mono text-slate-300">GET /api/v1/advisories</code> — Verified CVE feed</li>
            <li>• <code className="font-mono text-slate-300">POST /api/v1/audit/stack</code> — Single node audit</li>
            <li>• Local zero-dependency CLI &amp; port exposure scanner (MIT)</li>
          </ul>
        </div>

        <div className="rounded-xl border border-[#f7931a]/35 bg-[#11151b]/90 p-5">
          <div className="font-mono text-xs text-[#f7931a]">
            L402 METERED API · {deepLightningPriceSats}–{fleetPriceSats} SATS/CALL
          </div>
          <h3 className="mt-1 font-display text-lg font-bold text-white">
            Batch Fleet &amp; Deep Lightning Audits
          </h3>
          <ul className="mt-3 space-y-1.5 text-xs text-slate-400">
            <li>
              • <code className="font-mono text-slate-300">POST /api/v1/audit/fleet</code> —{" "}
              <strong className="text-white">{fleetPriceSats} sats</strong> (up to 50 nodes + LN posture)
            </li>
            <li>
              • <code className="font-mono text-slate-300">GET /api/v1/lightning/node/:pk?deep=true</code> —{" "}
              <strong className="text-white">{deepLightningPriceSats} sats</strong>
            </li>
            <li>• Machine-discoverable at <code className="font-mono text-slate-300">/.well-known/l402.json</code></li>
            <li>• Pluggable receiver: LNbits, LND REST, or Lightning Address (LNURL-pay)</li>
          </ul>
        </div>

        <div className="rounded-xl border border-slate-800 bg-[#11151b]/90 p-5">
          <div className="font-mono text-xs text-sky-300">AI AGENT PROTOCOL · MCP JSON-RPC</div>
          <h3 className="mt-1 font-display text-lg font-bold text-white">
            Streamable HTTP MCP Endpoint
          </h3>
          <ul className="mt-3 space-y-1.5 text-xs text-slate-400">
            <li>• Endpoint: <code className="font-mono text-slate-300">POST /api/mcp</code></li>
            <li>• Tools: <code className="font-mono text-slate-300">get_mainnet_cve_radar</code>, <code className="font-mono text-slate-300">audit_node_stack</code>, <code className="font-mono text-slate-300">audit_lightning_node</code>, <code className="font-mono text-slate-300">search_advisories</code></li>
            <li>• Ready for 402index.io, Satring, Claude, Cursor &amp; Codex ops agents</li>
          </ul>
        </div>
      </div>

      {/* Interactive L402 Cryptographic Verifier + CLI & MCP Snippets */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="rounded-xl border border-slate-800 bg-[#11151b]/90 p-5 lg:col-span-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-[#f7931a]" />
              <h3 className="font-display text-base font-semibold text-white">
                Interactive L402 Cryptographic Verifier
              </h3>
            </div>
            <span className="font-mono text-[11px] text-slate-500">
              HMAC-SHA256 + SHA-256 Preimage
            </span>
          </div>

          <p className="mt-3 text-xs text-slate-400">
            {l402Status.note} Use this cryptographic sandbox to verify SatSentry&apos;s stateless L402 macaroon signing and SHA-256 preimage validation end-to-end.
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={mintTestVector}
              disabled={busy}
              className="rounded-lg bg-[#f7931a] px-3.5 py-2 font-mono text-xs font-semibold text-black transition hover:bg-[#ff9f2e] disabled:opacity-50"
            >
              1. Generate Real Crypto Test Vector
            </button>
            <button
              type="button"
              onClick={runVerification}
              disabled={busy || !authInput}
              className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3.5 py-2 font-mono text-xs text-emerald-300 transition hover:bg-emerald-500/20 disabled:opacity-40"
            >
              2. Verify L402 Header
            </button>
            <button
              type="button"
              onClick={tamperPreimage}
              disabled={!authInput}
              className="rounded-lg border border-red-500/35 bg-red-500/10 px-3.5 py-2 font-mono text-xs text-red-300 transition hover:bg-red-500/20 disabled:opacity-40"
            >
              Tamper 1 Byte (Test Rejection)
            </button>
          </div>

          <div className="mt-4 space-y-2">
            <label className="block font-mono text-[11px] text-slate-400">
              Authorization Header (`L402 &lt;macaroon&gt;:&lt;preimage&gt;`)
            </label>
            <textarea
              rows={3}
              value={authInput}
              onChange={(e) => setAuthInput(e.target.value)}
              placeholder="Click 'Generate Real Crypto Test Vector' to mint a signed HMAC-SHA256 macaroon and matching 32-byte preimage..."
              className="w-full rounded-lg border border-slate-700 bg-[#090b0e] p-2.5 font-mono text-[11px] text-slate-200 placeholder:text-slate-600 focus:border-[#f7931a] focus:outline-none"
            />
          </div>

          {vector && (
            <div className="mt-3 rounded-lg border border-slate-800 bg-[#0b0e13] p-3 font-mono text-[11px] text-slate-400">
              <div className="truncate">
                <span className="text-slate-500">payment_hash:</span>{" "}
                <span className="text-slate-200">{vector.paymentHash}</span>
              </div>
              <div className="mt-1 truncate">
                <span className="text-slate-500">preimage:</span>{" "}
                <span className="text-slate-200">{vector.preimage}</span>
              </div>
            </div>
          )}

          {verifyOutput && (
            <div
              className={`mt-3 rounded-lg border p-3 font-mono text-xs ${
                verifyOutput.valid
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                  : "border-red-500/40 bg-red-500/10 text-red-200"
              }`}
            >
              <div className="flex items-center gap-2 font-semibold">
                {verifyOutput.valid ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    HTTP 200 — Cryptographic L402 Proof Valid
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4 text-red-400" />
                    HTTP 401 — Rejected: {verifyOutput.reason}
                  </>
                )}
              </div>
              {verifyOutput.caveats && (
                <pre className="mt-2 overflow-x-auto text-[11px] text-slate-300">
                  {JSON.stringify(verifyOutput.caveats, null, 2)}
                </pre>
              )}
            </div>
          )}
        </div>

        <div className="space-y-4 lg:col-span-6">
          <div className="rounded-xl border border-slate-800 bg-[#11151b]/90 p-5">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
              <Terminal className="h-4 w-4 text-[#f7931a]" />
              <h3 className="font-display text-base font-semibold text-white">
                Zero-Dependency Local CLI &amp; Port Exposure Scanner
              </h3>
            </div>
            <p className="mt-2.5 text-xs text-slate-400">
              Audit private nodes locally without sending versions or IPs to any external server. Catches exposed Bitcoin RPC (8332), LND gRPC/REST (10009/8080), and CLN REST (3010/9835).
            </p>
            <pre className="mt-3 overflow-x-auto rounded-lg border border-slate-800 bg-[#090b0e] p-3 font-mono text-[11px] text-slate-200">
{`# Auto-detect local bitcoin-cli / lncli / lightning-cli
node bin/satsentry.mjs audit

# Explicit version + host port exposure check for CI/CD (exits 2 on fail)
node bin/satsentry.mjs audit \\
  --bitcoin 31.2.0 --cln 26.06.8 --lnbits 1.6.2 \\
  --scan-host 127.0.0.1 --ci`}
            </pre>
          </div>

          <div className="rounded-xl border border-slate-800 bg-[#11151b]/90 p-5">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
              <Cpu className="h-4 w-4 text-[#f7931a]" />
              <h3 className="font-display text-base font-semibold text-white">
                Connect Autonomous AI Agents via MCP
              </h3>
            </div>
            <pre className="mt-3 overflow-x-auto rounded-lg border border-slate-800 bg-[#090b0e] p-3 font-mono text-[11px] text-slate-200">
{`curl -sS -X POST "$ORIGIN/api/mcp" \\
  -H "Content-Type: application/json" \\
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'`}
            </pre>
            <p className="mt-2 text-[11px] text-slate-500">
              Activate live sat settlement on your own deployment by setting{" "}
              <code className="font-mono text-slate-300">SATSENTRY_LNURL_ADDRESS</code>,{" "}
              <code className="font-mono text-slate-300">SATSENTRY_LNBITS_URL</code> +{" "}
              <code className="font-mono text-slate-300">SATSENTRY_LNBITS_KEY</code>, or{" "}
              <code className="font-mono text-slate-300">SATSENTRY_LND_REST_URL</code> +{" "}
              <code className="font-mono text-slate-300">SATSENTRY_LND_MACAROON</code>.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

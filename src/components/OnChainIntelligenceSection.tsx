"use client";

import { useState } from "react";
import {
  AtSign,
  CheckCircle2,
  Coins,
  ExternalLink,
  EyeOff,
  Gauge,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import type { Bip353ResolutionReport } from "@/lib/bip353";
import type { FeeOracleReport } from "@/lib/fee-oracle";
import type { TxPrivacyReport } from "@/lib/tx-privacy";
import type { UtxoHygieneReport } from "@/lib/utxo-hygiene";

type ToolTab = "tx-privacy" | "utxo" | "bip353" | "fees";

// Well-known real public Bitcoin mainnet references for 1-click live testing
const REAL_MAINNET_TX_PIZZA =
  "a1075db55d416d3ca199f55b6084e2115b9345e16c5cf302fc80e9d5fbf5d48d";
const REAL_MAINNET_BIP353 = "matt@mattcorallo.com";
const REAL_MAINNET_GENESIS_ADDR = "bc1qztwy6xen3zdtt7z0vrgapmjtfz8acjkfp5fp7l";

export function OnChainIntelligenceSection({
  initialFeeOracle,
}: {
  initialFeeOracle: FeeOracleReport;
}) {
  const [tab, setTab] = useState<ToolTab>("tx-privacy");

  const [txidInput, setTxidInput] = useState("");
  const [txReport, setTxReport] = useState<TxPrivacyReport | null>(null);
  const [txLoading, setTxLoading] = useState(false);
  const [txError, setTxError] = useState<string | null>(null);

  const [addrInput, setAddrInput] = useState("");
  const [utxoReport, setUtxoReport] = useState<UtxoHygieneReport | null>(null);
  const [utxoLoading, setUtxoLoading] = useState(false);
  const [utxoError, setUtxoError] = useState<string | null>(null);

  const [bip353Input, setBip353Input] = useState("");
  const [bip353Report, setBip353Report] = useState<Bip353ResolutionReport | null>(null);
  const [bip353Loading, setBip353Loading] = useState(false);
  const [bip353Error, setBip353Error] = useState<string | null>(null);

  const [feeOracle, setFeeOracle] = useState<FeeOracleReport>(initialFeeOracle);
  const [feeLoading, setFeeLoading] = useState(false);

  async function runTxAudit(txid: string) {
    const target = txid.trim();
    if (!target) return;
    setTxLoading(true);
    setTxError(null);
    try {
      const res = await fetch(`/api/v1/tools/tx-privacy?txid=${encodeURIComponent(target)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setTxReport(data as TxPrivacyReport);
    } catch (e) {
      setTxError(e instanceof Error ? e.message : "Transaction privacy audit failed.");
    } finally {
      setTxLoading(false);
    }
  }

  async function runUtxoAudit(addr: string) {
    const target = addr.trim();
    if (!target) return;
    setUtxoLoading(true);
    setUtxoError(null);
    try {
      const res = await fetch(`/api/v1/tools/utxo-hygiene?address=${encodeURIComponent(target)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setUtxoReport(data as UtxoHygieneReport);
    } catch (e) {
      setUtxoError(e instanceof Error ? e.message : "UTXO hygiene audit failed.");
    } finally {
      setUtxoLoading(false);
    }
  }

  async function runBip353(handle: string) {
    const target = handle.trim();
    if (!target) return;
    setBip353Loading(true);
    setBip353Error(null);
    try {
      const res = await fetch(`/api/v1/tools/bip353?handle=${encodeURIComponent(target)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setBip353Report(data as Bip353ResolutionReport);
    } catch (e) {
      setBip353Error(e instanceof Error ? e.message : "BIP-353 resolution failed.");
    } finally {
      setBip353Loading(false);
    }
  }

  async function refreshFees() {
    setFeeLoading(true);
    try {
      const res = await fetch("/api/v1/tools/fee-oracle");
      if (res.ok) setFeeOracle((await res.json()) as FeeOracleReport);
    } finally {
      setFeeLoading(false);
    }
  }

  return (
    <section id="onchain-intel" className="space-y-6">
      <div>
        <div className="inline-flex items-center gap-2 rounded-full border border-[#f7931a]/30 bg-[#f7931a]/10 px-3 py-1 text-xs font-mono text-[#f7931a]">
          <EyeOff className="h-3.5 w-3.5" />
          OPEN-SOURCE BASE-LAYER PRIVACY · UTXO · BIP-353 · FEE ORACLE
        </div>
        <h2 className="mt-2 font-display text-2xl font-bold tracking-tight text-white">
          Bitcoin On-Chain Privacy &amp; Network Intelligence Workbench
        </h2>
        <p className="mt-1 text-sm text-slate-400">
          Open-source Boltzmann transaction entropy auditor (OXT/KYCP successor), fee-spike UTXO dust stress-tester, DNSSEC BIP-353 resolver (BOLT 12 / Silent Payments / Ark), and live anchor-reserve fee oracle. Programmatic L402 APIs live at 10–25 sats/call.
        </p>
      </div>

      <div className="rounded-xl border border-slate-800 bg-[#11151b]/90 p-5">
        {/* Tabs */}
        <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-4">
          {[
            { id: "tx-privacy", label: "Boltzmann Tx Privacy", price: "25 sats L402", icon: EyeOff },
            { id: "utxo", label: "UTXO & Dust Hygiene", price: "25 sats L402", icon: Coins },
            { id: "bip353", label: "BIP-353 DNSSEC Resolver", price: "10 sats L402", icon: AtSign },
            { id: "fees", label: "Fee & Anchor Oracle", price: "10 sats L402", icon: Gauge },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id as ToolTab)}
                className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 font-mono text-xs transition ${
                  tab === item.id
                    ? "bg-[#f7931a] font-semibold text-black"
                    : "bg-slate-900 text-slate-300 hover:text-white"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {item.label}
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] ${
                    tab === item.id ? "bg-black/20 text-black" : "bg-slate-800 text-slate-400"
                  }`}
                >
                  {item.price}
                </span>
              </button>
            );
          })}
        </div>

        {/* TAB 1: BOLTZMANN TX PRIVACY */}
        {tab === "tx-privacy" && (
          <div className="mt-5 space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                type="text"
                value={txidInput}
                onChange={(e) => setTxidInput(e.target.value)}
                placeholder="Paste any 64-char mainnet Bitcoin txid..."
                className="flex-1 rounded-lg border border-slate-700 bg-[#090b0e] px-3 py-2.5 font-mono text-xs text-white placeholder:text-slate-600 focus:border-[#f7931a] focus:outline-none"
              />
              <button
                type="button"
                onClick={() => runTxAudit(txidInput)}
                disabled={txLoading}
                className="rounded-lg bg-[#f7931a] px-4 py-2.5 font-mono text-xs font-semibold text-black transition hover:bg-[#ff9f2e] disabled:opacity-50"
              >
                {txLoading ? "Computing Entropy..." : "Audit Tx Privacy"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setTxidInput(REAL_MAINNET_TX_PIZZA);
                  void runTxAudit(REAL_MAINNET_TX_PIZZA);
                }}
                className="rounded-lg border border-slate-700 bg-[#0b0e13] px-3 py-2.5 font-mono text-xs text-slate-300 hover:border-[#f7931a]/60 hover:text-white"
              >
                Test Real Mainnet Tx
              </button>
            </div>

            {txError && (
              <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                {txError}
              </div>
            )}

            {txReport && (
              <div className="space-y-4 border-t border-slate-800 pt-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 font-mono text-xs text-slate-300">
                      <a
                        href={txReport.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-white hover:text-[#f7931a]"
                      >
                        {txReport.txid.slice(0, 20)}...{txReport.txid.slice(-12)}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                      <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px]">
                        {txReport.summary.inputsCount} in → {txReport.summary.outputsCount} out
                      </span>
                      <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px]">
                        {txReport.summary.feeRateSatVb} sat/vB ({txReport.summary.vsize} vB)
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">{txReport.boltzmann.note}</p>
                  </div>
                  <div className="flex items-center gap-4 font-mono">
                    <div className="text-right">
                      <div className="text-[11px] text-slate-400">Boltzmann Entropy</div>
                      <div className="text-lg font-bold text-[#f7931a]">
                        {txReport.boltzmann.entropyBits !== null
                          ? `${txReport.boltzmann.entropyBits} bits`
                          : "N/A"}
                      </div>
                    </div>
                    <div className="rounded-lg border border-slate-700 bg-[#0b0e13] px-3 py-2 text-center">
                      <div className="text-[10px] text-slate-400">Privacy</div>
                      <div className="text-lg font-bold text-white">
                        {txReport.grade} ({txReport.privacyScore})
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
                  {txReport.heuristics.map((h) => (
                    <div
                      key={h.id}
                      className="rounded-lg border border-slate-800 bg-[#0b0e13] p-3 text-xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-1.5 font-semibold text-white">
                          {h.triggered ? (
                            <ShieldAlert className="h-3.5 w-3.5 text-amber-400" />
                          ) : (
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                          )}
                          {h.title}
                        </span>
                        <span className="font-mono text-[10px] uppercase text-slate-400">
                          {h.triggered ? `-${h.penalty} pts` : "clean"}
                        </span>
                      </div>
                      <p className="mt-1 text-slate-300">{h.evidence}</p>
                      {h.triggered && (
                        <p className="mt-1 text-[11px] text-slate-500">Fix: {h.remediation}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: UTXO HYGIENE */}
        {tab === "utxo" && (
          <div className="mt-5 space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                type="text"
                value={addrInput}
                onChange={(e) => setAddrInput(e.target.value)}
                placeholder="Paste any mainnet Bitcoin address (bc1p..., bc1q..., 1..., 3...)..."
                className="flex-1 rounded-lg border border-slate-700 bg-[#090b0e] px-3 py-2.5 font-mono text-xs text-white placeholder:text-slate-600 focus:border-[#f7931a] focus:outline-none"
              />
              <button
                type="button"
                onClick={() => runUtxoAudit(addrInput)}
                disabled={utxoLoading}
                className="rounded-lg bg-[#f7931a] px-4 py-2.5 font-mono text-xs font-semibold text-black transition hover:bg-[#ff9f2e] disabled:opacity-50"
              >
                {utxoLoading ? "Scanning UTXOs..." : "Audit UTXO Hygiene"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setAddrInput(REAL_MAINNET_GENESIS_ADDR);
                  void runUtxoAudit(REAL_MAINNET_GENESIS_ADDR);
                }}
                className="rounded-lg border border-slate-700 bg-[#0b0e13] px-3 py-2.5 font-mono text-xs text-slate-300 hover:border-[#f7931a]/60 hover:text-white"
              >
                Inspect Real bc1q Address
              </button>
            </div>

            {utxoError && (
              <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                {utxoError}
              </div>
            )}

            {utxoReport && (
              <div className="space-y-4 border-t border-slate-800 pt-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="space-y-1 text-xs">
                    <div className="font-mono text-white">
                      {utxoReport.address}{" "}
                      <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] uppercase text-[#f7931a]">
                        {utxoReport.scriptType} ({utxoReport.inputSpendVbytes} vB/input)
                      </span>
                    </div>
                    <div className="font-mono text-slate-300">
                      UTXOs: <strong>{utxoReport.metrics.utxoCount}</strong> · Confirmed:{" "}
                      <strong>{(utxoReport.metrics.confirmedBalanceSats / 1e8).toFixed(8)} BTC</strong>{" "}
                      · Reused:{" "}
                      <strong className={utxoReport.metrics.addressReused ? "text-amber-300" : "text-emerald-300"}>
                        {utxoReport.metrics.addressReused ? "YES" : "NO"}
                      </strong>
                    </div>
                    <p className="text-slate-400">{utxoReport.consolidation.verdict}</p>
                  </div>
                  <div className="rounded-lg border border-slate-700 bg-[#0b0e13] px-3.5 py-2 text-center font-mono">
                    <div className="text-[10px] text-slate-400">Hygiene</div>
                    <div className="text-lg font-bold text-white">
                      {utxoReport.grade} ({utxoReport.hygieneScore})
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-lg border border-slate-800">
                  <table className="w-full text-left font-mono text-xs">
                    <thead className="border-b border-slate-800 bg-[#0c1015] text-[10px] uppercase text-slate-400">
                      <tr>
                        <th className="px-3 py-2">Fee Regime</th>
                        <th className="px-3 py-2">Spend Cost / Input</th>
                        <th className="px-3 py-2">Uneconomic Dust UTXOs</th>
                        <th className="px-3 py-2">Trapped Dust Sats</th>
                        <th className="px-3 py-2">Full Sweep Fee</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/70">
                      {utxoReport.dustStressTest.map((row) => (
                        <tr key={row.feeRateSatVb}>
                          <td className="px-3 py-2 text-white">{row.feeRateSatVb} sat/vB</td>
                          <td className="px-3 py-2 text-slate-300">{row.spendCostPerInputSats.toLocaleString()} sats</td>
                          <td className="px-3 py-2 text-amber-300">{row.uneconomicUtxoCount}</td>
                          <td className="px-3 py-2 text-slate-300">{row.uneconomicSats.toLocaleString()} sats</td>
                          <td className="px-3 py-2 text-slate-300">{row.totalSweepFeeSats.toLocaleString()} sats</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: BIP-353 DNSSEC RESOLVER */}
        {tab === "bip353" && (
          <div className="mt-5 space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                type="text"
                value={bip353Input}
                onChange={(e) => setBip353Input(e.target.value)}
                placeholder="Enter human-readable BIP-353 address (e.g. matt@mattcorallo.com)..."
                className="flex-1 rounded-lg border border-slate-700 bg-[#090b0e] px-3 py-2.5 font-mono text-xs text-white placeholder:text-slate-600 focus:border-[#f7931a] focus:outline-none"
              />
              <button
                type="button"
                onClick={() => runBip353(bip353Input)}
                disabled={bip353Loading}
                className="rounded-lg bg-[#f7931a] px-4 py-2.5 font-mono text-xs font-semibold text-black transition hover:bg-[#ff9f2e] disabled:opacity-50"
              >
                {bip353Loading ? "Verifying DNSSEC..." : "Resolve BIP-353"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setBip353Input(REAL_MAINNET_BIP353);
                  void runBip353(REAL_MAINNET_BIP353);
                }}
                className="rounded-lg border border-slate-700 bg-[#0b0e13] px-3 py-2.5 font-mono text-xs text-slate-300 hover:border-[#f7931a]/60 hover:text-white"
              >
                Test matt@mattcorallo.com
              </button>
            </div>

            {bip353Error && (
              <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                {bip353Error}
              </div>
            )}

            {bip353Report && (
              <div className="space-y-3 rounded-lg border border-emerald-500/30 bg-[#0b0e13] p-4 font-mono text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-emerald-300">
                    <ShieldCheck className="h-4 w-4" />
                    <strong>DNSSEC AD=true VERIFIED</strong> · {bip353Report.dnsQueryName}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {bip353Report.capabilities.supportsOnChain && (
                      <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] text-white">On-Chain</span>
                    )}
                    {bip353Report.capabilities.supportsBolt12 && (
                      <span className="rounded bg-[#f7931a]/20 px-2 py-0.5 text-[10px] text-[#f7931a]">BOLT 12</span>
                    )}
                    {bip353Report.capabilities.supportsSilentPayments && (
                      <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] text-emerald-300">Silent Payments</span>
                    )}
                    {bip353Report.capabilities.supportsArk && (
                      <span className="rounded bg-sky-500/20 px-2 py-0.5 text-[10px] text-sky-300">Ark</span>
                    )}
                  </div>
                </div>
                {bip353Report.parsed.onChainAddress && (
                  <div className="break-all text-slate-300">
                    <span className="text-slate-500">On-Chain:</span> {bip353Report.parsed.onChainAddress}
                  </div>
                )}
                {bip353Report.parsed.bolt12Offer && (
                  <div className="break-all text-slate-300">
                    <span className="text-slate-500">BOLT 12 Offer:</span> {bip353Report.parsed.bolt12Offer}
                  </div>
                )}
                {bip353Report.parsed.silentPaymentAddress && (
                  <div className="break-all text-slate-300">
                    <span className="text-slate-500">Silent Payment (BIP-352):</span>{" "}
                    {bip353Report.parsed.silentPaymentAddress}
                  </div>
                )}
                {bip353Report.parsed.arkAddress && (
                  <div className="break-all text-slate-300">
                    <span className="text-slate-500">Ark:</span> {bip353Report.parsed.arkAddress}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: LIVE FEE & ANCHOR RESERVE ORACLE */}
        {tab === "fees" && (
          <div className="mt-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="font-mono text-xs text-slate-300">
                Regime:{" "}
                <span className="rounded bg-emerald-500/15 px-2 py-0.5 uppercase text-emerald-300">
                  {feeOracle.regime}
                </span>{" "}
                · Tip:{" "}
                <strong className="text-white">
                  #{feeOracle.tipHeight?.toLocaleString() ?? "Live"}
                </strong>
                {feeOracle.mempool && (
                  <>
                    {" "}
                    · Mempool: <strong>{feeOracle.mempool.txCount.toLocaleString()} txs</strong> (
                    {feeOracle.mempool.vsizeMb} vMB)
                  </>
                )}
              </div>
              <button
                type="button"
                onClick={refreshFees}
                disabled={feeLoading}
                className="rounded-lg border border-slate-700 bg-[#0b0e13] px-3 py-1.5 font-mono text-xs text-slate-300 hover:border-[#f7931a]/60 hover:text-white"
              >
                {feeLoading ? "Refreshing..." : "Refresh Live Mempool"}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5 font-mono text-xs">
              {[
                { label: "Next Block", val: `${feeOracle.targetsSatVb.nextBlock} sat/vB` },
                { label: "30 Min", val: `${feeOracle.targetsSatVb.halfHour} sat/vB` },
                { label: "1 Hour", val: `${feeOracle.targetsSatVb.oneHour} sat/vB` },
                { label: "Economy", val: `${feeOracle.targetsSatVb.economy} sat/vB` },
                {
                  label: "LN Anchor Reserve",
                  val: `${feeOracle.lightningAnchorReserveAdvice.recommendedOnChainReserveSats.toLocaleString()} sats`,
                },
              ].map((c) => (
                <div key={c.label} className="rounded-lg border border-slate-800 bg-[#0b0e13] p-3">
                  <div className="text-[10px] uppercase text-slate-500">{c.label}</div>
                  <div className="mt-1 text-sm font-bold text-white">{c.val}</div>
                </div>
              ))}
            </div>

            <p className="rounded-lg border border-slate-800 bg-[#0b0e13] p-3 text-xs text-slate-300">
              {feeOracle.lightningAnchorReserveAdvice.note}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

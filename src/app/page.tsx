import { ArrowRight, ExternalLink, Github, Shield, Zap } from "lucide-react";
import { SECURITY_ADVISORIES } from "@/lib/advisories";
import { getLiveFeeOracle } from "@/lib/fee-oracle";
import { getL402BackendStatus, L402_PRICING } from "@/lib/l402";
import { getLiveMainnetRadar } from "@/lib/mainnet-radar";
import { getUpstreamReleases } from "@/lib/releases";
import { AdvisoryTableSection } from "@/components/AdvisoryTableSection";
import { L402MonetizationSection } from "@/components/L402MonetizationSection";
import { LightningAuditorSection } from "@/components/LightningAuditorSection";
import { MainnetRadarSection } from "@/components/MainnetRadarSection";
import { OnChainIntelligenceSection } from "@/components/OnChainIntelligenceSection";
import { StackAuditorSection } from "@/components/StackAuditorSection";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [radar, releases, feeOracle, l402Status] = await Promise.all([
    getLiveMainnetRadar(),
    getUpstreamReleases(),
    getLiveFeeOracle(),
    Promise.resolve(getL402BackendStatus()),
  ]);

  return (
    <div className="min-h-screen">
      {/* Top Status & Nav Bar */}
      <header className="sticky top-0 z-30 border-b border-slate-800/90 bg-[#090b0e]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#f7931a]/40 bg-[#f7931a]/15 text-[#f7931a]">
              <Shield className="h-4 w-4" />
            </div>
            <div>
              <span className="font-display text-base font-bold tracking-tight text-white">
                SatSentry
              </span>
              <span className="ml-2 rounded border border-slate-700 bg-slate-900 px-1.5 py-0.5 font-mono text-[10px] text-slate-300">
                MIT FOSS · L402
              </span>
            </div>
          </div>

          <nav className="hidden items-center gap-6 font-mono text-xs text-slate-400 md:flex">
            <a href="#radar" className="hover:text-white">
              Mainnet Radar
            </a>
            <a href="#stack-audit" className="hover:text-white">
              Stack Auditor
            </a>
            <a href="#lightning-audit" className="hover:text-white">
              Lightning Posture
            </a>
            <a href="#onchain-intel" className="hover:text-white">
              Privacy · UTXO · BIP-353
            </a>
            <a href="#l402-api" className="hover:text-white">
              L402 · MCP
            </a>
            <a href="#advisories" className="hover:text-white">
              CVEs ({SECURITY_ADVISORIES.length})
            </a>
          </nav>

          <div className="flex items-center gap-2.5 font-mono text-xs">
            {radar.tipHeight && (
              <span className="hidden rounded-md border border-slate-800 bg-[#11151b] px-2.5 py-1 text-slate-300 lg:inline-block">
                Tip <strong className="text-[#f7931a]">#{radar.tipHeight.toLocaleString()}</strong>
                {radar.recommendedFees
                  ? ` · ${radar.recommendedFees.fastestFee} sat/vB`
                  : ""}
              </span>
            )}
            <a
              href="https://github.com/theguysaccount/satsentry"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-[#11151b] px-3 py-1.5 text-slate-200 transition hover:border-[#f7931a]/60 hover:text-white"
            >
              <Github className="h-3.5 w-3.5" />
              GitHub
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-16 px-4 py-10 sm:px-6 sm:py-14">
        {/* Hero */}
        <section className="relative overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-br from-[#11161f] via-[#0d1016] to-[#0a0c10] p-6 sm:p-10">
          <div className="max-w-3xl space-y-4">
            <div className="inline-flex flex-wrap items-center gap-2 rounded-full border border-[#f7931a]/30 bg-[#f7931a]/10 px-3 py-1 font-mono text-xs text-[#f7931a]">
              <Zap className="h-3.5 w-3.5" />
              BITCOIN &amp; LIGHTNING NETWORK SECURITY DEFENSE
            </div>
            <h1 className="font-display text-3xl font-bold tracking-tight text-white sm:text-5xl sm:leading-[1.08]">
              Real-Time CVE Radar &amp; L402 Security Auditor for the Bitcoin Stack
            </h1>
            <p className="text-sm leading-relaxed text-slate-300 sm:text-base">
              AI code scanners (Project Loupe, OSS scanners) triggered a wave of 2026 disclosures across{" "}
              <strong className="text-white">
                Bitcoin Core, Core Lightning, LND, LDK, Eclair, BTCPay Server, and LNbits
              </strong>
              —yet operators had no unified, non-custodial CVE monitor. SatSentry combines live mainnet exposure telemetry, deterministic node &amp; Lightning posture audits, SARIF 2.1.0 CI exports, a zero-dependency local CLI &amp; watch daemon, an MCP server, and an{" "}
              <strong className="text-[#f7931a]">L402 Lightning pay-per-call API</strong>.
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <a
                href="#stack-audit"
                className="inline-flex items-center gap-2 rounded-lg bg-[#f7931a] px-4 py-2.5 font-mono text-xs font-semibold text-black transition hover:bg-[#ff9f2e]"
              >
                Audit Your Node Stack
                <ArrowRight className="h-3.5 w-3.5" />
              </a>
              <a
                href="#lightning-audit"
                className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-[#11151b] px-4 py-2.5 font-mono text-xs text-slate-200 transition hover:border-[#f7931a]/60 hover:text-white"
              >
                Inspect Lightning Pubkey
              </a>
              <a
                href="/.well-known/l402.json"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 px-3 py-2.5 font-mono text-xs text-slate-400 hover:border-slate-600 hover:text-slate-200"
              >
                /.well-known/l402.json
                <ExternalLink className="h-3 w-3" />
              </a>
              <a
                href="/api/openapi.json"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 px-3 py-2.5 font-mono text-xs text-slate-400 hover:border-slate-600 hover:text-slate-200"
              >
                OpenAPI 3.1
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        </section>

        {/* Live Mainnet CVE Radar */}
        <MainnetRadarSection initialRadar={radar} />

        {/* Live Upstream Release Baselines across 7 Bitcoin/Lightning Repos */}
        <section className="rounded-xl border border-slate-800 bg-[#11151b]/90 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div>
              <h2 className="font-display text-base font-semibold text-white">
                Live Upstream Patched Release Baselines (7 Core &amp; Lightning Stacks)
              </h2>
              <p className="text-xs text-slate-400">
                Tracked directly from official upstream GitHub releases &amp; tags ·{" "}
                <a
                  href="/api/v1/releases"
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-slate-300 underline hover:text-[#f7931a]"
                >
                  /api/v1/releases
                </a>
              </p>
            </div>
            <a
              href="/api/v1/badge?type=mainnet"
              target="_blank"
              rel="noreferrer"
              title="Live embeddable SVG badge"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/api/v1/badge?type=mainnet"
                alt="SatSentry live mainnet CVE exposure badge"
                className="h-5"
              />
            </a>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            {releases.map((rel) => (
              <a
                key={rel.software}
                href={rel.releaseUrl}
                target="_blank"
                rel="noreferrer"
                className="group rounded-lg border border-slate-800 bg-[#0b0e13] p-3 transition hover:border-[#f7931a]/50"
              >
                <div className="truncate font-mono text-[11px] text-slate-400 group-hover:text-slate-200">
                  {rel.name}
                </div>
                <div className="mt-1 font-mono text-sm font-bold text-emerald-300">
                  {rel.latestUpstreamTag ?? `v${rel.baselineVersion}`}
                </div>
                <div className="mt-1 font-mono text-[10px] text-slate-500">
                  {rel.publishedAt ? rel.publishedAt.slice(0, 10) : rel.repo.split("/")[0]}
                </div>
              </a>
            ))}
          </div>
        </section>

        {/* Node & Stack Version Auditor */}
        <StackAuditorSection />

        {/* Live Lightning Node Posture Auditor */}
        <LightningAuditorSection />

        {/* On-Chain Privacy (Boltzmann), UTXO Hygiene, BIP-353 & Fee Oracle */}
        <OnChainIntelligenceSection initialFeeOracle={feeOracle} />

        {/* L402 Pay-Per-Call Monetization + MCP + CLI */}
        <L402MonetizationSection
          l402Status={l402Status}
          fleetPriceSats={L402_PRICING.fleetAuditSats}
          deepLightningPriceSats={L402_PRICING.deepLightningAuditSats}
        />

        {/* Primary-Source Verified Advisory Table */}
        <AdvisoryTableSection advisories={SECURITY_ADVISORIES} />
      </main>

      <footer className="mt-16 border-t border-slate-800/80 bg-[#07090c]">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-8 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <strong className="font-mono text-slate-300">SatSentry</strong> · Non-custodial,
            read-only Bitcoin &amp; Lightning security telemetry · MIT License.
            <div className="mt-1">
              Live data sources:{" "}
              <a
                href="https://btcnodes.io"
                target="_blank"
                rel="noreferrer"
                className="underline hover:text-slate-300"
              >
                btcnodes.io
              </a>
              ,{" "}
              <a
                href="https://mempool.space"
                target="_blank"
                rel="noreferrer"
                className="underline hover:text-slate-300"
              >
                mempool.space
              </a>
              ,{" "}
              <a
                href="https://bitcoincore.org/en/security-advisories/"
                target="_blank"
                rel="noreferrer"
                className="underline hover:text-slate-300"
              >
                bitcoincore.org
              </a>
              , and upstream GitHub advisories.
            </div>
          </div>
          <div className="flex flex-wrap gap-4 font-mono">
            <a href="/api/health" className="hover:text-slate-200">
              /api/health
            </a>
            <a href="/llms.txt" className="hover:text-slate-200">
              /llms.txt
            </a>
            <a href="/api/mcp" className="hover:text-slate-200">
              /api/mcp
            </a>
            <a href="/.well-known/l402.json" className="hover:text-slate-200">
              /.well-known/l402.json
            </a>
            <a
              href="https://github.com/theguysaccount/satsentry"
              target="_blank"
              rel="noreferrer"
              className="hover:text-slate-200"
            >
              Source (MIT)
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

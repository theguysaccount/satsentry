"use client";

import { useMemo, useState } from "react";
import { BookOpen, ExternalLink, Search } from "lucide-react";
import type { SecurityAdvisory, Severity } from "@/lib/advisories";
import type { SoftwareId } from "@/lib/version";

const SOFTWARE_FILTERS: Array<{ id: SoftwareId | "all"; label: string }> = [
  { id: "all", label: "All Stack" },
  { id: "bitcoin-core", label: "Bitcoin Core" },
  { id: "core-lightning", label: "Core Lightning" },
  { id: "lnd", label: "LND" },
  { id: "ldk", label: "LDK" },
  { id: "eclair", label: "Eclair" },
  { id: "btcpay", label: "BTCPay" },
  { id: "lnbits", label: "LNbits" },
];

export function AdvisoryTableSection({
  advisories,
}: {
  advisories: SecurityAdvisory[];
}) {
  const [software, setSoftware] = useState<SoftwareId | "all">("all");
  const [severity, setSeverity] = useState<Severity | "all">("all");
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return advisories.filter((a) => {
      if (software !== "all" && a.software !== software) return false;
      if (severity !== "all" && a.severity !== severity) return false;
      if (query) {
        const hay = `${a.id} ${a.cveId ?? ""} ${a.title} ${a.summary} ${a.softwareName} ${a.discoveryTag ?? ""}`.toLowerCase();
        if (!hay.includes(query)) return false;
      }
      return true;
    });
  }, [advisories, software, severity, q]);

  return (
    <section id="advisories" className="space-y-5">
      <div>
        <div className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-[#11151b] px-3 py-1 text-xs font-mono text-slate-300">
          <BookOpen className="h-3.5 w-3.5 text-[#f7931a]" />
          PRIMARY-SOURCE VERIFIED CATALOG ({advisories.length} ADVISORIES)
        </div>
        <h2 className="mt-2 font-display text-2xl font-bold tracking-tight text-white">
          Bitcoin &amp; Lightning Security Advisory Database
        </h2>
        <p className="mt-1 text-sm text-slate-400">
          Every record is verifiable against official upstream disclosures on bitcoincore.org or project GitHub Security Advisories &amp; Releases.
        </p>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-[#11151b]/90 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {SOFTWARE_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setSoftware(f.id)}
              className={`rounded-lg px-2.5 py-1 font-mono text-xs transition ${
                software === f.id
                  ? "bg-[#f7931a] font-semibold text-black"
                  : "bg-slate-900 text-slate-300 hover:text-white"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <select
            aria-label="Filter severity"
            value={severity}
            onChange={(e) => setSeverity(e.target.value as Severity | "all")}
            className="rounded-lg border border-slate-700 bg-[#090b0e] px-2.5 py-1.5 font-mono text-xs text-slate-200 focus:border-[#f7931a] focus:outline-none"
          >
            <option value="all">All Severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>

          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Filter CVE, Loupe, Tor..."
              className="w-48 rounded-lg border border-slate-700 bg-[#090b0e] py-1.5 pl-8 pr-2.5 font-mono text-xs text-white placeholder:text-slate-600 focus:border-[#f7931a] focus:outline-none"
            />
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-800 bg-[#11151b]/90">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-slate-800 bg-[#0c1015] font-mono text-[11px] uppercase text-slate-400">
            <tr>
              <th className="px-4 py-3">Advisory</th>
              <th className="px-4 py-3">Software</th>
              <th className="px-4 py-3">Severity</th>
              <th className="px-4 py-3">Disclosed</th>
              <th className="px-4 py-3">Affected / Fixed</th>
              <th className="px-4 py-3">Summary</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/80">
            {filtered.map((adv) => (
              <tr key={adv.id} className="hover:bg-slate-900/50">
                <td className="whitespace-nowrap px-4 py-3 font-mono font-semibold text-white">
                  <a
                    href={adv.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 hover:text-[#f7931a]"
                  >
                    {adv.id}
                    <ExternalLink className="h-3 w-3 text-slate-500" />
                  </a>
                  {adv.discoveryTag && (
                    <div className="mt-1 text-[10px] font-normal text-[#f7931a]">
                      {adv.discoveryTag}
                    </div>
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-3 font-mono text-slate-300">
                  {adv.softwareName}
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <span
                    className={`rounded border px-2 py-0.5 font-mono text-[10px] uppercase ${
                      adv.severity === "critical"
                        ? "border-red-500/40 bg-red-500/15 text-red-300"
                        : adv.severity === "high"
                        ? "border-orange-500/40 bg-orange-500/15 text-orange-300"
                        : adv.severity === "medium"
                        ? "border-amber-500/40 bg-amber-500/15 text-amber-300"
                        : "border-sky-500/40 bg-sky-500/15 text-sky-300"
                    }`}
                  >
                    {adv.severity}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-3 font-mono text-slate-400">
                  {adv.publishedDate}
                </td>
                <td className="px-4 py-3 font-mono text-[11px]">
                  <div className="text-slate-300">{adv.affectedSummary}</div>
                  <div className="text-emerald-400">
                    Fix: {adv.fixedVersions.join(", ")}
                  </div>
                </td>
                <td className="max-w-md px-4 py-3 text-slate-400">
                  <div className="font-medium text-slate-200">{adv.title}</div>
                  <div className="mt-0.5 text-[11px]">{adv.summary}</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

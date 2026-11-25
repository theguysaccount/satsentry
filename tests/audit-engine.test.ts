import { describe, expect, it } from "vitest";
import {
  auditComponent,
  auditStack,
  extractComponentsFromCliJson,
} from "../src/lib/audit-engine";
import { computeRadarFromCensus } from "../src/lib/mainnet-radar";

describe("CVE audit engine", () => {
  it("flags CVE-2026-117348 on Bitcoin Core 31.2.0 and clears 31.3.0 & 32.1.0", () => {
    const vuln = auditComponent({ software: "bitcoin-core", version: "31.2.0" });
    expect(vuln.findings.some((f) => f.id === "CVE-2026-117348")).toBe(true);
    expect(vuln.status).toBe("vulnerable");

    const patched31 = auditComponent({ software: "bitcoin-core", version: "31.3.0" });
    expect(patched31.findings).toHaveLength(0);
    expect(patched31.status).toBe("secure");

    const patched32 = auditComponent({ software: "bitcoin-core", version: "32.1.0" });
    expect(patched32.findings).toHaveLength(0);
    expect(patched32.status).toBe("secure");
  });

  it("flags High-severity CVE-2025-62861 and CVE-2024-52911 on Bitcoin Core 28.1.0", () => {
    const res = auditComponent({ software: "bitcoin-core", version: "/Satoshi:28.1.0/" });
    const ids = res.findings.map((f) => f.id);
    expect(ids).toContain("CVE-2025-62861");
    expect(ids).toContain("CVE-2024-52911");
    expect(res.lifecycle?.isEol).toBe(true);
  });

  it("detects critical LNbits & BTCPay advisories and clears latest baselines", () => {
    const report = auditStack([
      { software: "lnbits", version: "1.6.2" },
      { software: "btcpay", version: "2.4.1" },
      { software: "core-lightning", version: "26.06.8" },
      { software: "eclair", version: "0.14.4" },
    ]);
    expect(report.overallStatus).toBe("fail");
    expect(report.countsBySeverity.critical).toBeGreaterThanOrEqual(2);

    const clean = auditStack([
      { software: "bitcoin-core", version: "32.1.0" },
      { software: "core-lightning", version: "26.06.10" },
      { software: "lnd", version: "0.21.8-beta" },
      { software: "eclair", version: "0.14.6" },
      { software: "btcpay", version: "2.4.7" },
      { software: "lnbits", version: "1.7.1" },
    ]);
    expect(clean.overallStatus).toBe("pass");
    expect(clean.totalFindings).toBe(0);
    expect(clean.overallScore).toBe(100);
  });

  it("extracts Bitcoin Core, LND, and CLN versions from CLI getinfo JSON", () => {
    const raw = JSON.stringify([
      { subversion: "/Satoshi:31.2.0/" },
      { identity_pubkey: "02abcd", version: "0.20.6-beta commit=v0.20.6-beta", alias: "my-lnd" },
      { id: "03ef01", version: "v26.06.8", lightning_dir: "/root/.lightning" },
    ]);
    const extracted = extractComponentsFromCliJson(raw);
    expect(extracted).toHaveLength(3);
    expect(extracted[0]).toMatchObject({ software: "bitcoin-core", version: "31.2.0" });
    expect(extracted[1]).toMatchObject({ software: "lnd", version: "0.20.6-beta" });
    expect(extracted[2]).toMatchObject({ software: "core-lightning", version: "v26.06.8" });
  });

  it("computes accurate mainnet census percentages from user-agent counts", () => {
    const map = new Map<string, number>([
      ["/Satoshi:32.1.0/", 50],
      ["/Satoshi:31.2.0/", 30],
      ["/Satoshi:28.1.0/", 20],
    ]);
    const radar = computeRadarFromCensus(map, 100, 1795642629, 977579, null, null);
    expect(radar.bitcoinCensus.fullyPatchedNodes).toBe(50);
    expect(radar.bitcoinCensus.vulnerableAnyCveNodes).toBe(50);
    expect(radar.bitcoinCensus.eolBranchNodes).toBe(20);
    expect(radar.cveExposure.find((c) => c.id === "CVE-2026-117348")?.vulnerableNodes).toBe(30);
    expect(radar.cveExposure.find((c) => c.id === "CVE-2025-62861")?.vulnerableNodes).toBe(20);
  });
});

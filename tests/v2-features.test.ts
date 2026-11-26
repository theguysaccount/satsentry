import { describe, expect, it } from "vitest";
import { auditComponent, auditStack } from "../src/lib/audit-engine";
import { renderSvgBadge } from "../src/lib/badge";
import { stackReportToSarif } from "../src/lib/sarif";

describe("SatSentry v2 features (LDK, SARIF 2.1.0, SVG badges)", () => {
  it("flags critical Oct 2026 LDK funds-theft vulnerabilities on <0.2.7 and clears 0.2.8", () => {
    const vuln = auditComponent({ software: "ldk", version: "0.2.6" });
    expect(vuln.status).toBe("vulnerable");
    expect(vuln.highestSeverity).toBe("critical");
    const ids = vuln.findings.map((f) => f.id);
    expect(ids).toContain("LDK-2026-027-FUNDS-THEFT");
    expect(ids).toContain("LDK-2026-027-LSPS2-THEFT");
    expect(ids).toContain("LDK-2026-028-COOP-CLOSE");

    const v027 = auditComponent({ software: "ldk", version: "0.2.7" });
    expect(v027.findings.map((f) => f.id)).toEqual(["LDK-2026-028-COOP-CLOSE"]);

    const patched = auditComponent({ software: "ldk", version: "0.2.8" });
    expect(patched.status).toBe("secure");
    expect(patched.findings).toHaveLength(0);
  });

  it("exports valid SARIF 2.1.0 JSON for GitHub Code Scanning", () => {
    const report = auditStack([
      { software: "bitcoin-core", version: "31.2.0" },
      { software: "ldk", version: "0.2.6" },
    ]);
    const sarif = stackReportToSarif(report);
    expect(sarif.version).toBe("2.1.0");
    expect(sarif.runs).toHaveLength(1);
    expect(sarif.runs[0].tool.driver.name).toBe("SatSentry");
    expect(sarif.runs[0].results.length).toBeGreaterThanOrEqual(4);
    expect(
      sarif.runs[0].results.some((r) => r.ruleId === "LDK-2026-027-FUNDS-THEFT" && r.level === "error")
    ).toBe(true);
  });

  it("renders XML-escaped dynamic SVG badges safely", () => {
    const svg = renderSvgBadge("SatSentry", "Node <script>&'\"test", "#10b981");
    expect(svg).toContain("<svg ");
    expect(svg).not.toContain("<script>");
    expect(svg).toContain("&lt;script&gt;&amp;&apos;&quot;test");
  });
});

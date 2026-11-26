import type { StackAuditReport } from "./audit-engine";
import type { Severity } from "./advisories";

function toSarifLevel(severity: Severity): "error" | "warning" | "note" {
  switch (severity) {
    case "critical":
    case "high":
      return "error";
    case "medium":
      return "warning";
    case "low":
      return "note";
  }
}

function toSecurityScore(severity: Severity): string {
  switch (severity) {
    case "critical":
      return "9.5";
    case "high":
      return "8.0";
    case "medium":
      return "5.5";
    case "low":
      return "3.0";
  }
}

/**
 * Converts a SatSentry StackAuditReport into a spec-compliant SARIF 2.1.0 document
 * ready for upload to GitHub Code Scanning (`github/codeql-action/upload-sarif`).
 */
export function stackReportToSarif(report: StackAuditReport) {
  const rulesMap = new Map<
    string,
    {
      id: string;
      name: string;
      shortDescription: { text: string };
      fullDescription: { text: string };
      helpUri: string;
      properties: {
        tags: string[];
        "security-severity": string;
      };
    }
  >();

  const results: Array<{
    ruleId: string;
    level: "error" | "warning" | "note";
    message: { text: string };
    locations: Array<{
      physicalLocation: {
        artifactLocation: { uri: string };
      };
    }>;
  }> = [];

  for (const comp of report.components) {
    const artifactUri = `node-stack/${comp.software}@${comp.parsedVersion ?? comp.inputVersion}`;
    for (const f of comp.findings) {
      if (!rulesMap.has(f.id)) {
        rulesMap.set(f.id, {
          id: f.id,
          name: f.id.replace(/[^a-zA-Z0-9]/g, ""),
          shortDescription: { text: `${f.softwareName}: ${f.title}` },
          fullDescription: { text: `${f.summary} Remediation: ${f.remediation}` },
          helpUri: f.sourceUrl,
          properties: {
            tags: ["security", "bitcoin", f.software, f.severity],
            "security-severity": toSecurityScore(f.severity),
          },
        });
      }

      results.push({
        ruleId: f.id,
        level: toSarifLevel(f.severity),
        message: {
          text: `[${f.severity.toUpperCase()}] ${comp.softwareName} ${comp.parsedVersion ?? comp.inputVersion} is vulnerable to ${f.id}: ${f.title}. ${f.remediation}`,
        },
        locations: [
          {
            physicalLocation: {
              artifactLocation: { uri: artifactUri },
            },
          },
        ],
      });
    }
  }

  return {
    $schema: "https://json.schemastore.org/sarif-2.1.0.json",
    version: "2.1.0",
    runs: [
      {
        tool: {
          driver: {
            name: "SatSentry",
            version: "2.0.0",
            informationUri: "https://satsentry.vercel.app",
            rules: Array.from(rulesMap.values()),
          },
        },
        results,
      },
    ],
  };
}

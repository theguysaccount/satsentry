import { SECURITY_ADVISORIES, SOFTWARE_CATALOG, type SecurityAdvisory, type Severity } from "./advisories";
import {
  getLifecycleStatus,
  matchesAnyClause,
  parseBitcoinUserAgent,
  parseVersion,
  type LifecycleStatus,
  type SoftwareId,
} from "./version";

export interface ComponentInput {
  software: SoftwareId;
  version: string;
  label?: string;
}

export interface ComponentAuditResult {
  software: SoftwareId;
  softwareName: string;
  inputVersion: string;
  parsedVersion: string | null;
  label?: string;
  status: "secure" | "vulnerable" | "eol" | "unparseable";
  highestSeverity: Severity | "none";
  lifecycle: LifecycleStatus | null;
  findings: SecurityAdvisory[];
  score: number;
}

export interface StackAuditReport {
  auditedAt: string;
  overallStatus: "pass" | "warn" | "fail";
  overallScore: number;
  highestSeverity: Severity | "none";
  totalFindings: number;
  countsBySeverity: Record<Severity, number>;
  components: ComponentAuditResult[];
  recommendations: string[];
}

const SEVERITY_RANK: Record<Severity | "none", number> = {
  none: 0,
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

const SEVERITY_DEDUCTION: Record<Severity, number> = {
  critical: 45,
  high: 28,
  medium: 14,
  low: 5,
};

export function auditComponent(input: ComponentInput): ComponentAuditResult {
  const meta = SOFTWARE_CATALOG[input.software];
  let versionString = input.version.trim();

  // Support pasting raw Bitcoin P2P user agents like /Satoshi:31.2.0/
  if (input.software === "bitcoin-core" && versionString.includes("/Satoshi:")) {
    const ua = parseBitcoinUserAgent(versionString);
    if (ua.version) {
      versionString = ua.version.normalized;
    }
  }

  const parsed = parseVersion(versionString);
  if (!parsed) {
    return {
      software: input.software,
      softwareName: meta.name,
      inputVersion: input.version,
      parsedVersion: null,
      label: input.label,
      status: "unparseable",
      highestSeverity: "none",
      lifecycle: null,
      findings: [],
      score: 0,
    };
  }

  const lifecycle = getLifecycleStatus(input.software, parsed);
  const findings = SECURITY_ADVISORIES.filter(
    (adv) =>
      adv.software === input.software &&
      matchesAnyClause(parsed, adv.affectedClauses)
  ).sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]);

  let highestSeverity: Severity | "none" = "none";
  let penalty = lifecycle.isEol ? 20 : 0;

  for (const f of findings) {
    if (SEVERITY_RANK[f.severity] > SEVERITY_RANK[highestSeverity]) {
      highestSeverity = f.severity;
    }
    penalty += SEVERITY_DEDUCTION[f.severity];
  }

  const score = Math.max(0, 100 - Math.min(100, penalty));
  const status: ComponentAuditResult["status"] =
    findings.length > 0 ? "vulnerable" : lifecycle.isEol ? "eol" : "secure";

  return {
    software: input.software,
    softwareName: meta.name,
    inputVersion: input.version,
    parsedVersion: parsed.normalized,
    label: input.label,
    status,
    highestSeverity,
    lifecycle,
    findings,
    score,
  };
}

export function auditStack(components: ComponentInput[]): StackAuditReport {
  const results = components.map(auditComponent);
  const countsBySeverity: Record<Severity, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  };

  let highestSeverity: Severity | "none" = "none";
  let totalFindings = 0;
  const recommendationSet = new Set<string>();

  for (const res of results) {
    for (const f of res.findings) {
      countsBySeverity[f.severity] += 1;
      totalFindings += 1;
      if (SEVERITY_RANK[f.severity] > SEVERITY_RANK[highestSeverity]) {
        highestSeverity = f.severity;
      }
      recommendationSet.add(
        `[${res.softwareName} ${res.parsedVersion ?? res.inputVersion}] ${f.id}: ${f.remediation}`
      );
    }
    if (res.lifecycle?.isEol && res.findings.length === 0) {
      recommendationSet.add(
        `[${res.softwareName} ${res.parsedVersion}] ${res.lifecycle.note} Upgrade to ${res.lifecycle.latestRecommended}.`
      );
    }
  }

  const validResults = results.filter((r) => r.status !== "unparseable");
  const overallScore =
    validResults.length === 0
      ? 0
      : Math.round(
          validResults.reduce((sum, r) => sum + r.score, 0) / validResults.length
        );

  let overallStatus: StackAuditReport["overallStatus"] = "pass";
  if (
    countsBySeverity.critical > 0 ||
    countsBySeverity.high > 0 ||
    countsBySeverity.medium > 0
  ) {
    overallStatus = "fail";
  } else if (
    countsBySeverity.low > 0 ||
    results.some((r) => r.lifecycle?.isEol || r.status === "unparseable")
  ) {
    overallStatus = "warn";
  }

  return {
    auditedAt: new Date().toISOString(),
    overallStatus,
    overallScore,
    highestSeverity,
    totalFindings,
    countsBySeverity,
    components: results,
    recommendations: Array.from(recommendationSet),
  };
}

/**
 * Extracts Bitcoin Core / LND / Core Lightning version fields automatically
 * from pasted CLI JSON outputs:
 * - `bitcoin-cli getnetworkinfo` -> `{ subversion: "/Satoshi:31.2.0/" }`
 * - `lncli getinfo` -> `{ version: "0.20.6-beta commit=..." }`
 * - `lightning-cli getinfo` -> `{ version: "v26.06.8", alias: "..." }`
 */
export function extractComponentsFromCliJson(rawJson: string): ComponentInput[] {
  const parsed: unknown = JSON.parse(rawJson);
  const items = Array.isArray(parsed) ? parsed : [parsed];
  const detected: ComponentInput[] = [];

  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const obj = item as Record<string, unknown>;

    if (typeof obj.subversion === "string" && obj.subversion.includes("Satoshi")) {
      const ua = parseBitcoinUserAgent(obj.subversion);
      if (ua.version) {
        detected.push({
          software: "bitcoin-core",
          version: ua.version.normalized,
          label: ua.label,
        });
      }
      continue;
    }

    if (typeof obj.version === "string") {
      const ver = obj.version;
      // LND getinfo has identity_pubkey and commit= in version
      if (typeof obj.identity_pubkey === "string" || /commit=/i.test(ver)) {
        const clean = ver.split(/\s+/)[0];
        detected.push({
          software: "lnd",
          version: clean,
          label: typeof obj.alias === "string" ? obj.alias : undefined,
        });
        continue;
      }
      // Core Lightning getinfo has id + num_peers / color / alias
      if (
        typeof obj.id === "string" &&
        (typeof obj.lightning_dir === "string" ||
          typeof obj.network === "string" ||
          typeof obj.our_features === "object")
      ) {
        detected.push({
          software: "core-lightning",
          version: ver,
          label: typeof obj.alias === "string" ? obj.alias : undefined,
        });
        continue;
      }
    }
  }

  return detected;
}

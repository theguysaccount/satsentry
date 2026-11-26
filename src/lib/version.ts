export type SoftwareId =
  | "bitcoin-core"
  | "core-lightning"
  | "lnd"
  | "ldk"
  | "eclair"
  | "btcpay"
  | "lnbits";

export interface ParsedVersion {
  raw: string;
  major: number;
  minor: number;
  patch: number;
  build: number;
  prerelease: string | null;
  normalized: string;
}

export interface UserAgentInfo {
  raw: string;
  software: "bitcoin-core" | "bitcoin-knots" | "other";
  version: ParsedVersion | null;
  isKnots: boolean;
  label: string;
}

/**
 * Parses Bitcoin ecosystem version strings including:
 * - Bitcoin Core: "31.2.0", "v30.5", "0.21.1", "29.3.0"
 * - LND: "v0.21.8-beta", "0.18.0-beta.rc1"
 * - Core Lightning: "v26.06.10", "v26.12rc1", "25.02"
 * - Eclair / BTCPay / LNbits: "v0.14.6", "v2.4.7", "1.6.2-rc1"
 */
export function parseVersion(input: string): ParsedVersion | null {
  const cleaned = input.trim().replace(/^v/i, "");
  const match = cleaned.match(
    /^(\d+)\.(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:[-.]?([a-zA-Z0-9.]+))?/
  );
  if (!match) return null;

  const major = Number.parseInt(match[1], 10);
  const minor = Number.parseInt(match[2], 10);
  const patch = match[3] ? Number.parseInt(match[3], 10) : 0;
  const build = match[4] ? Number.parseInt(match[4], 10) : 0;
  const prerelease = match[5] ? match[5].toLowerCase() : null;

  if ([major, minor, patch, build].some((n) => Number.isNaN(n))) {
    return null;
  }

  const base = build > 0 ? `${major}.${minor}.${patch}.${build}` : `${major}.${minor}.${patch}`;
  return {
    raw: input.trim(),
    major,
    minor,
    patch,
    build,
    prerelease,
    normalized: prerelease ? `${base}-${prerelease}` : base,
  };
}

/**
 * Compares two parsed versions.
 * Note: For LND, "-beta" is the standard production release suffix (e.g. v0.21.8-beta),
 * whereas "rc" / "alpha" prereleases sort below final releases of the same tuple.
 */
export function compareVersions(a: ParsedVersion, b: ParsedVersion): number {
  if (a.major !== b.major) return a.major - b.major;
  if (a.minor !== b.minor) return a.minor - b.minor;
  if (a.patch !== b.patch) return a.patch - b.patch;
  if (a.build !== b.build) return a.build - b.build;

  const rankPre = (pre: string | null): number => {
    if (!pre || pre === "beta") return 3;
    if (pre.startsWith("beta.rc") || pre.startsWith("rc")) return 2;
    if (pre.startsWith("alpha") || pre.startsWith("dev")) return 1;
    return 2;
  };

  const ra = rankPre(a.prerelease);
  const rb = rankPre(b.prerelease);
  if (ra !== rb) return ra - rb;
  if (ra === 3 && rb === 3) return 0;
  if (a.prerelease === b.prerelease) return 0;
  return (a.prerelease ?? "").localeCompare(b.prerelease ?? "");
}

export interface VersionRangeClause {
  minInclusive?: string;
  minExclusive?: string;
  maxInclusive?: string;
  maxExclusive?: string;
}

export function matchesVersionClause(
  version: ParsedVersion,
  clause: VersionRangeClause
): boolean {
  if (clause.minInclusive) {
    const min = parseVersion(clause.minInclusive);
    if (min && compareVersions(version, min) < 0) return false;
  }
  if (clause.minExclusive) {
    const min = parseVersion(clause.minExclusive);
    if (min && compareVersions(version, min) <= 0) return false;
  }
  if (clause.maxInclusive) {
    const max = parseVersion(clause.maxInclusive);
    if (max && compareVersions(version, max) > 0) return false;
  }
  if (clause.maxExclusive) {
    const max = parseVersion(clause.maxExclusive);
    if (max && compareVersions(version, max) >= 0) return false;
  }
  return true;
}

export function matchesAnyClause(
  version: ParsedVersion,
  clauses: VersionRangeClause[]
): boolean {
  return clauses.some((clause) => matchesVersionClause(version, clause));
}

/**
 * Parses Bitcoin P2P user agent strings such as:
 * - /Satoshi:32.1.0/
 * - /Satoshi:29.3.0/Knots:20260507/
 * - /Satoshi:28.1.0(FutureBit-Apollo-Node)/
 * - /Satoshi:0.21.1/
 */
export function parseBitcoinUserAgent(ua: string): UserAgentInfo {
  const isKnots = /Knots:/i.test(ua);
  const satoshiMatch = ua.match(/\/Satoshi:([0-9]+(?:\.[0-9]+){1,3})/i);

  if (satoshiMatch) {
    const version = parseVersion(satoshiMatch[1]);
    return {
      raw: ua,
      software: isKnots ? "bitcoin-knots" : "bitcoin-core",
      version,
      isKnots,
      label: isKnots
        ? `Bitcoin Knots (Core ${satoshiMatch[1]})`
        : `Bitcoin Core ${satoshiMatch[1]}`,
    };
  }

  return {
    raw: ua,
    software: "other",
    version: null,
    isKnots: false,
    label: ua,
  };
}

export interface LifecycleStatus {
  isEol: boolean;
  latestRecommended: string;
  note: string;
}

/**
 * Evaluates official maintenance lifecycle as of November 2026.
 * Per Bitcoin Core lifecycle (bitcoincore.org/en/lifecycle/) and the
 * 2026-11-20 CVE-2026-117348 disclosure, Bitcoin Core 29.x and earlier are EOL.
 */
export function getLifecycleStatus(
  software: SoftwareId,
  version: ParsedVersion
): LifecycleStatus {
  switch (software) {
    case "bitcoin-core": {
      if (version.major < 30) {
        return {
          isEol: true,
          latestRecommended: "32.1.0 (or 31.3.0 / 30.5.0)",
          note:
            version.major === 29
              ? "Bitcoin Core 29.x reached End-of-Life and did not receive the CVE-2026-117348 fix."
              : `Bitcoin Core ${version.major}.x is End-of-Life and no longer receives security backports.`,
        };
      }
      const needsPatch =
        (version.major === 30 && version.minor < 5) ||
        (version.major === 31 && version.minor < 3) ||
        (version.major === 32 && version.minor < 1);
      return {
        isEol: false,
        latestRecommended: "32.1.0 (or 31.3.0 / 30.5.0)",
        note: needsPatch
          ? `Supported ${version.major}.x branch, but behind the latest November 2026 security patch release.`
          : `Supported and current on the ${version.major}.x security branch.`,
      };
    }
    case "core-lightning": {
      const target = parseVersion("26.06.10")!;
      const isOutdated = compareVersions(version, target) < 0;
      const isEol = version.major < 25;
      return {
        isEol,
        latestRecommended: "v26.06.10 (or v26.12rc1)",
        note: isOutdated
          ? "Behind v26.06.10 which bundles the Aug–Nov 2026 AI-reported vulnerability patches."
          : "Current on Core Lightning 26.06.10+ security baseline.",
      };
    }
    case "lnd": {
      const isEol = version.major === 0 && version.minor < 20;
      const target20 = parseVersion("0.20.8-beta")!;
      const target21 = parseVersion("0.21.8-beta")!;
      const current =
        (version.major === 0 && version.minor === 20 && compareVersions(version, target20) >= 0) ||
        (version.major === 0 && version.minor >= 21 && compareVersions(version, target21) >= 0);
      return {
        isEol,
        latestRecommended: "v0.21.8-beta (or v0.20.8-beta)",
        note: isEol
          ? `LND 0.${version.minor}.x is behind the active 0.20.x / 0.21.x maintenance branches.`
          : current
          ? "Current on LND 0.20.8-beta / 0.21.8-beta maintenance baseline."
          : "Behind the November 2026 LND point release.",
      };
    }
    case "ldk": {
      const target = parseVersion("0.2.8")!;
      const isEol = version.major === 0 && version.minor < 2;
      const isOutdated = compareVersions(version, target) < 0;
      return {
        isEol,
        latestRecommended: "v0.2.8 (or v0.3.0-beta1)",
        note: isOutdated
          ? "Behind LDK v0.2.8 which bundles critical Oct–Nov 2026 funds-theft (Project Loupe / LSPS2) and cooperative-close fixes."
          : "Current on LDK v0.2.8+ security baseline.",
      };
    }
    case "eclair": {
      const target = parseVersion("0.14.6")!;
      const isEol = version.major === 0 && version.minor < 14;
      const isOutdated = compareVersions(version, target) < 0;
      return {
        isEol,
        latestRecommended: "v0.14.6",
        note: isOutdated
          ? "Behind v0.14.6 which includes Project Loupe security hardening patches."
          : "Current on Eclair v0.14.6 security baseline.",
      };
    }
    case "btcpay": {
      const target = parseVersion("2.4.7")!;
      const isEol = version.major < 2;
      const isOutdated = compareVersions(version, target) < 0;
      return {
        isEol,
        latestRecommended: "v2.4.7",
        note: isOutdated
          ? "Behind v2.4.7 which patches actively exploited and OSS Scanner security issues."
          : "Current on BTCPay Server v2.4.7 security baseline.",
      };
    }
    case "lnbits": {
      const target = parseVersion("1.7.1")!;
      const isEol = version.major < 1;
      const isOutdated = compareVersions(version, target) < 0;
      return {
        isEol,
        latestRecommended: "v1.7.1",
        note: isOutdated
          ? "Behind v1.7.1 critical security update (auth key rotation + XSS/SSRF fixes)."
          : "Current on LNbits v1.7.1 security baseline.",
      };
    }
  }
}

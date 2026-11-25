import { describe, expect, it } from "vitest";
import {
  compareVersions,
  getLifecycleStatus,
  matchesAnyClause,
  parseBitcoinUserAgent,
  parseVersion,
} from "../src/lib/version";

describe("version parser and comparator", () => {
  it("parses Bitcoin Core, LND beta, CLN, and RC versions", () => {
    expect(parseVersion("v32.1.0")?.normalized).toBe("32.1.0");
    expect(parseVersion("v0.21.8-beta")?.normalized).toBe("0.21.8-beta");
    expect(parseVersion("v26.12rc1")?.normalized).toBe("26.12.0-rc1");
    expect(parseVersion("29.5")?.normalized).toBe("29.5.0");
  });

  it("ranks prerelease rc below final release while treating LND -beta as final", () => {
    const rc = parseVersion("1.6.2-rc1")!;
    const final = parseVersion("1.6.2")!;
    expect(compareVersions(rc, final)).toBeLessThan(0);

    const lndBeta = parseVersion("0.21.8-beta")!;
    const lndPlain = parseVersion("0.21.8")!;
    expect(compareVersions(lndBeta, lndPlain)).toBe(0);
  });

  it("parses Bitcoin Core and Knots P2P user agent strings", () => {
    const core = parseBitcoinUserAgent("/Satoshi:31.2.0/");
    expect(core.software).toBe("bitcoin-core");
    expect(core.version?.normalized).toBe("31.2.0");
    expect(core.isKnots).toBe(false);

    const knots = parseBitcoinUserAgent("/Satoshi:29.3.0/Knots:20260507/");
    expect(knots.software).toBe("bitcoin-knots");
    expect(knots.version?.normalized).toBe("29.3.0");
    expect(knots.isKnots).toBe(true);
  });

  it("evaluates Bitcoin Core EOL branches accurately (29.x is EOL as of Nov 2026)", () => {
    expect(getLifecycleStatus("bitcoin-core", parseVersion("29.5.0")!).isEol).toBe(true);
    expect(getLifecycleStatus("bitcoin-core", parseVersion("30.5.0")!).isEol).toBe(false);
    expect(getLifecycleStatus("bitcoin-core", parseVersion("32.1.0")!).isEol).toBe(false);
  });

  it("evaluates multi-branch version clauses correctly", () => {
    const clauses = [
      { minInclusive: "30.0.0", maxInclusive: "30.4.99" },
      { minInclusive: "31.0.0", maxInclusive: "31.2.99" },
    ];
    expect(matchesAnyClause(parseVersion("31.2.0")!, clauses)).toBe(true);
    expect(matchesAnyClause(parseVersion("31.3.0")!, clauses)).toBe(false);
    expect(matchesAnyClause(parseVersion("30.5.0")!, clauses)).toBe(false);
    expect(matchesAnyClause(parseVersion("32.1.0")!, clauses)).toBe(false);
  });
});

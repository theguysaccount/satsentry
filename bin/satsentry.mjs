#!/usr/bin/env node
/**
 * SatSentry Local CLI (Zero external runtime dependencies, MIT License)
 *
 * Read-only, non-custodial Bitcoin & Lightning node security auditor.
 * - Detects local versions via bitcoin-cli / lncli / lightning-cli (optional, read-only)
 *   or accepts explicit version flags (--bitcoin, --lnd, --cln, --eclair, --btcpay, --lnbits).
 * - Scans sensitive admin/RPC/REST ports (8332, 10009, 8080, 3010, 9835, 50001, 5000)
 *   on a target host to catch accidental non-loopback exposure.
 * - Supports --json and --ci (exits code 2 on critical/high/medium CVE or exposed admin port).
 */

import { execFileSync } from "node:child_process";
import net from "node:net";

const ADVISORIES = [
  {
    id: "CVE-2026-117348",
    software: "bitcoin-core",
    severity: "medium",
    title: "Node stall through duplicate orphan announcements",
    fixed: "30.5, 31.3, 32.1",
    url: "https://bitcoincore.org/en/2026/11/20/disclose-orphan-inv-stall/",
    clauses: [
      { minInc: "29.0.0", maxInc: "29.5.99" },
      { minInc: "30.0.0", maxInc: "30.4.99" },
      { minInc: "31.0.0", maxInc: "31.2.99" },
    ],
  },
  {
    id: "CVE-2025-62861",
    software: "bitcoin-core",
    severity: "high",
    title: "Block template creation halted by TRUC sibling eviction during reorg",
    fixed: "28.3, 29.2, 30.0",
    url: "https://bitcoincore.org/en/2026/11/10/disclose-cve-2025-62861/",
    clauses: [
      { minInc: "28.0.0", maxInc: "28.2.99" },
      { minInc: "29.0.0", maxInc: "29.1.99" },
    ],
  },
  {
    id: "CVE-2025-62860",
    software: "bitcoin-core",
    severity: "medium",
    title: "Inbound Tor connections wrongly receive -whitelist permissions",
    fixed: "28.3, 29.2, 30.0",
    url: "https://bitcoincore.org/en/2026/11/10/disclose-cve-2025-62860/",
    clauses: [
      { maxExc: "28.3.0" },
      { minInc: "29.0.0", maxExc: "29.2.0" },
    ],
  },
  {
    id: "CVE-2025-62859",
    software: "bitcoin-core",
    severity: "medium",
    title: "Block processing stall via compact-block witness malleation",
    fixed: "29.2, 30.0",
    url: "https://bitcoincore.org/en/2026/11/10/disclose-cve-2025-62859/",
    clauses: [{ maxExc: "29.2.0" }],
  },
  {
    id: "CVE-2026-117349",
    software: "bitcoin-core",
    severity: "medium",
    title: "Slow unbounded memory growth on paused pre-BIP31 peers",
    fixed: "29.5, 30.4, 31.2, 32.1",
    url: "https://bitcoincore.org/en/2026/10/28/disclose-fpausesend-oom/",
    clauses: [
      { maxExc: "29.5.0" },
      { minInc: "30.0.0", maxExc: "30.4.0" },
      { minInc: "31.0.0", maxExc: "31.2.0" },
      { minInc: "32.0.0", maxExc: "32.1.0" },
    ],
  },
  {
    id: "CVE-2026-117350",
    software: "bitcoin-core",
    severity: "medium",
    title: "Unbounded memory growth via TCP urgent data on non-Linux systems",
    fixed: "29.5, 30.4, 31.2, 32.1",
    url: "https://bitcoincore.org/en/2026/10/28/disclose-tcp-oom/",
    clauses: [
      { maxExc: "29.5.0" },
      { minInc: "30.0.0", maxExc: "30.4.0" },
      { minInc: "31.0.0", maxExc: "31.2.0" },
      { minInc: "32.0.0", maxExc: "32.1.0" },
    ],
  },
  {
    id: "CVE-2024-52911",
    software: "bitcoin-core",
    severity: "high",
    title: "Script interpreter remote crash (use-after-free)",
    fixed: "29.0",
    url: "https://bitcoincore.org/en/2026/05/05/disclose-cve-2024-52911/",
    clauses: [{ minExc: "0.14.0", maxExc: "29.0.0" }],
  },
  {
    id: "CVE-2024-35202",
    software: "bitcoin-core",
    severity: "high",
    title: "Remote node crash via blocktxn assertion failure",
    fixed: "25.0",
    url: "https://bitcoincore.org/en/2024/10/08/disclose-blocktxn-crash/",
    clauses: [{ maxExc: "25.0.0" }],
  },
  {
    id: "CLN-2026-AI-WAVE",
    software: "core-lightning",
    severity: "high",
    title: "2026 AI-discovered vulnerability wave (v26.06.7–v26.06.10 security releases)",
    fixed: "26.06.10",
    url: "https://github.com/ElementsProject/lightning/releases/tag/v26.06.10",
    clauses: [{ maxExc: "26.06.10" }],
  },
  {
    id: "CVE-2024-38359",
    software: "lnd",
    severity: "high",
    title: "LND Onion Bomb DoS vulnerability",
    fixed: "0.17.0-beta",
    url: "https://github.com/lightningnetwork/lnd/security/advisories/GHSA-9gxx-58q6-42p7",
    clauses: [{ maxExc: "0.17.0" }],
  },
  {
    id: "LND-2026-MAINT-HARDENING",
    software: "lnd",
    severity: "medium",
    title: "Behind LND v0.20.8-beta / v0.21.8-beta hardening releases",
    fixed: "0.20.8-beta, 0.21.8-beta",
    url: "https://github.com/lightningnetwork/lnd/releases/tag/v0.21.8-beta",
    clauses: [
      { maxExc: "0.20.8" },
      { minInc: "0.21.0", maxExc: "0.21.8" },
    ],
  },
  {
    id: "ECLAIR-2026-LOUPE-WAVE",
    software: "eclair",
    severity: "high",
    title: "Project Loupe security hardening fixes (v0.14.2–v0.14.6)",
    fixed: "0.14.6",
    url: "https://github.com/ACINQ/eclair/releases/tag/v0.14.6",
    clauses: [{ maxExc: "0.14.6" }],
  },
  {
    id: "BTCPAY-2026-242-CRITICAL",
    software: "btcpay",
    severity: "critical",
    title: "Actively exploited critical vulnerability (pre-v2.4.2)",
    fixed: "2.4.7",
    url: "https://github.com/btcpayserver/btcpayserver/releases/tag/v2.4.2",
    clauses: [{ maxExc: "2.4.2" }],
  },
  {
    id: "BTCPAY-2026-247-HARDENING",
    software: "btcpay",
    severity: "high",
    title: "API permissions, SSRF, and payment-accounting security fixes",
    fixed: "2.4.7",
    url: "https://github.com/btcpayserver/btcpayserver/releases/tag/v2.4.7",
    clauses: [{ maxExc: "2.4.7" }],
  },
  {
    id: "LNBITS-2026-170-CRITICAL",
    software: "lnbits",
    severity: "critical",
    title: "Critical security update requiring immediate upgrade & auth key rotation",
    fixed: "1.7.1",
    url: "https://github.com/lnbits/lnbits/releases/tag/v1.7.1",
    clauses: [{ maxExc: "1.7.1" }],
  },
  {
    id: "CVE-2026-118671",
    software: "lnbits",
    severity: "high",
    title: "Reflected XSS in /lnurlwallet via bech32 HRP injection",
    fixed: "1.7.1",
    url: "https://github.com/lnbits/lnbits/security/advisories/GHSA-g7c6-hwmg-j9v8",
    clauses: [{ maxInc: "1.6.2" }],
  },
];

const SENSITIVE_PORTS = [
  { port: 8332, service: "Bitcoin Core JSON-RPC", risk: "critical", advice: "Bind rpcbind=127.0.0.1 only; never expose RPC over public interfaces." },
  { port: 10009, service: "LND gRPC Admin API", risk: "high", advice: "Restrict to loopback, WireGuard, or Tor; rotate macaroons if exposed." },
  { port: 8080, service: "LND REST / Eclair API", risk: "high", advice: "Do not expose LND REST directly to the internet (REST memory exhaustion & macaroon risk)." },
  { port: 3010, service: "CLN REST (clnrest)", risk: "high", advice: "Restrict rune/REST port behind VPN/Tor or authenticated reverse proxy." },
  { port: 9835, service: "Core Lightning gRPC", risk: "high", advice: "Keep gRPC strictly on localhost or mTLS VPN." },
  { port: 50001, service: "Electrs / Fulcrum TCP", risk: "medium", advice: "Prefer TLS (50002) or Tor/LAN binding to prevent query/UTXO leakage." },
  { port: 5000, service: "LNbits HTTP Interface", risk: "medium", advice: "Place behind TLS reverse proxy and upgrade to LNbits v1.7.1+." },
];

function parseVer(raw) {
  const m = String(raw)
    .trim()
    .replace(/^v/i, "")
    .match(/^(\d+)\.(\d+)(?:\.(\d+))?/);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3] || 0)];
}

function cmp(a, b) {
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
}

function matches(ver, clauses) {
  return clauses.some((c) => {
    if (c.minInc && cmp(ver, parseVer(c.minInc)) < 0) return false;
    if (c.minExc && cmp(ver, parseVer(c.minExc)) <= 0) return false;
    if (c.maxInc && cmp(ver, parseVer(c.maxInc)) > 0) return false;
    if (c.maxExc && cmp(ver, parseVer(c.maxExc)) >= 0) return false;
    return true;
  });
}

function tryExec(cmd, args) {
  try {
    return execFileSync(cmd, args, {
      encoding: "utf8",
      timeout: 3000,
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    return null;
  }
}

function probePort(host, port, timeoutMs = 900) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let settled = false;
    const finish = (open) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(open);
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
    socket.connect(port, host);
  });
}

function parseArgs(argv) {
  const opts = {
    command: argv[0] && !argv[0].startsWith("-") ? argv[0] : "audit",
    versions: {},
    scanHost: null,
    json: false,
    ci: false,
    help: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--help" || a === "-h") opts.help = true;
    else if (a === "--json") opts.json = true;
    else if (a === "--ci") opts.ci = true;
    else if (a === "--bitcoin" && argv[i + 1]) opts.versions["bitcoin-core"] = argv[++i];
    else if (a === "--lnd" && argv[i + 1]) opts.versions["lnd"] = argv[++i];
    else if (a === "--cln" && argv[i + 1]) opts.versions["core-lightning"] = argv[++i];
    else if (a === "--eclair" && argv[i + 1]) opts.versions["eclair"] = argv[++i];
    else if (a === "--btcpay" && argv[i + 1]) opts.versions["btcpay"] = argv[++i];
    else if (a === "--lnbits" && argv[i + 1]) opts.versions["lnbits"] = argv[++i];
    else if (a === "--scan-host" && argv[i + 1]) opts.scanHost = argv[++i];
  }
  return opts;
}

function printHelp() {
  console.log(`SatSentry CLI v1.0.0 — Read-Only Bitcoin & Lightning Security Auditor

Usage:
  satsentry audit [options]

Options:
  --bitcoin <ver>     Audit Bitcoin Core version (e.g. 31.2.0)
  --lnd <ver>         Audit LND version (e.g. 0.21.8-beta)
  --cln <ver>         Audit Core Lightning version (e.g. 26.06.8)
  --eclair <ver>      Audit Eclair version (e.g. 0.14.5)
  --btcpay <ver>      Audit BTCPay Server version (e.g. 2.4.5)
  --lnbits <ver>      Audit LNbits version (e.g. 1.6.2)
  --scan-host <ip>    Check sensitive RPC/REST admin ports on a target host
  --json              Emit machine-readable JSON output
  --ci                Exit with code 2 if any medium/high/critical finding exists
  --help              Show this help message

If no version flags are supplied, SatSentry runs read-only local detection via
bitcoin-cli, lncli, and lightning-cli when available on PATH.`);
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    printHelp();
    process.exit(0);
  }

  // Auto-detect local read-only CLI binaries if user passed no manual versions
  if (Object.keys(opts.versions).length === 0) {
    const btcOut = tryExec("bitcoin-cli", ["getnetworkinfo"]);
    if (btcOut) {
      try {
        const j = JSON.parse(btcOut);
        const m = String(j.subversion || "").match(/Satoshi:([0-9.]+)/);
        if (m) opts.versions["bitcoin-core"] = m[1];
      } catch {}
    }
    const lndOut = tryExec("lncli", ["getinfo"]);
    if (lndOut) {
      try {
        const j = JSON.parse(lndOut);
        if (j.version) opts.versions["lnd"] = String(j.version).split(/\s+/)[0];
      } catch {}
    }
    const clnOut = tryExec("lightning-cli", ["getinfo"]);
    if (clnOut) {
      try {
        const j = JSON.parse(clnOut);
        if (j.version) opts.versions["core-lightning"] = String(j.version);
      } catch {}
    }
  }

  const versionFindings = [];
  for (const [software, versionStr] of Object.entries(opts.versions)) {
    const v = parseVer(versionStr);
    if (!v) continue;
    const matched = ADVISORIES.filter(
      (a) => a.software === software && matches(v, a.clauses)
    );
    versionFindings.push({
      software,
      version: versionStr,
      eol: software === "bitcoin-core" && v[0] < 30,
      advisories: matched,
    });
  }

  const exposedPorts = [];
  if (opts.scanHost) {
    const isLoopback =
      opts.scanHost === "127.0.0.1" ||
      opts.scanHost === "localhost" ||
      opts.scanHost === "::1";
    for (const p of SENSITIVE_PORTS) {
      const open = await probePort(opts.scanHost, p.port);
      if (open) {
        exposedPorts.push({
          host: opts.scanHost,
          port: p.port,
          service: p.service,
          severity: isLoopback ? "info" : p.risk,
          loopbackOnly: isLoopback,
          advice: isLoopback
            ? "Reachable on loopback only (expected for local node management)."
            : p.advice,
        });
      }
    }
  }

  const totalAdvisories = versionFindings.reduce(
    (sum, item) => sum + item.advisories.length,
    0
  );
  const nonLoopbackExposed = exposedPorts.filter((p) => !p.loopbackOnly);
  const failing =
    versionFindings.some((f) =>
      f.advisories.some((a) => ["critical", "high", "medium"].includes(a.severity))
    ) || nonLoopbackExposed.length > 0;

  const report = {
    tool: "satsentry-cli",
    version: "1.0.0",
    auditedAt: new Date().toISOString(),
    checkedSoftware: versionFindings,
    scannedHost: opts.scanHost,
    exposedPorts,
    summary: {
      componentsChecked: versionFindings.length,
      totalAdvisories,
      exposedNonLoopbackPorts: nonLoopbackExposed.length,
      status: failing ? "FAIL" : "PASS",
    },
  };

  if (opts.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`\nSatSentry CLI v1.0.0 — Security Audit (${report.summary.status})`);
    console.log("=".repeat(60));
    if (versionFindings.length === 0) {
      console.log(
        "No local Bitcoin/Lightning binaries detected. Pass --bitcoin, --lnd, --cln, --eclair, --btcpay, or --lnbits."
      );
    } else {
      for (const item of versionFindings) {
        const tag =
          item.advisories.length === 0
            ? item.eol
              ? "EOL"
              : "OK"
            : `${item.advisories.length} CVE(s)`;
        console.log(`\n[${tag}] ${item.software} ${item.version}`);
        if (item.eol) {
          console.log("  ! Branch has reached End-of-Life (no security backports).");
        }
        for (const adv of item.advisories) {
          console.log(
            `  - [${adv.severity.toUpperCase()}] ${adv.id}: ${adv.title} (fix: ${adv.fixed})`
          );
          console.log(`    ${adv.url}`);
        }
      }
    }
    if (opts.scanHost) {
      console.log(`\nPort exposure check on ${opts.scanHost}:`);
      if (exposedPorts.length === 0) {
        console.log("  No sensitive Bitcoin/Lightning admin ports reachable.");
      } else {
        for (const p of exposedPorts) {
          console.log(
            `  - [${p.severity.toUpperCase()}] ${p.host}:${p.port} (${p.service}) — ${p.advice}`
          );
        }
      }
    }
    console.log("");
  }

  if (opts.ci && failing) {
    process.exit(2);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});

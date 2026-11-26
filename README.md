# SatSentry

**Open-source Bitcoin & Lightning CVE Exposure Radar, Node Security Posture Auditor, Local Port/Version CLI, MCP Server, and L402-Monetized Fleet Defense API.**

**Live Production App:** https://satsentry.vercel.app · **L402 Discovery:** https://satsentry.vercel.app/.well-known/l402.json · **MCP Endpoint:** https://satsentry.vercel.app/api/mcp · **AI Index:** https://satsentry.vercel.app/llms.txt

![SatSentry Mainnet Radar](https://satsentry.vercel.app/api/v1/badge?type=mainnet)
[![License: MIT](https://img.shields.io/badge/License-MIT-f7931a.svg)](LICENSE)

## Why SatSentry Exists

Between August and November 2026, automated AI security scanners (including Spiral's **Project Loupe** and OSS code scanners) triggered an unprecedented wave of real vulnerabilities across **Bitcoin Core** (`CVE-2026-117348`, `CVE-2026-117349`, `CVE-2026-117350`, `CVE-2025-62861`), **Core Lightning** (`v26.06.7`–`v26.06.10`), **Eclair** (`v0.14.2`–`v0.14.6`), **BTCPay Server** (`v2.4.2`–`v2.4.7`), and **LNbits** (`v1.7.0`–`v1.7.1`, `CVE-2026-118671`, `CVE-2026-115564`).

Yet Bitcoin and Lightning node operators had no unified, non-custodial CVE radar or programmatic fleet security auditor—leaving over half of reachable mainnet nodes running unpatched or EOL releases.

SatSentry fills that gap with a **100% read-only, non-custodial, MIT-licensed** stack:

1. **Live Mainnet CVE Exposure Radar** — Queries the live reachable Bitcoin node census (`btcnodes.io`) and live Lightning network stats (`mempool.space`) to compute exact real-time vulnerable node counts per CVE and per branch.
2. **Node & Stack CVE Auditor** — Deterministic SemVer + branch-aware CVE matching across **Bitcoin Core, Core Lightning (CLN), LND, Eclair, BTCPay Server, and LNbits**, including automatic parsing of raw `bitcoin-cli getnetworkinfo`, `lncli getinfo`, and `lightning-cli getinfo` JSON.
3. **Public Lightning Node Posture Auditor** — Inspects any public mainnet pubkey via live `mempool.space` gossip & open channels across 8 transparent security rules (BOLT feature bits `DLP`/`static_remotekey`/`zero-fee anchors`/`route blinding`/`onion messages`, Tor vs clearnet, cloud ASN centralization, peer HHI force-close blast radius, and gossip freshness).
4. **Zero-Dependency Local CLI & Port Scanner** (`bin/satsentry.mjs`) — Runs offline on your own host to auto-detect local binaries, match CVEs, scan for exposed admin ports (`8332`, `10009`, `8080`, `3010`, `9835`, `50001`, `5000`), and exit non-zero in CI/CD (`--ci`).
5. **Non-Custodial L402 (HTTP 402 over Lightning) Fleet API + Streamable HTTP MCP Server** — Exposes `POST /api/v1/audit/fleet` (100 sats) and `GET /api/v1/lightning/node/{pubkey}?deep=true` (50 sats) using stateless HMAC-SHA256 L402 macaroons + SHA-256 preimage verification, discoverable via `/.well-known/l402.json`, `/api/openapi.json`, and `/api/mcp`.

---

## Quick Start

### 1. Run the Local CLI (Zero Dependencies)

```bash
# Auto-detect local bitcoin-cli / lncli / lightning-cli (read-only)
node bin/satsentry.mjs audit

# Audit explicit versions + scan host for exposed admin ports (CI mode exits 2 on fail)
node bin/satsentry.mjs audit \
  --bitcoin 31.2.0 \
  --cln 26.06.8 \
  --lnbits 1.6.2 \
  --scan-host 127.0.0.1 \
  --ci
```

### 2. Run the Web Platform, REST API, L402 Gateway & MCP Server

```bash
npm install
npm run dev
```

### 3. Activate Live L402 Lightning Revenue (Non-Custodial)

By default, without a Lightning backend configured, SatSentry operates honestly in `preview-unconfigured` mode (returning full data with `X-L402-Status: preview-unconfigured`). Set **one** of the following receiver backends plus a signing secret to enforce live `HTTP 402 Payment Required` Lightning settlement:

```bash
SATSENTRY_L402_SECRET="replace-with-32-byte-random-hex"

# Option A — Lightning Address (LNURL-pay, fastest zero-node setup)
SATSENTRY_LNURL_ADDRESS="you@getalby.com"

# Option B — LNbits (self-hosted or managed)
SATSENTRY_LNBITS_URL="https://legend.lnbits.com"
SATSENTRY_LNBITS_KEY="your-invoice-read-key"

# Option C — Your own LND REST node (invoice-only macaroon)
SATSENTRY_LND_REST_URL="https://127.0.0.1:8080"
SATSENTRY_LND_MACAROON="hex-encoded-invoice-macaroon"
```

---

## API & Protocol Endpoints

| Endpoint | Method | Tier | Description |
| :--- | :--- | :--- | :--- |
| `/api/v1/radar` | `GET` | Free | Live Bitcoin mainnet CVE exposure census + Lightning stats |
| `/api/v1/advisories` | `GET` | Free | Primary-source verified CVE database (`?software=&version=&severity=&q=`) |
| `/api/v1/audit/stack` | `POST` | Free | Audit a single node stack or pasted CLI `getinfo` JSON |
| `/api/v1/audit/fleet` | `POST` | **L402 (100 sats)** | Batch audit up to 50 Bitcoin/Lightning nodes + live LN posture |
| `/api/v1/lightning/search` | `GET` | Free | Search live mainnet Lightning nodes by alias (`?q=`) |
| `/api/v1/lightning/node/{pubkey}` | `GET` | Free / **L402 (50 sats `?deep=true`)** | Live Lightning node security posture audit |
| `/api/v1/l402/verify` | `GET` / `POST` | Free | Interactive HMAC-SHA256 macaroon & SHA-256 preimage verifier |
| `/api/mcp` | `GET` / `POST` | Free | Streamable HTTP Model Context Protocol (JSON-RPC 2.0) server |
| `/.well-known/l402.json` | `GET` | Free | Machine-readable L402 service discovery manifest |
| `/api/openapi.json` | `GET` | Free | OpenAPI 3.1 schema |

---

## Testing & Verification

```bash
npm run typecheck
npm test
npm run build
```

## Security & Custody Guarantee

SatSentry is **strictly read-only and non-custodial**. It never accepts private keys, seeds, channel backups, or admin macaroons. See [SECURITY.md](SECURITY.md) for responsible disclosure.

## License

MIT — see [LICENSE](LICENSE).

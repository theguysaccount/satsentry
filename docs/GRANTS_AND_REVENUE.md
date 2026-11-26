# SatSentry — Grant, Accelerator & L402 Revenue Execution Package

> **Live Production Platform:** https://satsentry.vercel.app  
> **Public MIT Source Code:** https://github.com/theguysaccount/satsentry  
> **L402 Service Discovery Manifest:** https://satsentry.vercel.app/.well-known/l402.json  
> **OpenAPI 3.1 Spec:** https://satsentry.vercel.app/api/openapi.json  
> **Streamable HTTP MCP Endpoint:** https://satsentry.vercel.app/api/mcp  
> **Verified Live Mainnet Evidence (Nov 25, 2026, Block #977,580):** Out of **21,352** live reachable Bitcoin mainnet nodes (`btcnodes.io`), **13,574 nodes (63.7%)** are exposed to at least one officially disclosed CVE—including **11,968 nodes (56.2%)** exposed to `CVE-2026-117349` (Project Loupe), **10,119 nodes (47.5%)** exposed to `CVE-2026-117348` (Project Loupe, disclosed Nov 20, 2026), **4,161 nodes (19.5%)** exposed to High/Critical CVEs, and **7,798 nodes (36.6%)** running End-of-Life branches (≤29.x). Across **15,255** public Lightning nodes (`mempool.space`), **39.0%** expose clearnet endpoints.

---

## 1. Turn On Live Sat Revenue in 2 Minutes (Zero Custody)

SatSentry is deployed and verified in honest `preview-unconfigured` mode so no fake invoices are ever emitted. To flip live `HTTP 402 Payment Required` Lightning settlement ON immediately:

1. Generate a signing secret:
   ```bash
   openssl rand -hex 32
   ```
2. Add two Vercel Production environment variables on project `satsentry` (zero node required via Lightning Address, OR use LNbits / LND REST invoice macaroon):
   ```bash
   npx vercel env add SATSENTRY_L402_SECRET production --scope jacksonjezio-7345s-projects
   npx vercel env add SATSENTRY_LNURL_ADDRESS production --scope jacksonjezio-7345s-projects
   # Example value: you@getalby.com (or any LNURL-pay Lightning Address)
   npx vercel deploy --prod --yes --scope jacksonjezio-7345s-projects
   ```
3. Verify `https://satsentry.vercel.app/api/health` now shows `"enforcingPayments": true`.
4. Register SatSentry automatically on both major L402 AI-agent marketplaces so autonomous agents and wallets can discover and pay sats per call immediately:
   ```bash
   SATSENTRY_BASE_URL="https://satsentry.vercel.app" \
   SATSENTRY_CONTACT_EMAIL="your@email.com" \
   ./scripts/register-l402-directories.sh
   ```
   - **402 Index:** `POST https://402index.io/api/v1/register`
   - **Satring:** `POST https://satring.com/api/v1/services`

### Non-Custodial Revenue Streams

| Stream | Mechanism | Pricing Model | Target Customers |
| :--- | :--- | :--- | :--- |
| **L402 Pay-Per-Call Fleet API** | `POST /api/v1/audit/fleet` (up to 50 nodes/call) & `GET /api/v1/lightning/node/:pk?deep=true` | 50–100 sats/call via HTTP 402 Lightning | AI ops agents (via MCP/402index/Satring), DevSecOps CI/CD pipelines, routing node fleets |
| **Continuous Fleet Watch (SaaS/Lightning)** | Automated webhook / Nostr DM alerts on new CVEs, EOL transitions, exposed RPC/REST ports, and Lightning channel force-close risk | 50,000–250,000 sats/month (non-custodial invoice/BOLT12) | LSPs, Bitcoin exchanges, custodians, mining pools, multi-merchant BTCPay/LNbits hosts |
| **FOSS Public Goods Grants** | MIT-licensed public mainnet radar, verified advisory schema, and zero-dependency local CLI | $50,000–$250,000 USD paid in BTC | OpenSats, Spiral, HRF, Brink |
| **Bitcoin Accelerators & Seed VC** | Commercial enterprise fleet defense + L402 agentic security rail | $150,000–$250,000 seed | Wolf NYC, PlebLab, Fulgur Ventures |

---

## 2. Ready-to-Submit Grant Applications (Copy-Paste Ready)

### A. OpenSats General Fund (**URGENT: Q4 Window Closes Nov 30, 2026**)
- **Portal:** https://opensats.org/apply/grant
- **Window:** Open Oct–Nov (closes Dec 1; next window opens Jan 1).
- **Required extras before clicking submit:** 2 written references + a short 2–3 minute Loom/screen walkthrough of `https://satsentry.vercel.app` and `node bin/satsentry.mjs audit`.

**Project Name:** SatSentry — Open-Source Bitcoin & Lightning CVE Exposure Radar & Local Node Auditor  
**License:** MIT (https://github.com/theguysaccount/satsentry)  
**Requested Budget (6 Months):** $75,000 USD (paid monthly in BTC)

**One-Page Proposal (Copy-Paste):**
> **Problem:** Automated LLM code auditing (including Spiral's Project Loupe and OSS scanners) triggered a historic wave of real disclosures between August and November 2026 across Bitcoin Core (`CVE-2026-117348`, `CVE-2026-117349`, `CVE-2026-117350`, `CVE-2025-62861`), Core Lightning (`v26.06.7`–`v26.06.10`), Eclair (`v0.14.2`–`v0.14.6`), BTCPay Server (`v2.4.2`–`v2.4.7`), and LNbits (`v1.7.0`–`v1.7.1`). Yet the Bitcoin ecosystem lacks a unified, open-source, machine-readable CVE radar and local node auditor. As measured live by SatSentry on November 25, 2026 (block #977,580), **13,574 of 21,352 reachable Bitcoin mainnet nodes (63.7%)** are exposed to at least one disclosed CVE, and **7,798 nodes (36.6%)** run EOL branches (`≤29.x`).
>
> **What Is Already Built & Live (Proof of Work):**
> - **Live Public Radar & Web Auditor:** https://satsentry.vercel.app — Real-time census across all 21,352+ reachable Bitcoin nodes (`btcnodes.io`) + live Lightning node posture auditing (`mempool.space`).
> - **Primary-Source Verified Advisory Schema (MIT):** 29 machine-evaluable advisories spanning Bitcoin Core, CLN, LND, Eclair, BTCPay Server, and LNbits, every record linked to `bitcoincore.org` or upstream GitHub advisories/releases.
> - **Zero-Dependency Local CLI (`bin/satsentry.mjs`):** Runs locally offline on node hardware (`bitcoin-cli`, `lncli`, `lightning-cli` auto-detection) and checks for accidentally exposed admin ports (`8332`, `10009`, `8080`, `3010`, `9835`, `50001`, `5000`) with CI exit codes.
> - **Open Standards:** OpenAPI 3.1, Streamable HTTP MCP server (`/api/mcp`), and non-custodial L402 discovery (`/.well-known/l402.json`).
>
> **6-Month Grant Milestones:**
> 1. **M1 (Months 1–2):** Publish `satsentry` to npm & crates/Homebrew; integrate automated upstream RSS/GitHub Advisory ingestion PR bots for Bitcoin Core, Knots, LND, CLN, Eclair, LDK, BTCPay, LNbits, Electrs, and Fulcrum.
> 2. **M2 (Months 3–4):** Ship privacy-preserving Tor/Nostr NIP-17 DM & webhook alert daemon (`satsentryd`) so self-hosted node-in-a-box users (Umbrel, Start9, RaspiBlitz, MyNode) receive instant cryptographically signed patch alerts without exposing IP addresses.
> 3. **M3 (Months 5–6):** Package native Umbrel / Start9 / RaspiBlitz apps + publish public monthly Bitcoin & Lightning Network Patch-Velocity Telemetry Reports.

---

### B. Spiral Grants (Highest Narrative Synergy — Rolling Year-Round)
- **Submit via Email:** `grants@spiral.xyz`
- **Subject:** `Grant Proposal: SatSentry — Open-Source CVE Defense Radar Closing the Loop on Project Loupe Disclosures`

**Email Pitch (Copy-Paste):**
> Hi Spiral Grants team,
>
> Spiral's **Project Loupe** just proved that automated LLM auditing can surface real, impactful vulnerabilities across Bitcoin Core (`CVE-2026-117348`, `CVE-2026-117349`) and Eclair (`v0.14.3`–`v0.14.6`). Finding those bugs before adversaries do is half the battle—the other half is helping the decentralized network of node operators actually detect their exposure and patch before disclosure windows become exploitation windows.
>
> We built and shipped **SatSentry** (MIT open-source, live today at https://satsentry.vercel.app | repo: https://github.com/theguysaccount/satsentry) to close that defensive loop:
> - Live mainnet census tracking showing right now (Nov 25, 2026, block #977,580) that **10,119 reachable nodes (47.5%)** remain exposed to `CVE-2026-117348` and **11,968 (56.2%)** to `CVE-2026-117349`.
> - Deterministic SemVer & CLI `getinfo` auditing across Bitcoin Core, CLN, LND, Eclair, BTCPay Server, and LNbits.
> - Live Lightning gossip security posture auditing (BOLT safety bits: DLP, static remotekey, zero-fee anchors, route blinding, onion messages, ASN concentration, and HHI force-close blast radius).
> - Zero-dependency local CLI (`bin/satsentry.mjs`) with RPC/REST port exposure scanning + Streamable HTTP MCP endpoint (`/api/mcp`).
>
> We'd love to apply for a 6-to-12-month Spiral grant to expand SatSentry with native **LDK / BDK** advisory tracking, signed Nostr/Tor operator alerting for Umbrel/Start9/RaspiBlitz, and automated patch-velocity telemetry. Happy to share a full milestone breakdown or walk through a 5-minute demo anytime.

---

### C. Human Rights Foundation (HRF) Bitcoin Development Fund (Rolling)
- **Portal:** https://hrf.org/programs/bitcoin-development-fund/ (4–6 week review cycle)
- **Angle:** Protecting self-sovereign nodes and civil-society BTCPay/LNbits deployments in adversarial jurisdictions from remotely exploitable DoS, SSRF, and Tor `-whitelist` leaks (`CVE-2025-62860`) via a 100% read-only, zero-custody, offline-capable open-source auditor and Tor/Nostr alert daemon.

### D. Brink Grants (Rolling)
- **Portal:** https://brink.dev/programs#grants
- **Angle:** Public protocol resilience infrastructure — automated P2P network upgrade-velocity telemetry and reproducible security advisory schemas aligned with `bitcoincore.org/en/security-advisories/`.

---

## 3. Ready-to-Submit Bitcoin Accelerator & Seed VC Applications

### A. Wolf NYC ($250K Seed Accelerator)
- **Portal:** https://www.wolfnyc.com
- **One-Liner:** SatSentry is the Datadog/Wiz for the Bitcoin & Lightning stack—combining a live mainnet CVE radar, deterministic node/channel security auditor, and non-custodial L402 pay-per-call fleet defense API.
- **Why Now (Nov 2026 Inflection):** AI vulnerability scanners (Project Loupe, Anthropic OSS Scanner) just multiplied the velocity of real CVEs across Bitcoin Core, CLN, Eclair, BTCPay, and LNbits. Today 63.7% of reachable mainnet Bitcoin nodes are unpatched—creating urgent enterprise demand from exchanges, custodians, LSPs, mining pools, and routing nodes.
- **Business Model (Zero Custody, Zero MSB Overhead):** Open-core MIT CLI + public radar for bottom-up developer adoption -> L402 per-audit API fees (50–100 sats/call) for AI agents & CI/CD -> Enterprise SaaS / Lightning subscriptions for continuous multi-node fleet monitoring, compliance audit logs, and instant CVE/force-close alerting.
- **Traction / Live Product:** Shipped live at https://satsentry.vercel.app with 29 primary-source advisories, live 21,352-node census, live Lightning posture scoring, MCP server, and working CLI on GitHub (https://github.com/theguysaccount/satsentry).

### B. PlebLab Startup School (Austin, TX)
- **Portal:** https://ss.pleblab.com (and https://pleblab.com)
- **Angle:** Directly fits PlebLab's #1 2026 theme (**AI × Bitcoin Convergence** + open-source pleb infrastructure): SatSentry defends Bitcoin/Lightning nodes against the AI-CVE wave *and* lets AI ops agents consume and pay for fleet security audits natively over L402 + MCP.

### C. Fulgur Ventures (Pre-Seed Pitch Intake)
- **Portal:** https://fulgur.ventures ("Apply for funding" / "Pitch Us!")
- **Angle:** Aligns directly with Fulgur's 2026 **Bitcoin-Native Risk Mitigation & Machine-to-Machine Lightning Payments** thesis—non-custodial Lightning/Bitcoin infrastructure security telemetry monetized natively over L402 with enterprise routing-node and LSP fleet monitoring upside.

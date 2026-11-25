# SatSentry Architecture & Non-Custodial Security Model

## 1. Threat Model & Custody Boundary

SatSentry is strictly **read-only and non-custodial**:

- Never accepts private keys, mnemonics, `hsm_secret`, `channel.backup`, wallet descriptors, or admin macaroons.
- Local CLI (`bin/satsentry.mjs`) executes only read-only info commands (`bitcoin-cli getnetworkinfo`, `lncli getinfo`, `lightning-cli getinfo`) and TCP connect probes on explicitly requested hosts.
- Web & API endpoints accept only software version strings, public mainnet Lightning node pubkeys, or read-only `getinfo` JSON snippets.
- Paid L402 monetization requires only **invoice-creation privileges** (LNURL-pay public endpoint, LNbits invoice/read key, or LND invoice-only macaroon) so even a compromised web frontend cannot spend funds.

## 2. Live Mainnet CVE Exposure Pipeline

```
btcnodes.io live snapshot (~21,500 reachable nodes)
        │
        ▼  Parse P2P user-agent (/Satoshi:X.Y.Z/, /Knots:.../)
        │
        ├──▶ Match against verified advisory range clauses (src/lib/advisories.ts)
        ├──▶ Evaluate official branch EOL status (src/lib/version.ts)
        └──▶ Aggregate live vulnerable node counts & percentages
                    │
                    ▼  Cached 5 min at edge (s-maxage=300, stale-while-revalidate=600)
        GET /api/v1/radar  +  SSR Mainnet Radar  +  MCP `get_mainnet_cve_radar`
```

## 3. Deterministic Lightning Node Posture Engine

Given any compressed 66-char hex secp256k1 mainnet pubkey, `src/lib/lightning-posture.ts` queries live `mempool.space` gossip metadata and open channels and evaluates 8 transparent, weighted rules totaling 100 points:

1. **BOLT 2 `data-loss-protect` (bits 0/1)** — 20 pts
2. **BOLT 2 `option_static_remotekey` (bits 12/13)** — 15 pts
3. **BOLT 2 `option_anchors_zero_fee_htlc_tx` (bits 22/23)** — 20 pts
4. **Modern Privacy (`option_route_blinding` 24/25 + `option_onion_messages` 38/39)** — 10 pts
5. **Transport Redundancy (Tor / Hybrid vs Clearnet-only)** — 10 pts
6. **Cloud / Hyperscaler ASN Exposure** — 5 pts
7. **Channel Peer Diversity & Force-Close Blast Radius (Top-1 % & HHI)** — 15 pts
8. **Gossip Announcement Freshness** — 5 pts

## 4. Stateless L402 Verification Flow

```
Client / AI Agent                      SatSentry L402 Gateway
       │                                         │
       ├── POST /api/v1/audit/fleet ────────────▶│
       │                                         ├─ Create BOLT11 invoice via LNURL-pay / LNbits / LND
       │                                         ├─ Extract 32-byte payment_hash
       │                                         ├─ Sign stateless HMAC-SHA256 macaroon
       │◀── HTTP 402 Payment Required ───────────┤   WWW-Authenticate: L402 macaroon="...", invoice="lnbc..."
       │                                         │
       ├─ Pays BOLT11 invoice over Lightning     │
       ├─ Receives 32-byte payment preimage      │
       │                                         │
       ├── POST /api/v1/audit/fleet ────────────▶│
       │   Authorization: L402 <mac>:<preimage>  ├─ Verify HMAC signature (constant-time)
       │                                         ├─ Verify expiry + endpoint scope
       │                                         ├─ Verify SHA-256(preimage) === payment_hash (constant-time)
       │◀── HTTP 200 OK (Fleet Audit JSON) ──────┤
```

Zero database state is required to verify L402 payments at the edge.

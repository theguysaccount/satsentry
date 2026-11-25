# Security Policy

## Scope

SatSentry is a read-only, non-custodial Bitcoin and Lightning security telemetry tool. It never holds user funds, private keys, seed phrases, channel states, or signing macaroons.

## Supported Versions

Only the latest release on the `main` branch is actively supported with security updates.

## Reporting a Vulnerability

If you discover a security vulnerability in SatSentry (including L402 macaroon verification, SSRF, or advisory matching bugs):

1. **Do not** open a public GitHub issue with exploit details.
2. Open a private GitHub Security Advisory on the repository (`Security -> Advisories -> Report a vulnerability`).
3. Include a clear reproduction case, affected component, and suggested mitigation.

We follow coordinated disclosure aligned with Bitcoin Core and Lightning disclosure norms.

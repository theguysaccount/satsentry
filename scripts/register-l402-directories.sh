#!/usr/bin/env bash
# Register SatSentry's live L402 endpoints with 402index.io and satring.com
# Run this AFTER setting SATSENTRY_LNURL_ADDRESS (or SATSENTRY_LNBITS_* / SATSENTRY_LND_*)
# on your production deployment so the directory health probes receive real HTTP 402 invoices.

set -euo pipefail

BASE_URL="${SATSENTRY_BASE_URL:-https://satsentry.vercel.app}"
CONTACT_EMAIL="${SATSENTRY_CONTACT_EMAIL:-}"

echo "Verifying live L402 enforcement on ${BASE_URL}/api/health ..."
HEALTH_JSON="$(curl -fsS "${BASE_URL}/api/health")"
echo "${HEALTH_JSON}" | grep -q '"enforcingPayments":true' || {
  echo "ERROR: L402 receiver is still in preview-unconfigured mode on ${BASE_URL}."
  echo "Set SATSENTRY_LNURL_ADDRESS (or SATSENTRY_LNBITS_URL+KEY / SATSENTRY_LND_REST_URL+MACAROON)"
  echo "and SATSENTRY_L402_SECRET in Vercel Production env vars, redeploy, then re-run this script."
  exit 1
}

echo "Registering fleet audit endpoint on 402index.io ..."
curl -fsS -X POST "https://402index.io/api/v1/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"url\": \"${BASE_URL}/api/v1/audit/fleet\",
    \"name\": \"SatSentry Bitcoin & Lightning Fleet CVE Auditor\",
    \"protocol\": \"L402\",
    \"http_method\": \"POST\",
    \"probe_body\": \"{\\\"nodes\\\":[{\\\"name\\\":\\\"probe\\\",\\\"components\\\":[{\\\"software\\\":\\\"bitcoin-core\\\",\\\"version\\\":\\\"31.2.0\\\"}]}]}\",
    \"description\": \"Batch CVE, EOL, and live public Lightning security posture audit for up to 50 Bitcoin/Lightning nodes (Bitcoin Core, CLN, LND, Eclair, BTCPay, LNbits).\",
    \"price_sats\": 100,
    \"payment_asset\": \"BTC\",
    \"payment_network\": \"Lightning\",
    \"category\": \"bitcoin\",
    \"provider\": \"SatSentry\",
    \"contact_email\": \"${CONTACT_EMAIL}\"
  }"
echo ""

echo "Registering fleet audit endpoint on satring.com ..."
curl -fsS -X POST "https://satring.com/api/v1/services" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"SatSentry Bitcoin & Lightning Fleet CVE Auditor\",
    \"url\": \"${BASE_URL}/api/v1/audit/fleet\",
    \"description\": \"Non-custodial Bitcoin Core, CLN, LND, Eclair, BTCPay, and LNbits CVE & Lightning posture batch auditor over L402.\",
    \"protocol\": [\"L402\"],
    \"price\": 100,
    \"model\": \"per-request\",
    \"categories\": [\"bitcoin\", \"security\", \"tools\"]
  }"
echo ""
echo "Done."

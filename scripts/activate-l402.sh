#!/usr/bin/env bash
# One-command activation of live non-custodial L402 Lightning billing on SatSentry.
# Usage: ./scripts/activate-l402.sh <your-lightning-address> [contact-email]
# Example: ./scripts/activate-l402.sh yourhandle@strike.me jacksonjezio@gmail.com

set -euo pipefail

LN_ADDR="${1:-}"
CONTACT_EMAIL="${2:-jacksonjezio@gmail.com}"
SCOPE="jacksonjezio-7345s-projects"
BASE_URL="${SATSENTRY_BASE_URL:-https://satsentry.vercel.app}"

if [[ -z "${LN_ADDR}" || "${LN_ADDR}" != *@* ]]; then
  echo "Usage: $0 <user@domain.com> [contact-email]"
  exit 1
fi

NAME="${LN_ADDR%@*}"
DOMAIN="${LN_ADDR#*@}"

echo "1/4 Verifying LNURL-pay endpoint for ${LN_ADDR}..."
curl -fsS "https://${DOMAIN}/.well-known/lnurlp/${NAME}" | grep -q '"payRequest"' || {
  echo "ERROR: https://${DOMAIN}/.well-known/lnurlp/${NAME} did not return a valid LNURL-pay payRequest."
  exit 1
}

echo "2/4 Setting SATSENTRY_LNURL_ADDRESS in Vercel Production..."
printf "%s" "${LN_ADDR}" | npx vercel env add SATSENTRY_LNURL_ADDRESS production --scope "${SCOPE}" --force

echo "3/4 Redeploying production..."
npx vercel deploy --prod --yes --scope "${SCOPE}"

echo "4/4 Verifying HTTP 402 BOLT11 invoice & registering on 402index.io + satring.com..."
STATUS=$(curl -sS -o /tmp/satsentry-402-check.json -w "%{http_code}" \
  -X POST "${BASE_URL}/api/v1/audit/fleet" \
  -H "Content-Type: application/json" \
  -d '{"nodes":[{"name":"probe","components":[{"software":"bitcoin-core","version":"31.2.0"}]}]}')
echo "Fleet endpoint HTTP status: ${STATUS}"
cat /tmp/satsentry-402-check.json | head -c 400
echo ""
rm -f /tmp/satsentry-402-check.json

if [[ "${STATUS}" == "402" ]]; then
  SATSENTRY_BASE_URL="${BASE_URL}" SATSENTRY_CONTACT_EMAIL="${CONTACT_EMAIL}" \
    "$(dirname "$0")/register-l402-directories.sh"
else
  echo "WARNING: Expected HTTP 402, received ${STATUS}. Check Vercel env vars before directory registration."
  exit 1
fi

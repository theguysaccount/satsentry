export interface Bip353ResolutionReport {
  resolvedAt: string;
  handle: string;
  dnsQueryName: string;
  dnssecValidated: boolean;
  ttlSeconds: number | null;
  bip21Uri: string;
  parsed: {
    onChainAddress: string | null;
    bolt12Offer: string | null;
    silentPaymentAddress: string | null;
    arkAddress: string | null;
    amountBtc: string | null;
    label: string | null;
    message: string | null;
    otherParams: Record<string, string>;
  };
  capabilities: {
    supportsOnChain: boolean;
    supportsBolt12: boolean;
    supportsSilentPayments: boolean;
    supportsArk: boolean;
  };
}

export function parseBip353Handle(raw: string): { user: string; domain: string } | null {
  const cleaned = raw.trim().replace(/^₿/, "").toLowerCase();
  const parts = cleaned.split("@");
  if (parts.length !== 2) return null;
  const [user, domain] = parts;
  if (!/^[a-z0-9._-]{1,63}$/.test(user)) return null;
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) return null;
  return { user, domain };
}

/**
 * Concatenates RFC 1035 quoted TXT chunks (e.g. `"bitcoin:bc1..." "more..."` -> `bitcoin:bc1...more...`).
 */
export function unquoteDnsTxtRecord(rawData: string): string {
  const chunks = rawData.match(/"((?:\\.|[^"\\])*)"/g);
  if (!chunks) return rawData.replace(/^"|"$/g, "");
  return chunks
    .map((c) => c.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, "\\"))
    .join("");
}

export function parseBip21Uri(uri: string): Bip353ResolutionReport["parsed"] {
  const withoutScheme = uri.replace(/^bitcoin:/i, "");
  const qIdx = withoutScheme.indexOf("?");
  const addrPart = (qIdx === -1 ? withoutScheme : withoutScheme.slice(0, qIdx)).trim();
  const queryPart = qIdx === -1 ? "" : withoutScheme.slice(qIdx + 1);

  const params = new URLSearchParams(queryPart);
  const onChainAddress = addrPart.length > 0 ? addrPart : null;
  const bolt12Offer = params.get("lno");
  const silentPaymentAddress = params.get("sp");
  const arkAddress = params.get("ark");
  const amountBtc = params.get("amount");
  const label = params.get("label");
  const message = params.get("message");

  const known = new Set(["lno", "sp", "ark", "amount", "label", "message"]);
  const otherParams: Record<string, string> = {};
  for (const [k, v] of params.entries()) {
    if (!known.has(k)) otherParams[k] = v;
  }

  return {
    onChainAddress,
    bolt12Offer,
    silentPaymentAddress,
    arkAddress,
    amountBtc,
    label,
    message,
    otherParams,
  };
}

export async function resolveBip353Handle(
  handleInput: string
): Promise<Bip353ResolutionReport> {
  const parsedHandle = parseBip353Handle(handleInput);
  if (!parsedHandle) {
    throw new Error(
      "Invalid BIP-353 handle. Expected format like matt@mattcorallo.com or ₿alice@domain.com."
    );
  }

  const dnsQueryName = `${parsedHandle.user}.user._bitcoin-payment.${parsedHandle.domain}`;
  const res = await fetch(
    `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(dnsQueryName)}&type=TXT&do=1`,
    {
      headers: { Accept: "application/dns-json" },
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    }
  );

  if (!res.ok) {
    throw new Error(`DNS-over-HTTPS query failed (HTTP ${res.status}).`);
  }

  const dns = (await res.json()) as {
    Status: number;
    AD?: boolean;
    Answer?: Array<{ type: number; TTL?: number; data: string }>;
  };

  if (dns.Status !== 0 || !dns.Answer || dns.Answer.length === 0) {
    throw new Error(`No BIP-353 TXT record found at ${dnsQueryName}.`);
  }

  if (!dns.AD) {
    throw new Error(
      `DNSSEC validation FAILED (AD=false) for ${dnsQueryName}. Per BIP-353, unauthenticated DNS payment instructions MUST be rejected.`
    );
  }

  // Per BIP-353: ignore TXT records that do not start with "bitcoin:"
  const txtAnswers = dns.Answer.filter((a) => a.type === 16);
  const bitcoinUris = txtAnswers
    .map((a) => ({ uri: unquoteDnsTxtRecord(a.data), ttl: a.TTL ?? null }))
    .filter((entry) => /^bitcoin:/i.test(entry.uri));

  if (bitcoinUris.length === 0) {
    throw new Error(`TXT record exists at ${dnsQueryName}, but none begins with "bitcoin:".`);
  }
  if (bitcoinUris.length > 1) {
    throw new Error(
      `Ambiguous BIP-353 response: ${bitcoinUris.length} bitcoin: TXT records found (BIP-353 requires exactly 1).`
    );
  }

  const { uri: bip21Uri, ttl } = bitcoinUris[0];
  const parsed = parseBip21Uri(bip21Uri);

  return {
    resolvedAt: new Date().toISOString(),
    handle: `${parsedHandle.user}@${parsedHandle.domain}`,
    dnsQueryName,
    dnssecValidated: true,
    ttlSeconds: ttl,
    bip21Uri,
    parsed,
    capabilities: {
      supportsOnChain: Boolean(parsed.onChainAddress),
      supportsBolt12: Boolean(parsed.bolt12Offer),
      supportsSilentPayments: Boolean(parsed.silentPaymentAddress),
      supportsArk: Boolean(parsed.arkAddress),
    },
  };
}

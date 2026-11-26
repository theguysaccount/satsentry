import { SECURITY_ADVISORIES } from "./advisories";
import { auditStack, type ComponentInput } from "./audit-engine";
import { resolveBip353Handle } from "./bip353";
import { getLiveFeeOracle } from "./fee-oracle";
import { fetchAndAuditLightningNode } from "./lightning-posture";
import { getLiveMainnetRadar } from "./mainnet-radar";
import { fetchAndAuditTxPrivacy } from "./tx-privacy";
import { fetchAndAuditUtxoHygiene } from "./utxo-hygiene";
import type { SoftwareId } from "./version";

export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

export interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

export const MCP_TOOLS = [
  {
    name: "get_mainnet_cve_radar",
    description:
      "Fetch live Bitcoin mainnet node version census from btcnodes.io and compute exact reachable node exposure to active Bitcoin Core CVEs plus live Lightning network stats.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "audit_node_stack",
    description:
      "Audit one or more Bitcoin & Lightning software versions (bitcoin-core, core-lightning, lnd, ldk, eclair, btcpay, lnbits) against primary-source verified CVEs and EOL status.",
    inputSchema: {
      type: "object",
      properties: {
        components: {
          type: "array",
          items: {
            type: "object",
            properties: {
              software: {
                type: "string",
                enum: [
                  "bitcoin-core",
                  "core-lightning",
                  "lnd",
                  "ldk",
                  "eclair",
                  "btcpay",
                  "lnbits",
                ],
              },
              version: { type: "string" },
              label: { type: "string" },
            },
            required: ["software", "version"],
          },
        },
      },
      required: ["components"],
    },
  },
  {
    name: "audit_lightning_node",
    description:
      "Perform a live 30-channel public security posture audit on any mainnet Lightning node public key (BOLT feature bits, Tor/clearnet, cloud ASN, channel HHI blast radius).",
    inputSchema: {
      type: "object",
      properties: {
        pubkey: {
          type: "string",
          description: "66-character hex compressed secp256k1 Lightning node public key",
        },
      },
      required: ["pubkey"],
    },
  },
  {
    name: "search_advisories",
    description:
      "Query SatSentry's 32 primary-source verified Bitcoin & Lightning security advisories by software or severity.",
    inputSchema: {
      type: "object",
      properties: {
        software: {
          type: "string",
          enum: [
            "bitcoin-core",
            "core-lightning",
            "lnd",
            "ldk",
            "eclair",
            "btcpay",
            "lnbits",
          ],
        },
        severity: {
          type: "string",
          enum: ["critical", "high", "medium", "low"],
        },
      },
    },
  },
  {
    name: "audit_tx_privacy",
    description:
      "Run exact Boltzmann combinatorial entropy (E=log2 N), CIOH, address reuse, script-mismatch change fingerprinting, and fee hygiene audit on any mainnet Bitcoin txid.",
    inputSchema: {
      type: "object",
      properties: {
        txid: { type: "string", description: "64-character hex Bitcoin mainnet transaction ID" },
      },
      required: ["txid"],
    },
  },
  {
    name: "audit_utxo_hygiene",
    description:
      "Audit any mainnet Bitcoin address for UTXO fragmentation, address reuse, economic dust across 1–200 sat/vB fee spikes, and consolidation savings.",
    inputSchema: {
      type: "object",
      properties: {
        address: { type: "string", description: "Mainnet Bitcoin address (bc1p/bc1q/1/3)" },
      },
      required: ["address"],
    },
  },
  {
    name: "get_bitcoin_fee_oracle",
    description:
      "Get live Bitcoin mempool fee targets, vByte transaction costs (P2TR, P2WPKH, 2-of-3 multisig, Lightning channel open, Anchor CPFP sweep), and consolidation window advice.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "resolve_bip353_address",
    description:
      "Resolve a human-readable BIP-353 Bitcoin address (e.g. matt@mattcorallo.com) via DNSSEC-validated DNS-over-HTTPS into on-chain, Silent Payments (BIP-352), BOLT 12 offer, and Ark payment instructions.",
    inputSchema: {
      type: "object",
      properties: {
        handle: { type: "string", description: "Human-readable Bitcoin payment handle (user@domain.com)" },
      },
      required: ["handle"],
    },
  },
] as const;

export async function handleMcpRequest(
  req: JsonRpcRequest
): Promise<JsonRpcResponse> {
  const id = req.id ?? null;

  if (req.method === "initialize") {
    return {
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: "2025-03-26",
        capabilities: { tools: {} },
        serverInfo: { name: "satsentry-mcp", version: "3.0.0" },
      },
    };
  }

  if (req.method === "ping") {
    return { jsonrpc: "2.0", id, result: {} };
  }

  if (req.method === "tools/list") {
    return { jsonrpc: "2.0", id, result: { tools: MCP_TOOLS } };
  }

  if (req.method === "tools/call") {
    const toolName = req.params?.name;
    const args = (req.params?.arguments ?? {}) as Record<string, unknown>;

    try {
      let payload: unknown;
      if (toolName === "get_mainnet_cve_radar") {
        payload = await getLiveMainnetRadar();
      } else if (toolName === "audit_node_stack") {
        const components = args.components as ComponentInput[] | undefined;
        if (!Array.isArray(components) || components.length === 0) {
          return {
            jsonrpc: "2.0",
            id,
            error: { code: -32602, message: "Parameter `components` must be a non-empty array." },
          };
        }
        payload = auditStack(components);
      } else if (toolName === "audit_lightning_node") {
        payload = await fetchAndAuditLightningNode(String(args.pubkey ?? ""));
      } else if (toolName === "search_advisories") {
        const software = args.software as SoftwareId | undefined;
        const severity = args.severity as string | undefined;
        const filtered = SECURITY_ADVISORIES.filter((a) => {
          if (software && a.software !== software) return false;
          if (severity && a.severity !== severity) return false;
          return true;
        });
        payload = { count: filtered.length, advisories: filtered };
      } else if (toolName === "audit_tx_privacy") {
        payload = await fetchAndAuditTxPrivacy(String(args.txid ?? ""));
      } else if (toolName === "audit_utxo_hygiene") {
        payload = await fetchAndAuditUtxoHygiene(String(args.address ?? ""));
      } else if (toolName === "get_bitcoin_fee_oracle") {
        payload = await getLiveFeeOracle();
      } else if (toolName === "resolve_bip353_address") {
        payload = await resolveBip353Handle(String(args.handle ?? ""));
      } else {
        return {
          jsonrpc: "2.0",
          id,
          error: { code: -32601, message: `Unknown tool: ${String(toolName)}` },
        };
      }

      return {
        jsonrpc: "2.0",
        id,
        result: {
          content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
        },
      };
    } catch (err) {
      return {
        jsonrpc: "2.0",
        id,
        result: {
          isError: true,
          content: [
            {
              type: "text",
              text: err instanceof Error ? err.message : "Tool execution failed",
            },
          ],
        },
      };
    }
  }

  return {
    jsonrpc: "2.0",
    id,
    error: { code: -32601, message: `Method not found: ${req.method}` },
  };
}

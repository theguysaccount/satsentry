import { SECURITY_ADVISORIES } from "./advisories";
import { auditStack, type ComponentInput } from "./audit-engine";
import { fetchAndAuditLightningNode } from "./lightning-posture";
import { getLiveMainnetRadar } from "./mainnet-radar";
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
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "audit_node_stack",
    description:
      "Audit one or more Bitcoin & Lightning software versions (bitcoin-core, core-lightning, lnd, eclair, btcpay, lnbits) against primary-source verified CVEs and EOL status.",
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
      "Perform a live public security posture audit on any mainnet Lightning node public key using mempool.space gossip and open channels (BOLT feature bits, clearnet/Tor exposure, ASN cloud concentration, channel HHI blast radius).",
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
      "Query SatSentry's verified Bitcoin & Lightning security advisory catalog by software or severity.",
    inputSchema: {
      type: "object",
      properties: {
        software: {
          type: "string",
          enum: [
            "bitcoin-core",
            "core-lightning",
            "lnd",
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
        capabilities: {
          tools: {},
        },
        serverInfo: {
          name: "satsentry-mcp",
          version: "1.0.0",
        },
      },
    };
  }

  if (req.method === "ping") {
    return { jsonrpc: "2.0", id, result: {} };
  }

  if (req.method === "tools/list") {
    return {
      jsonrpc: "2.0",
      id,
      result: {
        tools: MCP_TOOLS,
      },
    };
  }

  if (req.method === "tools/call") {
    const toolName = req.params?.name;
    const args = (req.params?.arguments ?? {}) as Record<string, unknown>;

    try {
      if (toolName === "get_mainnet_cve_radar") {
        const radar = await getLiveMainnetRadar();
        return {
          jsonrpc: "2.0",
          id,
          result: {
            content: [{ type: "text", text: JSON.stringify(radar, null, 2) }],
          },
        };
      }

      if (toolName === "audit_node_stack") {
        const components = args.components as ComponentInput[] | undefined;
        if (!Array.isArray(components) || components.length === 0) {
          return {
            jsonrpc: "2.0",
            id,
            error: {
              code: -32602,
              message: "Parameter `components` must be a non-empty array.",
            },
          };
        }
        const report = auditStack(components);
        return {
          jsonrpc: "2.0",
          id,
          result: {
            content: [{ type: "text", text: JSON.stringify(report, null, 2) }],
          },
        };
      }

      if (toolName === "audit_lightning_node") {
        const pubkey = typeof args.pubkey === "string" ? args.pubkey : "";
        const report = await fetchAndAuditLightningNode(pubkey);
        return {
          jsonrpc: "2.0",
          id,
          result: {
            content: [{ type: "text", text: JSON.stringify(report, null, 2) }],
          },
        };
      }

      if (toolName === "search_advisories") {
        const software = args.software as SoftwareId | undefined;
        const severity = args.severity as string | undefined;
        const filtered = SECURITY_ADVISORIES.filter((a) => {
          if (software && a.software !== software) return false;
          if (severity && a.severity !== severity) return false;
          return true;
        });
        return {
          jsonrpc: "2.0",
          id,
          result: {
            content: [
              {
                type: "text",
                text: JSON.stringify({ count: filtered.length, advisories: filtered }, null, 2),
              },
            ],
          },
        };
      }

      return {
        jsonrpc: "2.0",
        id,
        error: { code: -32601, message: `Unknown tool: ${String(toolName)}` },
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

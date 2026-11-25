import { describe, expect, it } from "vitest";
import { handleMcpRequest } from "../src/lib/mcp";

describe("MCP JSON-RPC 2.0 server", () => {
  it("responds to initialize and tools/list", async () => {
    const init = await handleMcpRequest({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
    });
    expect(init.error).toBeUndefined();
    expect((init.result as { serverInfo: { name: string } }).serverInfo.name).toBe(
      "satsentry-mcp"
    );

    const list = await handleMcpRequest({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list",
    });
    const tools = (list.result as { tools: Array<{ name: string }> }).tools;
    expect(tools.map((t) => t.name)).toEqual([
      "get_mainnet_cve_radar",
      "audit_node_stack",
      "audit_lightning_node",
      "search_advisories",
    ]);
  });

  it("executes audit_node_stack and search_advisories tools", async () => {
    const audit = await handleMcpRequest({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: {
        name: "audit_node_stack",
        arguments: {
          components: [{ software: "bitcoin-core", version: "31.2.0" }],
        },
      },
    });
    const text = (audit.result as { content: Array<{ text: string }> }).content[0].text;
    const parsed = JSON.parse(text);
    expect(parsed.overallStatus).toBe("fail");
    expect(parsed.components[0].findings[0].id).toBe("CVE-2026-117348");
  });
});

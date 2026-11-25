import { NextRequest, NextResponse } from "next/server";
import { handleMcpRequest, MCP_TOOLS, type JsonRpcRequest } from "@/lib/mcp";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    protocol: "Model Context Protocol (Streamable HTTP JSON-RPC 2.0)",
    server: { name: "satsentry-mcp", version: "1.0.0" },
    endpoint: "/api/mcp",
    usage:
      'POST JSON-RPC 2.0 requests (methods: "initialize", "tools/list", "tools/call", "ping") to this URL.',
    tools: MCP_TOOLS,
  });
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        id: null,
        error: { code: -32700, message: "Parse error: invalid JSON" },
      },
      { status: 400 }
    );
  }

  if (
    !body ||
    typeof body !== "object" ||
    (body as JsonRpcRequest).jsonrpc !== "2.0" ||
    typeof (body as JsonRpcRequest).method !== "string"
  ) {
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        id: null,
        error: { code: -32600, message: "Invalid JSON-RPC 2.0 request" },
      },
      { status: 400 }
    );
  }

  const response = await handleMcpRequest(body as JsonRpcRequest);
  return NextResponse.json(response);
}

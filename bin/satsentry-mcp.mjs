#!/usr/bin/env node
/**
 * SatSentry Local Stdio MCP Server (Zero external dependencies, MIT)
 *
 * Exposes SatSentry tools over stdin/stdout newline-delimited JSON-RPC 2.0
 * for Claude Desktop, Cursor, Windsurf, and Codex agents.
 * Delegates live network queries to SATSENTRY_API_URL (default https://satsentry.vercel.app).
 */

import readline from "node:readline";

const API_BASE = (
  process.env.SATSENTRY_API_URL || "https://satsentry.vercel.app"
).replace(/\/+$/, "");

async function forwardToMcp(requestObj) {
  const res = await fetch(`${API_BASE}/api/mcp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "SatSentry-Stdio-MCP/2.0",
    },
    body: JSON.stringify(requestObj),
    signal: AbortSignal.timeout(15_000),
  });
  return res.json();
}

const rl = readline.createInterface({
  input: process.stdin,
  crlfDelay: Infinity,
});

rl.on("line", async (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  let parsed;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return;
  }

  // Notifications have no id and expect no reply
  if (parsed.id === undefined) return;

  try {
    const reply = await forwardToMcp(parsed);
    process.stdout.write(`${JSON.stringify(reply)}\n`);
  } catch (err) {
    const fail = {
      jsonrpc: "2.0",
      id: parsed.id ?? null,
      error: {
        code: -32603,
        message: err instanceof Error ? err.message : "SatSentry MCP bridge failed",
      },
    };
    process.stdout.write(`${JSON.stringify(fail)}\n`);
  }
});

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auditStack, extractComponentsFromCliJson } from "@/lib/audit-engine";

const componentSchema = z.object({
  software: z.enum([
    "bitcoin-core",
    "core-lightning",
    "lnd",
    "eclair",
    "btcpay",
    "lnbits",
  ]),
  version: z.string().min(1).max(120),
  label: z.string().max(120).optional(),
});

const requestSchema = z.object({
  components: z.array(componentSchema).max(12).optional(),
  cliJson: z.string().max(50_000).optional(),
});

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation error", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const components = [...(parsed.data.components ?? [])];

  if (parsed.data.cliJson?.trim()) {
    try {
      const extracted = extractComponentsFromCliJson(parsed.data.cliJson);
      components.push(...extracted);
    } catch {
      return NextResponse.json(
        {
          error:
            "Unable to parse cliJson. Paste valid JSON output from bitcoin-cli getnetworkinfo, lncli getinfo, or lightning-cli getinfo.",
        },
        { status: 400 }
      );
    }
  }

  if (components.length === 0) {
    return NextResponse.json(
      {
        error:
          "Provide at least one software component or valid CLI getinfo JSON.",
      },
      { status: 400 }
    );
  }

  const report = auditStack(components.slice(0, 12));
  return NextResponse.json(report);
}

import { NextRequest, NextResponse } from "next/server";
import { SECURITY_ADVISORIES, SOFTWARE_CATALOG, type Severity } from "@/lib/advisories";
import { auditComponent } from "@/lib/audit-engine";
import type { SoftwareId } from "@/lib/version";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const software = searchParams.get("software") as SoftwareId | null;
  const severity = searchParams.get("severity") as Severity | null;
  const version = searchParams.get("version");
  const query = searchParams.get("q")?.trim().toLowerCase() ?? "";

  if (software && !(software in SOFTWARE_CATALOG)) {
    return NextResponse.json(
      {
        error: "Invalid software parameter",
        validSoftware: Object.keys(SOFTWARE_CATALOG),
      },
      { status: 400 }
    );
  }

  if (software && version) {
    const audit = auditComponent({ software, version });
    return NextResponse.json(audit, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    });
  }

  const filtered = SECURITY_ADVISORIES.filter((adv) => {
    if (software && adv.software !== software) return false;
    if (severity && adv.severity !== severity) return false;
    if (query) {
      const hay = `${adv.id} ${adv.cveId ?? ""} ${adv.title} ${adv.summary} ${adv.softwareName}`.toLowerCase();
      if (!hay.includes(query)) return false;
    }
    return true;
  });

  return NextResponse.json(
    {
      count: filtered.length,
      softwareCatalog: SOFTWARE_CATALOG,
      advisories: filtered,
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    }
  );
}

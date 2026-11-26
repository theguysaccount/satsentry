import { SOFTWARE_CATALOG } from "./advisories";
import type { SoftwareId } from "./version";

export interface UpstreamReleaseStatus {
  software: SoftwareId;
  name: string;
  repo: string;
  baselineVersion: string;
  latestUpstreamTag: string | null;
  publishedAt: string | null;
  releaseUrl: string;
  source: "github-releases" | "github-tags" | "baseline-fallback";
}

const CACHE_TTL_MS = 15 * 60 * 1000;
let releaseCache: { data: UpstreamReleaseStatus[]; expiresAt: number } | null = null;

async function fetchRepoLatest(software: SoftwareId): Promise<UpstreamReleaseStatus> {
  const meta = SOFTWARE_CATALOG[software];
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "SatSentry/2.0 (+https://satsentry.vercel.app)",
  };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  try {
    // LDK publishes primarily via Git tags; check tags directly for LDK
    if (software === "ldk") {
      const res = await fetch(
        `https://api.github.com/repos/${meta.repo}/tags?per_page=8`,
        { headers, cache: "no-store", signal: AbortSignal.timeout(6_000) }
      );
      if (res.ok) {
        const tags = (await res.json()) as Array<{ name: string }>;
        const stable =
          tags.find((t) => !/(rc|beta|alpha)/i.test(t.name)) ?? tags[0];
        if (stable) {
          return {
            software,
            name: meta.name,
            repo: meta.repo,
            baselineVersion: meta.latestStable,
            latestUpstreamTag: stable.name,
            publishedAt: null,
            releaseUrl: `https://github.com/${meta.repo}/releases/tag/${stable.name}`,
            source: "github-tags",
          };
        }
      }
    } else {
      const res = await fetch(
        `https://api.github.com/repos/${meta.repo}/releases?per_page=5`,
        { headers, cache: "no-store", signal: AbortSignal.timeout(6_000) }
      );
      if (res.ok) {
        const releases = (await res.json()) as Array<{
          tag_name: string;
          published_at: string;
          html_url: string;
          prerelease: boolean;
        }>;
        const chosen =
          releases.find((r) => !r.prerelease) ?? releases[0];
        if (chosen) {
          return {
            software,
            name: meta.name,
            repo: meta.repo,
            baselineVersion: meta.latestStable,
            latestUpstreamTag: chosen.tag_name,
            publishedAt: chosen.published_at ?? null,
            releaseUrl: chosen.html_url,
            source: "github-releases",
          };
        }
      }
    }
  } catch {
    // Fall back honestly to verified static baseline
  }

  return {
    software,
    name: meta.name,
    repo: meta.repo,
    baselineVersion: meta.latestStable,
    latestUpstreamTag: null,
    publishedAt: null,
    releaseUrl: `https://github.com/${meta.repo}/releases`,
    source: "baseline-fallback",
  };
}

export async function getUpstreamReleases(): Promise<UpstreamReleaseStatus[]> {
  if (releaseCache && Date.now() < releaseCache.expiresAt) {
    return releaseCache.data;
  }

  const ids = Object.keys(SOFTWARE_CATALOG) as SoftwareId[];
  const results = await Promise.all(ids.map((id) => fetchRepoLatest(id)));

  if (results.some((r) => r.source !== "baseline-fallback")) {
    releaseCache = { data: results, expiresAt: Date.now() + CACHE_TTL_MS };
  }
  return results;
}

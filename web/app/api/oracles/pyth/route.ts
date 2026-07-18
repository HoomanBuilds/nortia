import { NextRequest, NextResponse } from "next/server";
import {
  PYTH_PRICE_FEEDS,
  searchPythFeeds,
  type PythFeed,
} from "nortia-client/oracles";

const origin = (process.env.PYTH_HERMES_ORIGIN ?? "https://hermes.pyth.network").replace(/\/+$/, "");
const cache = new Map<string, { expiresAt: number; feeds: PythFeed[] }>();
let catalogCache: { expiresAt: number; values: unknown[] } | null = null;
const CACHE_TTL_MS = 10 * 60 * 1_000;

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("query")?.trim() ?? "";
  const category = request.nextUrl.searchParams.get("category") ?? "all";
  if (query.length > 64 || !["all", "crypto", "economics"].includes(category)) {
    return NextResponse.json({ error: "Invalid Pyth catalog query" }, { status: 400 });
  }
  const key = `${category}:${query.toLowerCase()}`;
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json({ feeds: cached.feeds, cached: true, degraded: false });
  }
  const url = new URL(`${origin}/v2/price_feeds`);
  const apiKey = process.env.PYTH_API_KEY?.trim();
  try {
    let values = catalogCache?.expiresAt && catalogCache.expiresAt > Date.now()
      ? catalogCache.values
      : null;
    if (!values) {
      const response = await fetch(url, {
        headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined,
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) throw new Error(`Hermes returned ${response.status}`);
      const payload = await response.json();
      if (!Array.isArray(payload)) throw new Error("Hermes catalog is not an array");
      values = payload;
      catalogCache = { expiresAt: Date.now() + CACHE_TTL_MS, values };
    }
    const feeds = searchPythFeeds(values, {
      query,
      category: category as "all" | "crypto" | "economics",
      limit: 80,
    });
    cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, feeds });
    return NextResponse.json({
      feeds,
      cached: false,
      degraded: false,
      authenticated: Boolean(apiKey),
      apiKeyRequiredFrom: "2026-08-18",
    }, { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=600" } });
  } catch (error) {
    const feeds = PYTH_PRICE_FEEDS.filter((feed) => category === "all" || feed.category === category)
      .filter((feed) => !query || `${feed.symbol} ${feed.description}`.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 80);
    return NextResponse.json({
      feeds,
      cached: false,
      degraded: true,
      authenticated: Boolean(apiKey),
      apiKeyRequiredFrom: "2026-08-18",
      warning: error instanceof Error ? error.message : "Pyth catalog unavailable",
    });
  }
}

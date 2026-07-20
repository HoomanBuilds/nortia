import { NextResponse } from "next/server";
import { getOnchainMarket, getOnchainMarketActivity } from "@/lib/solana/server-market";
import type { MarketActivity } from "@/lib/markets";

export const revalidate = 15;

type ActivityPayload = {
  generatedAt: string;
  network: "solana-devnet";
  market: string;
  activity: MarketActivity[];
};

const cache = new Map<string, { expiresAt: number; payload: ActivityPayload }>();
const CACHE_TTL_MS = 15_000;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ marketAddress: string }> },
) {
  const { marketAddress } = await params;
  const cached = cache.get(marketAddress);
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json({ ...cached.payload, cached: true, stale: false });
  }
  try {
    const market = await getOnchainMarket(marketAddress);
    if (!market?.hybrid) {
      return NextResponse.json({ error: "Public LMSR market not found" }, { status: 404 });
    }
    const activity = await getOnchainMarketActivity(marketAddress);
    const payload: ActivityPayload = {
      generatedAt: new Date().toISOString(),
      network: "solana-devnet",
      market: marketAddress,
      activity,
    };
    cache.set(marketAddress, { expiresAt: Date.now() + CACHE_TTL_MS, payload });
    return NextResponse.json({ ...payload, cached: false, stale: false }, {
      headers: { "Cache-Control": "public, max-age=15, stale-while-revalidate=300" },
    });
  } catch (cause) {
    if (cached) {
      return NextResponse.json({
        ...cached.payload,
        cached: true,
        stale: true,
        warning: cause instanceof Error ? cause.message : String(cause),
      }, {
        headers: { "Cache-Control": "public, max-age=5, stale-while-revalidate=300" },
      });
    }
    return NextResponse.json({
      error: "Market activity is temporarily unavailable",
      detail: cause instanceof Error ? cause.message : String(cause),
    }, { status: 503 });
  }
}

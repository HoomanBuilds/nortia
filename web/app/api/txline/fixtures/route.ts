import { NextResponse } from "next/server";
import { parseTxlineResponse } from "nortia-client/txline";
import { markets, replayEvents, tradingStateLabel } from "@/lib/markets";

const origin = (process.env.TXLINE_API_ORIGIN ?? "https://txline-dev.txodds.com").replace(/\/$/, "");

export async function GET(request: Request) {
  const supported = markets.filter((market) => market.fixtureId > 0);
  const requested = Number(new URL(request.url).searchParams.get("fixtureId") ?? supported[0]?.fixtureId);
  const fixture = supported.find((market) => market.fixtureId === requested);
  if (!fixture) return NextResponse.json({ error: "Unsupported fixture" }, { status: 404 });

  const jwt = process.env.TXLINE_JWT;
  const apiToken = process.env.TXLINE_API_TOKEN;
  if (jwt && apiToken) {
    const upstream = await fetch(`${origin}/api/scores/historical/${fixture.fixtureId}`, {
      headers: { Authorization: `Bearer ${jwt}`, "X-Api-Token": apiToken },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!upstream.ok) {
      return NextResponse.json({ error: "TxLINE request failed", status: upstream.status }, { status: 502 });
    }
    const records = parseTxlineResponse(await upstream.text());
    return NextResponse.json({ mode: "authenticated", source: "TxLINE devnet", fixtureId: fixture.fixtureId, records });
  }

  return NextResponse.json({
    mode: "covered-replay",
    disclosure: "Covered fixture metadata with deterministic TxLINE-format replay events. Configure server-only TxLINE credentials for authenticated records.",
    fixtures: supported.map((market) => ({
      fixtureId: market.fixtureId,
      competition: market.competition,
      participant1: market.home,
      participant2: market.away,
      tradingState: tradingStateLabel(market).toLowerCase(),
      events: market.id === "demo-txline-replay" ? replayEvents : [],
    })),
  });
}

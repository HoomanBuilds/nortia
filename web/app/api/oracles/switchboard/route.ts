import { NextRequest, NextResponse } from "next/server";

const origin = (process.env.SWITCHBOARD_CROSSBAR_ORIGIN ?? "https://crossbar.switchboard.xyz").replace(/\/+$/, "");

export async function GET(request: NextRequest) {
  const feedHash = request.nextUrl.searchParams.get("feedHash")?.trim().toLowerCase().replace(/^0x/, "") ?? "";
  if (!/^[0-9a-f]{64}$/.test(feedHash)) {
    return NextResponse.json({ error: "Switchboard feed hash must be 32-byte hexadecimal" }, { status: 400 });
  }
  try {
    const response = await fetch(`${origin}/v2/fetch/${feedHash}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`Crossbar returned ${response.status}`);
    const feed = await response.json() as Record<string, unknown>;
    if (!feed.cid || !feed.data || !Number.isSafeInteger(feed.size) || Number(feed.size) <= 0 || !feed.version) {
      throw new Error("Crossbar feed definition is incomplete");
    }
    return NextResponse.json({
      available: true,
      feed: { feedHash, cid: feed.cid, size: feed.size, version: feed.version },
    });
  } catch (error) {
    return NextResponse.json({
      available: false,
      error: error instanceof Error ? error.message : "Switchboard feed unavailable",
    }, { status: 502 });
  }
}

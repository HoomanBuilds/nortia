import { NextResponse } from "next/server";

const origin = (process.env.TXLINE_API_ORIGIN ?? "https://txline-dev.txodds.com").replace(/\/$/, "");

export async function GET() {
  const jwt = process.env.TXLINE_JWT;
  const apiToken = process.env.TXLINE_API_TOKEN;
  if (!jwt || !apiToken) {
    return NextResponse.json({ ok: true, mode: "covered-replay", source: "TxLINE", upstream: "credentials not configured", network: "solana-devnet" });
  }
  const response = await fetch(`${origin}/api/scores/historical/18222446`, {
    headers: { Authorization: `Bearer ${jwt}`, "X-Api-Token": apiToken },
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  return NextResponse.json({ ok: response.ok, mode: "authenticated", source: "TxLINE", upstream: response.status, network: "solana-devnet" }, { status: response.ok ? 200 : 502 });
}

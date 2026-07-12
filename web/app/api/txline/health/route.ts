import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    ok: true,
    mode: "simulation",
    source: "TxLINE-compatible replay schema",
    upstream: "not configured",
    network: "solana-devnet",
  });
}

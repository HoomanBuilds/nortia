import { NextResponse } from "next/server";
import { getOnchainMarkets } from "@/lib/solana/server-market";

export const revalidate = 15;

export async function GET() {
  try {
    const markets = await getOnchainMarkets();
    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      network: "solana-devnet",
      source: "nortia-program-accounts",
      markets,
    });
  } catch (cause) {
    return NextResponse.json({
      error: "Live market discovery is temporarily unavailable",
      detail: cause instanceof Error ? cause.message : String(cause),
    }, { status: 503 });
  }
}

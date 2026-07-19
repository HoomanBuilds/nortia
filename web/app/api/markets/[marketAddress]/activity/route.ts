import { NextResponse } from "next/server";
import { getOnchainMarket, getOnchainMarketActivity } from "@/lib/solana/server-market";

export const revalidate = 15;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ marketAddress: string }> },
) {
  const { marketAddress } = await params;
  try {
    const market = await getOnchainMarket(marketAddress);
    if (!market?.hybrid) {
      return NextResponse.json({ error: "Public LMSR market not found" }, { status: 404 });
    }
    const activity = await getOnchainMarketActivity(marketAddress);
    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      network: "solana-devnet",
      market: marketAddress,
      activity,
    });
  } catch (cause) {
    return NextResponse.json({
      error: "Market activity is temporarily unavailable",
      detail: cause instanceof Error ? cause.message : String(cause),
    }, { status: 503 });
  }
}

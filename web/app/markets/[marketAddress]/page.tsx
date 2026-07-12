import { notFound } from "next/navigation";

import { MarketTerminal } from "../../../components/market-terminal";
import { DEMO_MARKET_ADDRESS } from "../../../lib/demo-data";

export default async function MarketPage({
  params,
}: {
  params: Promise<{ marketAddress: string }>;
}) {
  const { marketAddress } = await params;
  if (marketAddress !== DEMO_MARKET_ADDRESS) {
    notFound();
  }
  return <MarketTerminal />;
}

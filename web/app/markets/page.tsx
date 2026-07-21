import Link from "next/link";
import { LockKeyhole, Plus } from "lucide-react";
import { FeaturedMarket } from "@/components/featured-market";
import { HomeMarkets } from "@/components/home-markets";
import { ResolverIcon, UsdcTokenIcon } from "@/components/market-icons";
import { NortiaMark } from "@/components/nortia-mark";
import { formatCompactUsd } from "@/lib/markets";
import { DEPLOYED_REPLAY_MARKET_ADDRESS } from "@/lib/solana/constants";
import { getOnchainMarket, getOnchainMarkets } from "@/lib/solana/server-market";

export const revalidate = 15;

export default async function MarketsPage() {
  const catalog = await getOnchainMarkets().catch(async () => {
    const deployedMarket = await getOnchainMarket(DEPLOYED_REPLAY_MARKET_ADDRESS).catch(() => null);
    return deployedMarket ? [deployedMarket] : [];
  });
  const totalVolume = catalog.reduce((sum, market) => sum + market.volume, 0);
  const totalTraders = catalog.reduce((sum, market) => sum + market.traders, 0);
  const openMarkets = catalog.filter((market) => market.tradingState === "open" && Date.now() < Date.parse(market.lockAt)).length;
  return (
    <main className="markets-app-page">
      <section className="markets-app-hero page-frame">
        <div><span className="eyebrow"><NortiaMark size={13} />General prediction markets on Solana</span><h1>REAL QUESTIONS.<br /><em>VERIFIED OUTCOMES.</em></h1><p>Trade collateralized USDC markets with continuous LMSR pricing or private TxLINE pools, then inspect the resolver evidence behind every outcome.</p></div>
        <div><div className="intro-stats"><div><span>Onchain volume</span><strong>{formatCompactUsd(totalVolume)}</strong><small>confirmed USDC flow</small></div><div><span>Connected traders</span><strong>{totalTraders.toLocaleString()}</strong><small>wallet position accounts</small></div><div><span>Open markets</span><strong>{openMarkets}</strong><small>accepting trades now</small></div></div><Link className="markets-create-link" href="/markets/create"><Plus size={14} />Create market</Link></div>
      </section>
      <div className="trust-strip"><div className="page-frame"><span><ResolverIcon resolver="Verified settlement" size={14} />Resolver verified settlement</span><span><LockKeyhole size={14} />Private Noir commitments</span><span><ResolverIcon resolver="TxLINE" size={14} />TxLINE sports connected</span><b><UsdcTokenIcon size={14} />Circle devnet USDC</b></div></div>
      <div className="page-frame home-content" id="featured"><FeaturedMarket /><HomeMarkets initialMarkets={catalog} /></div>
    </main>
  );
}

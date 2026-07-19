import Link from "next/link";
import { LockKeyhole, Plus } from "lucide-react";
import { FeaturedMarket } from "@/components/featured-market";
import { HomeMarkets } from "@/components/home-markets";
import { ResolverIcon, SolanaNetworkIcon, UsdcTokenIcon } from "@/components/market-icons";
import { formatCompactUsd, markets } from "@/lib/markets";
import { DEPLOYED_REPLAY_MARKET_ADDRESS } from "@/lib/solana/constants";
import { getOnchainMarket } from "@/lib/solana/server-market";

export const revalidate = 15;

export default async function MarketsPage() {
  const deployedMarket = await getOnchainMarket(DEPLOYED_REPLAY_MARKET_ADDRESS).catch(() => null);
  const catalog = deployedMarket ? [deployedMarket, ...markets] : markets;
  const totalVolume = catalog.reduce((sum, market) => sum + market.volume, 0);
  const totalTraders = catalog.reduce((sum, market) => sum + market.traders, 0);
  return (
    <main className="markets-app-page">
      <section className="markets-app-hero page-frame">
        <div><span className="eyebrow"><SolanaNetworkIcon size={13} />General prediction markets on Solana</span><h1>REAL QUESTIONS.<br /><em>VERIFIED OUTCOMES.</em></h1><p>Trade collateralized USDC markets with continuous LMSR pricing or private TxLINE pools, then inspect the resolver evidence behind every outcome.</p></div>
        <div><div className="intro-stats"><div><span>Demonstrated pool</span><strong>{formatCompactUsd(totalVolume)}</strong><small>replay collateral</small></div><div><span>Private tickets</span><strong>{totalTraders.toLocaleString()}</strong><small>flagship replay</small></div><div><span>Settlement fee</span><strong>1.00%</strong><small>success only</small></div></div><Link className="markets-create-link" href="/markets/create"><Plus size={14} />Create market</Link></div>
      </section>
      <div className="trust-strip"><div className="page-frame"><span><ResolverIcon resolver="Verified settlement" size={14} />Resolver verified settlement</span><span><LockKeyhole size={14} />Private Noir commitments</span><span><ResolverIcon resolver="TxLINE" size={14} />TxLINE sports connected</span><b><UsdcTokenIcon size={14} />Circle devnet USDC</b></div></div>
      <div className="page-frame home-content" id="featured"><FeaturedMarket /><HomeMarkets initialMarkets={catalog} /></div>
    </main>
  );
}

import Link from "next/link";
import { LockKeyhole, Plus, Radio, ShieldCheck } from "lucide-react";
import { FeaturedMarket } from "@/components/featured-market";
import { HomeMarkets } from "@/components/home-markets";
import { formatCompactUsd, markets } from "@/lib/markets";

export default function MarketsPage() {
  const totalVolume = markets.reduce((sum, market) => sum + market.volume, 0);
  const totalTraders = markets.reduce((sum, market) => sum + market.traders, 0);
  return (
    <main className="markets-app-page">
      <section className="markets-app-hero page-frame">
        <div><span className="eyebrow"><Radio size={12} />General prediction markets on Solana</span><h1>REAL QUESTIONS.<br /><em>VERIFIED OUTCOMES.</em></h1><p>Private USDC prediction pools with resolver-backed settlement. TxLINE sports is the first connected market category.</p></div>
        <div><div className="intro-stats"><div><span>Demonstrated pool</span><strong>{formatCompactUsd(totalVolume)}</strong><small>replay collateral</small></div><div><span>Private tickets</span><strong>{totalTraders.toLocaleString()}</strong><small>flagship replay</small></div><div><span>Settlement fee</span><strong>1.00%</strong><small>success only</small></div></div><Link className="markets-create-link" href="/markets/create"><Plus size={14} />Create market</Link></div>
      </section>
      <div className="trust-strip"><div className="page-frame"><span><ShieldCheck size={14} />Resolver verified settlement</span><span><LockKeyhole size={14} />Private Noir commitments</span><span><i />TxLINE sports connected</span><b>Replay uses valueless devnet USDC</b></div></div>
      <div className="page-frame home-content" id="featured"><FeaturedMarket /><HomeMarkets /></div>
    </main>
  );
}

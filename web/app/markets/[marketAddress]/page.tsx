import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, Clock3, ShieldCheck, Users } from "lucide-react";
import { HybridMarketChart, HybridMarketLedger } from "@/components/hybrid-market-ledger";
import { HybridTradingPanel } from "@/components/hybrid-trading-panel";
import { OptimisticResolutionPanel } from "@/components/optimistic-resolution-panel";
import { MarketDetails } from "@/components/market-details";
import { PrivateOrderPanel } from "@/components/private-order-panel";
import { ReplayChart } from "@/components/replay-chart";
import { TeamMark } from "@/components/team-mark";
import { MarketCategoryIcon, ResolverIcon, UsdcTokenIcon } from "@/components/market-icons";
import { NortiaMark } from "@/components/nortia-mark";
import { formatCompactUsd, getMarket, tradingStateLabel } from "@/lib/markets";
import { getOnchainMarket, getOnchainMarketActivity, withMarketActivity } from "@/lib/solana/server-market";

export const revalidate = 15;

export default async function MarketPage({ params, searchParams }: { params: Promise<{ marketAddress: string }>; searchParams: Promise<{ q?: string }> }) {
  const { marketAddress } = await params;
  const { q } = await searchParams;
  const loadedMarket = getMarket(marketAddress) ?? await getOnchainMarket(marketAddress, q);
  if (!loadedMarket) notFound();
  const market = loadedMarket.hybrid
    ? withMarketActivity(
        loadedMarket,
        await getOnchainMarketActivity(marketAddress).catch(() => []),
      )
    : loadedMarket;
  const isReplay = market.id === "demo-txline-replay";
  const isHybrid = Boolean(market.hybrid);
  const finalized = market.tradingState === "resolved" || market.tradingState === "closed";

  return (
    <main className="terminal-page">
      <div className="terminal-frame">
        <Link className="back-link" href="/markets"><ArrowLeft size={14} />All markets</Link>
        <section className="market-header">
          <div className="market-header-main">
            {isHybrid ? <div className="market-header-category"><MarketCategoryIcon category={market.category} size={28} /></div> : <div className="market-header-marks"><TeamMark code={market.homeCode} size="lg" /><TeamMark code={market.awayCode} size="lg" /></div>}
            <div><div className="market-label-row"><span className="market-brand-label"><NortiaMark size={12} />Nortia</span><span><MarketCategoryIcon category={market.category} size={12} />{market.competition}</span><i />{tradingStateLabel(market)}<b><ResolverIcon resolver={market.resolver} size={12} />{market.resolver} resolver</b></div><h1>{market.question}</h1><p>{isHybrid ? `${market.category} market - ${market.kickoff}` : `${market.home} vs ${market.away} - Fixture ${market.fixtureId} - ${market.kickoff}`}</p></div>
          </div>
          {market.score && <div className="header-score"><span>{market.homeCode}</span><strong>{market.score[0]} <i>:</i> {market.score[1]}</strong><span>{market.awayCode}</span></div>}
          <div className="market-header-stats">
            <div><span>YES {isHybrid ? "price" : "reference"}</span><strong className="yes-value">{market.yes}c</strong></div><div><span>NO {isHybrid ? "price" : "reference"}</span><strong className="no-value">{100 - market.yes}c</strong></div><div><span>{isHybrid ? "Volume" : "Pool"}</span><strong>{formatCompactUsd(market.volume)}</strong></div><div><span>{isHybrid ? "Collateral" : "Net escrow"}</span><strong><UsdcTokenIcon size={13} />{formatCompactUsd(market.liquidity)}</strong></div><div><span>{isHybrid ? "Trades" : "Tickets"}</span><strong><Users size={13} />{market.traders}</strong></div><div><span>Resolution</span><strong>{finalized ? <><CheckCircle2 size={13} />Final</> : <><Clock3 size={13} />Pending</>}</strong></div>
          </div>
        </section>

        <div className="terminal-grid">
          <section className="chart-panel">
            <div className="panel-source-row"><span><ResolverIcon resolver={isHybrid ? market.resolver : "TxLINE"} size={13} />{isReplay ? "TxLINE-covered result replay" : isHybrid ? `${market.resolver} resolver with LMSR execution` : "TxLINE market snapshot"}</span><b><ShieldCheck size={13} />{isReplay ? "Deterministic demo" : isHybrid ? "Onchain price" : "Signed source"}</b></div>
            {isReplay ? <ReplayChart /> : isHybrid ? <HybridMarketChart market={market} /> : <div className="generic-chart"><div className="generic-chart-heading"><div><span>TxLINE consensus reference</span><strong>{market.yes}<small>%</small></strong></div><b>{tradingStateLabel(market).toUpperCase()}</b></div><div className="generic-axis"><span>Market open</span><span>Current snapshot</span></div><p>Reference probability is data context. Nortia settles the fixed-ticket pool from the final verified result.</p></div>}
          </section>
          {isHybrid ? <HybridTradingPanel market={market} /> : <PrivateOrderPanel market={market} />}
        </div>
        {isHybrid && market.hybrid?.resolverId === "optimistic" && <OptimisticResolutionPanel market={market} />}
        {isReplay ? <MarketDetails /> : isHybrid ? <HybridMarketLedger market={market} /> : <section className="market-details generic-disclosure" id="proof"><div><span className="eyebrow">Source disclosure</span><h3>{market.replay ? "Covered fixture replay" : "TxLINE-covered market"}</h3><p>{market.replay ? "The final score comes from TxLINE's published World Cup coverage schedule. Open the flagship replay for the complete deterministic event and settlement demonstration." : "This covered fixture is ready for a TxLINE-backed Nortia market."}</p></div><Link href="/markets/demo-txline-replay">Open flagship replay</Link></section>}
      </div>
    </main>
  );
}

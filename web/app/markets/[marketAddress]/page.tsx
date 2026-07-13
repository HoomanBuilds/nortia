import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, Clock3, Radio, ShieldCheck, Users } from "lucide-react";
import { MarketDetails } from "@/components/market-details";
import { PrivateOrderPanel } from "@/components/private-order-panel";
import { ReplayChart } from "@/components/replay-chart";
import { Sparkline } from "@/components/sparkline";
import { TeamMark } from "@/components/team-mark";
import { formatCompactUsd, getMarket, tradingStateLabel } from "@/lib/markets";
import { getOnchainMarket } from "@/lib/solana/server-market";

export default async function MarketPage({ params }: { params: Promise<{ marketAddress: string }> }) {
  const { marketAddress } = await params;
  const market = getMarket(marketAddress) ?? await getOnchainMarket(marketAddress);
  if (!market) notFound();
  const isReplay = market.id === "demo-txline-replay";
  const finalized = market.tradingState === "resolved" || market.tradingState === "closed";

  return (
    <main className="terminal-page">
      <div className="terminal-frame">
        <Link className="back-link" href="/markets"><ArrowLeft size={14} />All markets</Link>
        <section className="market-header">
          <div className="market-header-main">
            <div className="market-header-marks"><TeamMark code={market.homeCode} size="lg" /><TeamMark code={market.awayCode} size="lg" /></div>
            <div><div className="market-label-row"><span>{market.competition}</span><i />{tradingStateLabel(market)}<b>{market.resolver} resolver</b></div><h1>{market.question}</h1><p>{market.home} vs {market.away} - Fixture {market.fixtureId} - {market.kickoff}</p></div>
          </div>
          {market.score && <div className="header-score"><span>{market.homeCode}</span><strong>{market.score[0]} <i>:</i> {market.score[1]}</strong><span>{market.awayCode}</span></div>}
          <div className="market-header-stats">
            <div><span>YES reference</span><strong className="yes-value">{market.yes}c</strong></div><div><span>NO reference</span><strong className="no-value">{100 - market.yes}c</strong></div><div><span>Pool</span><strong>{formatCompactUsd(market.volume)}</strong></div><div><span>Net escrow</span><strong>{formatCompactUsd(market.liquidity)}</strong></div><div><span>Tickets</span><strong><Users size={13} />{market.traders}</strong></div><div><span>Resolution</span><strong>{finalized ? <><CheckCircle2 size={13} />Final</> : <><Clock3 size={13} />Pending</>}</strong></div>
          </div>
        </section>

        <div className="terminal-grid">
          <section className="chart-panel">
            <div className="panel-source-row"><span><Radio size={13} />{isReplay ? "TxLINE-covered result replay" : "TxLINE market snapshot"}</span><b><ShieldCheck size={13} />{isReplay ? "Deterministic demo" : "Signed source"}</b></div>
            {isReplay ? <ReplayChart /> : <div className="generic-chart"><div className="generic-chart-heading"><div><span>TxLINE consensus reference</span><strong>{market.yes}<small>%</small></strong></div><b>{tradingStateLabel(market).toUpperCase()}</b></div><Sparkline points={market.points} id={`large-${market.id}`} /><div className="generic-axis"><span>Market open</span><span>Current snapshot</span></div><p>Reference probability is data context. Nortia settles the fixed-ticket pool from the final verified result.</p></div>}
          </section>
          <PrivateOrderPanel market={market} />
        </div>
        {isReplay ? <MarketDetails /> : <section className="market-details generic-disclosure" id="proof"><div><span className="eyebrow">Source disclosure</span><h3>{market.replay ? "Covered fixture replay" : "TxLINE-covered market"}</h3><p>{market.replay ? "The final score comes from TxLINE's published World Cup coverage schedule. Open the flagship replay for the complete deterministic event and settlement demonstration." : "This covered fixture is ready for a TxLINE-backed Nortia market. Pool figures remain zero until the Nortia program and market account are deployed."}</p></div><Link href="/markets/demo-txline-replay">Open flagship replay</Link></section>}
      </div>
    </main>
  );
}

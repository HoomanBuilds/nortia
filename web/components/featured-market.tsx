import Link from "next/link";
import { ArrowUpRight, CheckCircle2, Radio, ShieldCheck } from "lucide-react";
import { UsdcTokenIcon } from "@/components/market-icons";
import { featuredMarket, formatCompactUsd } from "@/lib/markets";
import { Sparkline } from "@/components/sparkline";
import { TeamMark } from "@/components/team-mark";

export function FeaturedMarket() {
  return (
    <section className="featured-shell">
      <div className="featured-main">
        <div className="featured-kicker"><span><Radio size={13} />Featured replay</span><i />{featuredMarket.competition}</div>
        <div className="featured-title-row">
          <div className="featured-title">
            <div className="featured-marks"><TeamMark code={featuredMarket.homeCode} size="lg" /><TeamMark code={featuredMarket.awayCode} size="lg" /></div>
            <div><p>{featuredMarket.home} vs {featuredMarket.away}</p><h1>{featuredMarket.question}</h1></div>
          </div>
          <div className="final-score"><span>FT</span><strong>{featuredMarket.score?.[0]} <i>:</i> {featuredMarket.score?.[1]}</strong><small>Outcome: YES</small></div>
        </div>
        <div className="featured-data-grid">
          <div className="featured-chart-block">
            <div className="featured-probability"><div><span>Final probability</span><strong>100<small>%</small></strong></div><b>+52 pts</b></div>
            <Sparkline points={featuredMarket.points} tone="green" id="featured" />
            <div className="chart-time-axis"><span>Kickoff</span><span>24'</span><span>53'</span><span>71'</span><span>Full time</span></div>
          </div>
          <div className="featured-outcome-block">
            <div className="featured-outcome yes"><span>YES</span><strong>100c</strong><small>Over 2.5 goals</small></div>
            <div className="featured-outcome no"><span>NO</span><strong>0c</strong><small>Under 2.5 goals</small></div>
          </div>
        </div>
        <div className="featured-footer">
          <div><span>{formatCompactUsd(featuredMarket.volume)} replay pool</span><span>{formatCompactUsd(featuredMarket.liquidity)} net pool</span><span>{featuredMarket.traders} demo tickets</span></div>
          <Link href={`/markets/${featuredMarket.id}`}>Open replay receipt <ArrowUpRight size={15} /></Link>
        </div>
      </div>
      <aside className="featured-rail">
        <div className="rail-header"><span className="eyebrow">Why Nortia</span><strong>Settlement you can inspect.</strong></div>
        <div className="rail-item"><span><ShieldCheck size={17} /></span><div><strong>TxLINE-covered result</strong><p>The final score uses covered fixture data. Event timing remains a labeled replay.</p></div></div>
        <div className="rail-item"><span><UsdcTokenIcon size={17} /></span><div><strong>USDC native</strong><p>Escrow and payouts use stable, six-decimal collateral.</p></div></div>
        <div className="rail-item"><span><CheckCircle2 size={17} /></span><div><strong>Private positions</strong><p>Noir commitments hide individual sides until aggregation.</p></div></div>
        <div className="rail-settlement"><span>Settlement receipt</span><div><b>2.970</b><small>USDC net pool</small></div><p>1% success fee funds Nortia and the resolving keeper.</p></div>
      </aside>
    </section>
  );
}

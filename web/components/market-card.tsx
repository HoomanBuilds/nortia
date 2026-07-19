import Link from "next/link";
import { ArrowUpRight, Clock3, Users } from "lucide-react";
import type { Market } from "@/lib/markets";
import { formatCompactUsd, tradingStateLabel } from "@/lib/markets";
import { Sparkline } from "@/components/sparkline";
import { TeamMark } from "@/components/team-mark";
import { MarketCategoryIcon } from "@/components/market-icons";

export function MarketCard({ market }: { market: Market }) {
  const tone = market.yes === 0 ? "red" : market.yes === 100 ? "green" : "lime";
  return (
    <Link href={`/markets/${market.id}`} className="market-card">
      <div className="market-card-topline">
        <span className={`status status-${market.status}`}><i />{tradingStateLabel(market)}</span>
        <span className="market-card-context"><MarketCategoryIcon category={market.category} size={13} />{market.competition}</span>
        <ArrowUpRight size={15} />
      </div>
      <div className="market-teams">
        {market.hybrid
          ? <div className="category-mark"><MarketCategoryIcon category={market.category} size={22} /><span>{market.category.slice(0, 3).toUpperCase()}</span></div>
          : <div className="stacked-marks"><TeamMark code={market.homeCode} /><TeamMark code={market.awayCode} /></div>}
        <div>
          <h3>{market.question}</h3>
          <p>{market.home} vs {market.away}</p>
        </div>
      </div>
      <div className="card-chart">
        <div className="card-probability"><span>YES</span><strong>{market.yes}%</strong></div>
        <Sparkline points={market.points} tone={tone} id={market.id} />
      </div>
      <div className="probability-split" aria-label={`${market.yes} percent yes, ${100 - market.yes} percent no`}>
        <span style={{ width: `${market.yes}%` }} />
      </div>
      <div className="market-card-footer">
        <span><Clock3 size={13} />{market.kickoff}</span>
        <span><Users size={13} />{market.traders}</span>
        <b>{market.volume > 0 ? `${formatCompactUsd(market.volume)} pool` : "No orders"}</b>
      </div>
    </Link>
  );
}

"use client";

import { useMemo, useState } from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import { MarketCard } from "@/components/market-card";
import { canPlaceOrder, markets } from "@/lib/markets";

const filters = ["All", "Open", "Resolved"] as const;
const categories = ["All categories", "Sports", "Crypto", "Politics", "Technology", "Culture"] as const;

export function HomeMarkets() {
  const [filter, setFilter] = useState<(typeof filters)[number]>("All");
  const [category, setCategory] = useState<(typeof categories)[number]>("All categories");
  const [query, setQuery] = useState("");
  const visible = useMemo(() => markets.filter((market) => {
    const matchesFilter = filter === "All" || (filter === "Open" ? canPlaceOrder(market) : market.tradingState === "resolved");
    const matchesCategory = category === "All categories" || market.category === category;
    const haystack = `${market.question} ${market.home} ${market.away} ${market.competition}`.toLowerCase();
    return matchesFilter && matchesCategory && haystack.includes(query.trim().toLowerCase());
  }), [category, filter, query]);

  return (
    <section className="markets-section" id="markets">
      <div className="section-heading-row">
        <div>
          <span className="eyebrow">General market discovery</span>
          <h2>One market core. Verified resolvers.</h2>
        </div>
        <div className="catalog-tools">
          <label className="market-search">
            <Search size={15} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search markets" aria-label="Search markets" />
          </label>
          <button className="icon-button" type="button" aria-label="Market filters"><SlidersHorizontal size={16} /></button>
        </div>
      </div>
      <div className="filter-row">
        {filters.map((item) => <button type="button" key={item} className={item === filter ? "filter active" : "filter"} onClick={() => setFilter(item)}>{item}</button>)}
        <span>{visible.length} markets</span>
      </div>
      <div className="category-row" aria-label="Market categories">
        {categories.map((item) => <button type="button" key={item} className={item === category ? "category-filter active" : "category-filter"} onClick={() => setCategory(item)}>{item}</button>)}
      </div>
      {visible.length > 0 ? (
        <div className="market-grid">{visible.map((market) => <MarketCard market={market} key={market.id} />)}</div>
      ) : (
        <div className="empty-catalog"><strong>No connected markets in this category yet.</strong><span>TxLINE sports is Nortia's first production resolver. New categories appear only when their resolver adapter is verified.</span></div>
      )}
    </section>
  );
}

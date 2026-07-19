import { Check, ExternalLink, FileCheck2, History, ShieldCheck } from "lucide-react";
import { ShortId } from "@/components/market-details";
import { ResolverIcon, UsdcTokenIcon } from "@/components/market-icons";
import type { Market } from "@/lib/markets";

function explorerAddress(value: string): string {
  return `https://explorer.solana.com/address/${value}?cluster=devnet`;
}

function explorerTransaction(value: string): string {
  return `https://explorer.solana.com/tx/${value}?cluster=devnet`;
}

function shortHash(value: string): string {
  return `${value.slice(0, 10)}...${value.slice(-10)}`;
}

function dateTime(value: string | number | null): string {
  if (value === null) return "Timestamp unavailable";
  const date = new Date(typeof value === "number" ? value * 1_000 : value);
  return Number.isNaN(date.getTime()) ? "Timestamp unavailable" : date.toLocaleString();
}

function oracleCondition(market: Market): string {
  const oracle = market.hybrid?.oracle;
  if (!oracle) return "Unavailable";
  return `${oracle.comparator.replaceAll("-", " ")} ${oracle.threshold} x 10^${oracle.thresholdExponent}`;
}

export function HybridMarketChart({ market }: { market: Market }) {
  const points = market.points.length === 1 ? [market.points[0]!, market.points[0]!] : market.points;
  const width = 900;
  const height = 340;
  const left = 48;
  const right = 18;
  const top = 20;
  const bottom = 34;
  const chartWidth = width - left - right;
  const chartHeight = height - top - bottom;
  const coordinates = points.map((value, index) => ({
    x: left + (index / Math.max(points.length - 1, 1)) * chartWidth,
    y: top + ((100 - Math.max(0, Math.min(100, value))) / 100) * chartHeight,
  }));
  const line = coordinates.map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
  const area = `${line} L${coordinates.at(-1)?.x ?? right},${top + chartHeight} L${coordinates[0]?.x ?? left},${top + chartHeight} Z`;
  const gradientId = `history-${market.id.replaceAll(/[^a-zA-Z0-9]/g, "").slice(0, 18)}`;
  const tradeCount = market.activity?.filter((item) => item.kind === "trade").length ?? 0;
  return (
    <div className="market-history-chart">
      <div className="history-chart-heading">
        <div><span>YES implied probability</span><strong>{market.yes}<small>%</small></strong></div>
        <div><b>{tradeCount}</b><span>confirmed trades loaded</span></div>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label={`YES probability history ending at ${market.yes} percent`}>
        <defs><linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="currentColor" stopOpacity=".24" /><stop offset="100%" stopColor="currentColor" stopOpacity="0" /></linearGradient></defs>
        {[0, 25, 50, 75, 100].map((value) => {
          const y = top + ((100 - value) / 100) * chartHeight;
          return <g key={value}><line x1={left} x2={width - right} y1={y} y2={y} /><text x={8} y={y + 3}>{value}%</text></g>;
        })}
        <path className="history-area" d={area} fill={`url(#${gradientId})`} />
        <path className="history-line" d={line} />
        {coordinates.map((point, index) => <circle key={`${point.x}-${index}`} cx={point.x} cy={point.y} r={index === coordinates.length - 1 ? 4 : 2.5} />)}
        <text className="history-time" x={left} y={height - 8}>MARKET OPEN</text>
        <text className="history-time" x={width - right} y={height - 8} textAnchor="end">LATEST CONFIRMED STATE</text>
      </svg>
      <p>{tradeCount > 0 ? "History is reconstructed from confirmed HybridTradeExecuted events." : "No trades have executed yet. The initial LMSR probability is 50%."}</p>
    </div>
  );
}

export function HybridMarketLedger({ market }: { market: Market }) {
  const details = market.hybrid;
  if (!details) return null;
  const receipt = details.receipt;
  const activity = market.activity ?? [];
  return (
    <section className="hybrid-ledger" id="proof">
      <div className="hybrid-ledger-heading">
        <div><span className="eyebrow"><ShieldCheck size={12} />Onchain market record</span><h2>Rules, activity, and resolution.</h2><p>All values below come from immutable market accounts, confirmed program events, or the one-time resolution receipt.</p></div>
        <a href={explorerAddress(market.address!)} target="_blank" rel="noreferrer">Market account <ExternalLink size={13} /></a>
      </div>
      <div className="hybrid-ledger-grid">
        <article className="ledger-rules">
          <span className="eyebrow">Resolution rules</span>
          <h3>{details.metadataPublished ? "Published and hash verified" : "Metadata publication pending"}</h3>
          <p>{details.rules ?? "The question hash is verified, but the creator has not published the full rules PDA."}</p>
          <dl>
            <div><dt>Trading locks</dt><dd>{dateTime(market.lockAt)}</dd></div>
            <div><dt>Resolution opens</dt><dd>{dateTime(details.resolveNotBefore)}</dd></div>
            <div><dt>Hard deadline</dt><dd>{dateTime(details.resolutionDeadline)}</dd></div>
            <div><dt>Invalid fallback</dt><dd>Neutral 0.50 USDC per aggregate share</dd></div>
          </dl>
          {details.referenceUrl && <a className="ledger-reference" href={details.referenceUrl} target="_blank" rel="noreferrer">Primary source <ExternalLink size={12} /></a>}
        </article>
        <article className="ledger-oracle">
          <span className="eyebrow"><ResolverIcon resolver={market.resolver} size={12} />{market.resolver} resolver</span>
          <h3>Immutable evidence policy</h3>
          <dl>
            <div><dt>Condition</dt><dd>{oracleCondition(market)}</dd></div>
            <div><dt>Observation target</dt><dd>{dateTime(details.oracle.observationAt)}</dd></div>
            <div><dt>Observation window</dt><dd>{details.oracle.observationWindowSecs.toLocaleString()} seconds</dd></div>
            <div><dt>Max staleness</dt><dd>{details.oracle.maxStalenessSecs > 0 ? `${details.oracle.maxStalenessSecs} seconds` : `${details.oracle.maxStalenessSlots} slots`}</dd></div>
            <div><dt>Source program</dt><dd><ShortId value={details.oracle.sourceProgram} /><a href={explorerAddress(details.oracle.sourceProgram)} target="_blank" rel="noreferrer" aria-label="Open source program"><ExternalLink size={12} /></a></dd></div>
            <div><dt>Source ID</dt><dd><code title={details.oracle.sourceId}>{shortHash(details.oracle.sourceId)}</code></dd></div>
          </dl>
        </article>
      </div>
      <div className="resolution-receipt">
        <div className="receipt-heading">
          <span><FileCheck2 size={19} /></span>
          <div><small>Resolution receipt</small><strong>{receipt ? `${receipt.outcome.toUpperCase()} finalized` : `${market.tradingState} - receipt pending`}</strong></div>
          <b className={receipt ? "confirmed" : "pending"}>{receipt ? "CONFIRMED" : "PENDING"}</b>
        </div>
        {receipt ? <div className="resolution-receipt-grid">
          <div><span>Finalized</span><strong>{dateTime(receipt.finalizedAt)}</strong></div>
          <div><span>Observation</span><strong>{receipt.observationValue} x 10^{receipt.observationExponent}</strong></div>
          <div><span>Observation time</span><strong>{dateTime(receipt.observationAt)}</strong></div>
          <div><span>Source account</span><strong><ShortId value={receipt.sourceAccount} /><a href={explorerAddress(receipt.sourceAccount)} target="_blank" rel="noreferrer"><ExternalLink size={12} /></a></strong></div>
          <div><span>Evidence hash</span><strong><code title={receipt.evidenceHash}>{shortHash(receipt.evidenceHash)}</code></strong></div>
          <div><span>Samples and confidence</span><strong>{receipt.sampleCount} samples, {receipt.confidence} confidence units</strong></div>
        </div> : <div className="receipt-pending-copy"><History size={17} /><p>The market has not finalized. If valid evidence is unavailable after the hard deadline, any caller can settle it as invalid so positions are not trapped.</p></div>}
      </div>
      <div className="market-activity-ledger">
        <div className="activity-ledger-heading"><div><span className="eyebrow"><History size={12} />Confirmed activity</span><h3>Market ledger</h3></div><span>{activity.length} events loaded</span></div>
        <div className="market-activity-head"><span>Time</span><span>Action</span><span>Wallet</span><span>Transaction</span></div>
        {activity.length === 0 ? <div className="activity-empty"><History size={18} />No confirmed activity was returned by the configured RPC.</div> : activity.map((item, index) => <article className="market-activity-row" key={`${item.signature}-${index}`}>
          <span>{dateTime(item.timestamp)}</span>
          <span><b>{item.title}</b><small>{item.detail}</small></span>
          <span>{item.account ? <ShortId value={item.account} /> : "Protocol"}</span>
          <a href={explorerTransaction(item.signature)} target="_blank" rel="noreferrer"><Check size={12} />Confirmed <ExternalLink size={11} /></a>
        </article>)}
      </div>
      <div className="hybrid-ledger-footer"><span><UsdcTokenIcon size={13} />Circle devnet USDC collateral</span><code>Question {shortHash(details.questionHash)}</code><code>Rules {shortHash(details.rulesHash)}</code></div>
    </section>
  );
}

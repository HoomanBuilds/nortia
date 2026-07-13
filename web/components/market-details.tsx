"use client";

import { useState } from "react";
import { Check, Copy, ExternalLink, FileCheck2, Fingerprint, Layers3, Radio, WalletCards } from "lucide-react";
import { demoPool, NORTIA_PROGRAM_ID, replayEvents, TXLINE_PROGRAM_ID } from "@/lib/markets";

const tabs = ["Overview", "Settlement", "Activity"] as const;

function ShortId({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard?.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1000);
  };
  return <button type="button" className="short-id" onClick={copy}>{value.slice(0, 5)}...{value.slice(-4)} {copied ? <Check size={12} /> : <Copy size={12} />}</button>;
}

export function MarketDetails() {
  const [tab, setTab] = useState<(typeof tabs)[number]>("Overview");
  return (
    <section className="market-details" id="proof">
      <div className="detail-tabs">{tabs.map((item) => <button type="button" key={item} className={tab === item ? "active" : ""} onClick={() => setTab(item)}>{item}</button>)}</div>
      {tab === "Overview" && (
        <div className="overview-grid">
          <div className="rules-card"><span className="eyebrow">Resolution rules</span><h3>What resolves this market?</h3><p>This market resolves YES when the sum of both teams' final regulation-time goals is greater than 2. Extra time and penalty shootout goals are excluded.</p><dl><div><dt>Data source</dt><dd>TxLINE score primitive</dd></div><div><dt>Validation</dt><dd>On-chain CPI</dd></div><div><dt>Collateral</dt><dd>Devnet USDC</dd></div><div><dt>Fallback</dt><dd>Fee-free refund</dd></div></dl></div>
          <div className="proof-route-card"><span className="eyebrow">Trust path</span><h3>From match event to payout.</h3><div className="proof-route"><div><span><Fingerprint size={16} /></span><strong>Commit</strong><small>Noir proof</small></div><i /><div><span><Layers3 size={16} /></span><strong>Aggregate</strong><small>2-of-3 committee</small></div><i /><div><span><Radio size={16} /></span><strong>Validate</strong><small>TxLINE CPI</small></div><i /><div><span><WalletCards size={16} /></span><strong>Redeem</strong><small>USDC payout</small></div></div></div>
        </div>
      )}
      {tab === "Settlement" && (
        <div className="settlement-grid">
          <div className="receipt-card"><div className="receipt-heading"><span><FileCheck2 size={19} /></span><div><small>Settlement receipt</small><strong>Market resolved YES</strong></div><b>REPLAY</b></div><div className="receipt-score"><span>ARG</span><strong>3 : 1</strong><span>SUI</span></div><div className="receipt-rows"><div><span>Gross pool</span><b>{demoPool.grossPool.toFixed(2)} USDC</b></div><div><span>Nortia treasury</span><b>{demoPool.treasuryRevenue.toFixed(3)} USDC</b></div><div><span>Resolver keeper</span><b>{demoPool.keeperReward.toFixed(3)} USDC</b></div><div><span>Net distributable</span><b>{demoPool.netPool.toFixed(2)} USDC</b></div><div><span>Payout per winning ticket</span><b>{demoPool.payoutPerWinner.toFixed(3)} USDC</b></div></div></div>
          <div className="program-card"><span className="eyebrow">On-chain references</span><div><span>Nortia program</span><ShortId value={NORTIA_PROGRAM_ID} /></div><div><span>TxLINE validator</span><ShortId value={TXLINE_PROGRAM_ID} /></div><div><span>Network</span><b>Solana devnet</b></div><a href="https://explorer.solana.com/?cluster=devnet" target="_blank" rel="noreferrer">Open explorer <ExternalLink size={13} /></a><p>The score path and pool math are deterministic replay evidence. The Proofs page separately reports current program deployment status.</p></div>
        </div>
      )}
      {tab === "Activity" && (
        <div className="activity-table">
          <div className="activity-head"><span>Minute</span><span>TxLINE event</span><span>Sequence</span><span>Score</span><span>Validation</span></div>
          {replayEvents.map((event) => <div className="activity-row" key={event.sequence}><span>{event.minute === 90 ? "FT" : `${event.minute}'`}</span><span><b>{event.label}</b><small>{event.detail}</small></span><span>#{event.sequence}</span><span>{event.score[0]} - {event.score[1]}</span><span className="verified-cell"><Check size={12} />Replay</span></div>)}
        </div>
      )}
    </section>
  );
}

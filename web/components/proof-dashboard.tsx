"use client";

import Link from "next/link";
import { Check, CircleDollarSign, Code2, Database, ExternalLink, FileCheck2, Fingerprint, Radio, ShieldCheck } from "lucide-react";
import { NORTIA_PROGRAM_ADDRESS, TXLINE_PROGRAM_ADDRESS } from "@/lib/solana/constants";
import { useProtocolStatus } from "@/lib/solana/use-nortia-program";

const stages = [
  { icon: Database, label: "Source record", title: "TxLINE final score", detail: "Fixture 18222446, final period 100, participant totals 3 and 1." },
  { icon: Radio, label: "Oracle validation", title: "Merkle proof and CPI", detail: "The score payload is checked against TxLINE's daily score root on Solana." },
  { icon: ShieldCheck, label: "Market rule", title: "Binary outcome", detail: "Participant one goals plus participant two goals is greater than 2." },
  { icon: CircleDollarSign, label: "Pool accounting", title: "USDC settlement", detail: "3.00 gross, 0.027 treasury, 0.003 keeper, and 2.97 distributable." },
];

export function ProofDashboard() {
  const status = useProtocolStatus();
  return (
    <>
      <section className="proof-status-grid">
        <div><span>Connected resolvers</span><strong>01</strong><small>TxLINE sports</small></div>
        <div><span>Onchain validation gates</span><strong>03</strong><small>source, rule, accounting</small></div>
        <div><span>Private public inputs</span><strong>07</strong><small>placement and redeem</small></div>
        <div><span>Refund fee</span><strong>0%</strong><small>all failure paths</small></div>
      </section>

      <section className="proof-surface">
        <div className="proof-surface-heading"><div><span className="eyebrow"><FileCheck2 size={12} />Resolution pipeline</span><h2>From external fact to final payout.</h2></div><Link href="/markets/demo-txline-replay">Open replay <ExternalLink size={14} /></Link></div>
        <div className="proof-stage-grid">{stages.map((stage, index) => { const Icon = stage.icon; return <article key={stage.title}><div className="proof-stage-number">0{index + 1}</div><span><Icon size={18} /></span><small>{stage.label}</small><h3>{stage.title}</h3><p>{stage.detail}</p>{index < stages.length - 1 && <i />}</article>; })}</div>
      </section>

      <div className="proof-lower-grid">
        <section className="receipt-detail-card">
          <div className="receipt-card-title"><span><Check size={18} /></span><div><small>Replay receipt</small><h2>Argentina 3 : 1 Switzerland</h2></div><b>RESOLVED YES</b></div>
          <dl><div><dt>Fixture ID</dt><dd>18222446</dd></div><div><dt>Condition</dt><dd>Total goals greater than 2</dd></div><div><dt>Final period</dt><dd>100</dd></div><div><dt>TxLINE sequence</dt><dd>#81 simulated replay</dd></div><div><dt>Gross pool</dt><dd>3.000000 USDC</dd></div><div><dt>Nortia treasury</dt><dd>0.027000 USDC</dd></div><div><dt>Resolver keeper</dt><dd>0.003000 USDC</dd></div><div><dt>Payout per winner</dt><dd>1.485000 USDC</dd></div></dl>
          <p>The score and fixture are from TxLINE's covered World Cup schedule. Event sequencing is a clearly labeled deterministic replay until an authenticated TxLINE API token is configured.</p>
        </section>
        <section className="program-health-card">
          <span className="eyebrow"><Code2 size={12} />Program health</span><h2>Trust assumptions, visible.</h2>
          <div className="health-row"><div><Radio size={15} /><span>TxLINE validator</span></div><b className={status.txline ? "ready" : "blocked"}>{status.loading ? "Checking" : status.txline ? "Executable" : "Unavailable"}</b></div>
          <code>{TXLINE_PROGRAM_ADDRESS}</code>
          <div className="health-row"><div><Fingerprint size={15} /><span>Nortia core</span></div><b className={status.program ? "ready" : "blocked"}>{status.loading ? "Checking" : status.program ? "Executable" : "Awaiting deploy"}</b></div>
          <code>{NORTIA_PROGRAM_ADDRESS}</code>
          <a href={`https://explorer.solana.com/address/${TXLINE_PROGRAM_ADDRESS}?cluster=devnet`} target="_blank" rel="noreferrer">Inspect TxLINE on explorer <ExternalLink size={13} /></a>
        </section>
      </div>

      <section className="resolver-registry">
        <div><span className="eyebrow">Resolver registry</span><h2>General markets need specific evidence.</h2><p>Nortia's core is category-neutral. Every new category still needs an adapter with explicit finality, freshness, dispute, and refund rules.</p></div>
        <div className="resolver-table"><div><span>Sports statistics</span><b className="ready">TxLINE connected</b></div><div><span>Price thresholds</span><b>Adapter review</b></div><div><span>Governance outcomes</span><b>Adapter review</b></div><div><span>Public assertions</span><b>Adapter review</b></div></div>
      </section>
    </>
  );
}

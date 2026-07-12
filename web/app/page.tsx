import { ArrowUpRight, Binary, CircleDollarSign, LockKeyhole, RadioTower, ShieldCheck } from "lucide-react";
import Link from "next/link";

import { SourceStatus } from "../components/source-status";

export default function HomePage() {
  return (
    <main>
      <section className="hero page-shell">
        <div className="hero-copy">
          <div className="eyebrow"><RadioTower size={15} aria-hidden="true" /> World Cup markets, verified on Solana</div>
          <h1>Predict privately.<br /><span>Settle from the match.</span></h1>
          <p className="hero-lede">
            Fixed 1 USDC tickets hide each YES or NO choice until lock. TxLINE score proofs determine the result, and winners claim from a neutral Solana vault.
          </p>
          <div className="hero-actions">
            <Link className="button primary" href="/markets/demo-txline-replay">
              Watch the replay <ArrowUpRight size={17} aria-hidden="true" />
            </Link>
            <Link className="button secondary" href="/portfolio">Open portfolio</Link>
          </div>
          <p className="demo-disclosure">Demonstration uses simulated TxLINE-format data and valueless devnet USDC.</p>
        </div>
        <div className="hero-terminal">
          <SourceStatus />
          <div className="terminal-kicker">FEATURED MARKET</div>
          <div className="fixture-row">
            <div><span>BRA</span><strong>2</strong></div>
            <div className="fixture-clock">FINAL<br /><small>90:00</small></div>
            <div><strong>1</strong><span>FRA</span></div>
          </div>
          <div className="market-question">Will the final match contain three or more total goals?</div>
          <div className="terminal-stats">
            <div><small>POOL</small><strong>3.00 USDC</strong></div>
            <div><small>RESULT</small><strong className="amber">YES</strong></div>
            <div><small>WINNER PAYOUT</small><strong>1.485 USDC</strong></div>
          </div>
          <Link className="terminal-link" href="/markets/demo-txline-replay">Inspect settlement receipt <ArrowUpRight size={16} aria-hidden="true" /></Link>
        </div>
      </section>

      <section className="trust-strip page-shell" aria-label="Protocol properties">
        <div><LockKeyhole size={19} aria-hidden="true" /><span><strong>Private through lock</strong><small>No side exposed on-chain</small></span></div>
        <div><Binary size={19} aria-hidden="true" /><span><strong>Proof-gated tickets</strong><small>Noir plus Groth16 on Solana</small></span></div>
        <div><ShieldCheck size={19} aria-hidden="true" /><span><strong>TxLINE settlement</strong><small>Final score validation path</small></span></div>
        <div><CircleDollarSign size={19} aria-hidden="true" /><span><strong>Transparent revenue</strong><small>1% only when settled</small></span></div>
      </section>

      <section className="how page-shell">
        <div className="section-heading"><span>HOW IT WORKS</span><h2>One private ticket. One verifiable result.</h2></div>
        <div className="steps-grid">
          <article><span>01</span><LockKeyhole aria-hidden="true" /><h3>Prove your choice</h3><p>Your browser creates a private YES or NO commitment and proves it is valid without publishing the side.</p></article>
          <article><span>02</span><RadioTower aria-hidden="true" /><h3>Resolve from TxLINE</h3><p>After lock, aggregate liquidity appears. A final score proof checks the exact over 2.5 goals predicate.</p></article>
          <article><span>03</span><CircleDollarSign aria-hidden="true" /><h3>Claim USDC</h3><p>A second proof shows you backed the winner. The pool sends the net payout to your chosen recipient.</p></article>
        </div>
      </section>
    </main>
  );
}

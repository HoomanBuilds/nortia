"use client";

import {
  BadgeCheck,
  Check,
  ChevronDown,
  CircleDollarSign,
  Clock3,
  Code2,
  Copy,
  EyeOff,
  FileCheck2,
  LockKeyhole,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { formatUsdc } from "../../client/src/economics";
import {
  demoPool,
  DEVNET_USDC_MINT,
  NORTIA_PROGRAM_ID,
  replayEvents,
  TXLINE_PROGRAM_ID,
} from "../lib/demo-data";
import { SourceStatus } from "./source-status";

function shorten(value: string) {
  return `${value.slice(0, 5)}...${value.slice(-5)}`;
}

export function MarketTerminal() {
  const [eventIndex, setEventIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [technical, setTechnical] = useState(false);
  const [side, setSide] = useState<"yes" | "no" | null>(null);
  const [previewed, setPreviewed] = useState(false);
  const current = replayEvents[eventIndex]!;
  const final = eventIndex === replayEvents.length - 1;

  useEffect(() => {
    if (!playing || final) return;
    const timer = window.setTimeout(() => setEventIndex((value) => value + 1), 1100);
    return () => window.clearTimeout(timer);
  }, [playing, final, eventIndex]);

  useEffect(() => {
    if (final) setPlaying(false);
  }, [final]);

  const linePoints = useMemo(
    () => replayEvents.map((event, index) => `${index * 25},${100 - event.overProbability}`).join(" "),
    [],
  );

  return (
    <main className="market-page page-shell">
      <div className="replay-disclosure">
        <span><RefreshCw size={15} aria-hidden="true" /> DEMONSTRATION REPLAY</span>
        Simulated TxLINE-format fixture and valueless Circle devnet USDC. No live wager is being offered.
      </div>

      <div className="market-grid">
        <div className="market-main">
          <section className="panel fixture-panel">
            <div className="panel-topline">
              <div><span className="competition">WORLD CUP FINAL - SIMULATION</span><small>Fixture 20260719</small></div>
              <SourceStatus compact />
            </div>
            <div className="scoreboard">
              <div className="team"><span className="flag-code">BRA</span><strong>Brazil</strong></div>
              <div className="score"><span>{current.scoreA}</span><i>:</i><span>{current.scoreB}</span><small>{current.minute === 90 ? "FINAL" : `${current.minute}'`}</small></div>
              <div className="team right"><strong>France</strong><span className="flag-code">FRA</span></div>
            </div>
            <div className="replay-controls">
              <button className="icon-button" onClick={() => setPlaying((value) => !value)} aria-label={playing ? "Pause replay" : "Play replay"}>
                {playing ? <Pause size={17} /> : <Play size={17} />}
              </button>
              <input
                aria-label="Replay event"
                type="range"
                min="0"
                max={replayEvents.length - 1}
                value={eventIndex}
                onChange={(event) => { setEventIndex(Number(event.target.value)); setPlaying(false); }}
              />
              <span className="event-label">SEQ {current.sequence} - {current.label}</span>
              <button className="icon-button" onClick={() => { setEventIndex(0); setPlaying(false); }} aria-label="Restart replay"><RotateCcw size={16} /></button>
            </div>
          </section>

          <section className="panel odds-panel">
            <div className="panel-title"><div><span>TXLINE CONSENSUS</span><h2>Over 2.5 implied probability</h2></div><strong>{current.overProbability}%</strong></div>
            <div className="chart-wrap" aria-label="TxLINE over 2.5 probability history">
              <div className="chart-y"><span>100%</span><span>50%</span><span>0%</span></div>
              <svg viewBox="0 0 100 105" preserveAspectRatio="none" role="img" aria-label="Probability rises from 48 percent to 100 percent">
                <line x1="0" x2="100" y1="5" y2="5" />
                <line x1="0" x2="100" y1="55" y2="55" />
                <line x1="0" x2="100" y1="105" y2="105" />
                <polyline points={linePoints} />
                {replayEvents.slice(0, eventIndex + 1).map((event, index) => <circle key={event.sequence} cx={index * 25} cy={100 - event.overProbability} r="1.7" />)}
              </svg>
              <div className="chart-x"><span>KO</span><span>19&apos;</span><span>44&apos;</span><span>68&apos;</span><span>FT</span></div>
            </div>
            <div className="event-table" role="table" aria-label="Score events">
              {replayEvents.slice(0, eventIndex + 1).map((event) => (
                <div role="row" key={event.sequence}><span role="cell">{event.minute === 90 ? "FT" : `${event.minute}'`}</span><strong role="cell">{event.label}</strong><span role="cell">{event.scoreA}-{event.scoreB}</span><span role="cell">{event.overProbability}%</span></div>
              ))}
            </div>
          </section>

          <section className="panel receipt-panel">
            <div className="panel-title receipt-title"><div><span>SETTLEMENT RECEIPT</span><h2>TxLINE result path</h2></div><div className={final ? "verified-badge" : "waiting-badge"}>{final ? <BadgeCheck size={16} /> : <Clock3 size={16} />}{final ? "READY" : "AWAITING FINAL"}</div></div>
            <div className="predicate"><Code2 size={18} aria-hidden="true" /><span>score key 1 + score key 2 &gt; 2</span><strong>{current.scoreA} + {current.scoreB} {final ? "> 2 = YES" : ""}</strong></div>
            <div className="receipt-grid">
              <div><small>Fixture ID</small><strong>20260719</strong></div>
              <div><small>Observed sequence</small><strong>{current.sequence}</strong></div>
              <div><small>Period</small><strong>{final ? "100 / Final" : "In play"}</strong></div>
              <div><small>CPI status</small><strong>{final ? "Payload ready" : "Not submitted"}</strong></div>
            </div>
            <button className="technical-toggle" onClick={() => setTechnical((value) => !value)} aria-expanded={technical}>
              Technical details <ChevronDown size={17} className={technical ? "rotated" : ""} />
            </button>
            {technical && (
              <div className="technical-details">
                <Detail label="Nortia program" value={NORTIA_PROGRAM_ID} />
                <Detail label="TxLINE devnet program" value={TXLINE_PROGRAM_ID} />
                <Detail label="USDC devnet mint" value={DEVNET_USDC_MINT} />
                <Detail label="Validation mode" value="V2 validate_stat CPI" />
                <Detail label="Proof state" value="Simulation payload, not an on-chain claim" />
              </div>
            )}
          </section>
        </div>

        <aside className="pool-column">
          <section className="panel pool-panel">
            <div className="pool-header"><span>PRIVATE POOL</span><span className={final ? "phase resolved" : "phase open"}>{final ? "RESOLVED" : "REPLAYING"}</span></div>
            <h1>Will the final match contain three or more total goals?</h1>
            <div className="ticket-line"><span>Fixed ticket</span><strong>1.00 USDC</strong></div>
            {!final ? (
              <div className="hidden-liquidity"><EyeOff size={22} aria-hidden="true" /><strong>Choices remain private</strong><span>YES and NO totals appear only after the replay reaches final settlement.</span></div>
            ) : (
              <div className="liquidity-result">
                <div><span>YES</span><strong>2 tickets</strong><i>66.7%</i></div>
                <div><span>NO</span><strong>1 ticket</strong><i>33.3%</i></div>
              </div>
            )}

            <div className="side-picker" aria-label="Preview a private ticket">
              <button className={side === "yes" ? "selected" : ""} onClick={() => { setSide("yes"); setPreviewed(false); }}><Check size={17} /> YES</button>
              <button className={side === "no" ? "selected" : ""} onClick={() => { setSide("no"); setPreviewed(false); }}><span className="x-mark">x</span> NO</button>
            </div>
            <button className="button primary full" disabled={!side} onClick={() => setPreviewed(true)}>
              <LockKeyhole size={17} /> Preview private ticket
            </button>
            {previewed && <div className="preview-success"><ShieldCheck size={18} /><span><strong>Private inputs prepared locally</strong><small>Wallet signing is disabled in replay mode.</small></span></div>}

            <div className="fee-box">
              <div><span>Protocol fee</span><strong>1.00% of gross pool</strong></div>
              <div><span>Charged</span><strong>Only on settlement</strong></div>
              <div><span>One-sided or timeout</span><strong>Full refund, zero fee</strong></div>
            </div>
          </section>

          <section className="panel economics-panel">
            <div className="panel-title"><div><span>POOL ECONOMICS</span><h2>Settlement breakdown</h2></div><CircleDollarSign size={20} /></div>
            <MoneyRow label="Gross pool" value={`${formatUsdc(demoPool.grossPool)} USDC`} />
            <MoneyRow label="Protocol fee (100 bps)" value={`${formatUsdc(demoPool.protocolFee)} USDC`} accent />
            <MoneyRow label="Net winner pool" value={`${formatUsdc(demoPool.netPool)} USDC`} />
            <MoneyRow label="Payout per YES ticket" value={`${formatUsdc(demoPool.payoutAmount)} USDC`} strong />
          </section>

          <section className="panel safety-panel">
            <FileCheck2 size={19} aria-hidden="true" />
            <div><strong>Prototype trust boundary</strong><p>Any two committee members can reconstruct individual choices. The generated Groth16 setup is not a production ceremony.</p></div>
          </section>
        </aside>
      </div>
    </main>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return <div><span>{label}</span><code>{value.length > 28 ? shorten(value) : value}</code><button aria-label={`Copy ${label}`} onClick={() => { void navigator.clipboard?.writeText(value); setCopied(true); }}>{copied ? <Check size={14} /> : <Copy size={14} />}</button></div>;
}

function MoneyRow({ label, value, accent, strong }: { label: string; value: string; accent?: boolean; strong?: boolean }) {
  return <div className={`money-row${strong ? " total" : ""}`}><span>{label}</span><strong className={accent ? "amber" : ""}>{value}</strong></div>;
}

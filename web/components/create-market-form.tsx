"use client";

import { BN } from "@anchor-lang/core";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { SystemProgram } from "@solana/web3.js";
import { AlertTriangle, Check, CircleDollarSign, Clock3, ExternalLink, Radio, ShieldCheck, Wallet } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { DEVNET_USDC_MINT_KEY } from "@/lib/solana/constants";
import { marketPda, protocolPda, vaultPda } from "@/lib/solana/pdas";
import { useNortiaProgram, useProtocolStatus } from "@/lib/solana/use-nortia-program";

const fixtures = [
  { id: 18257739, label: "Spain vs Argentina", group: "World Cup Final", start: "2026-07-19T19:00:00Z" },
  { id: 18222446, label: "Argentina vs Switzerland", group: "Quarter-final replay", start: "2026-07-12T01:00:00Z" },
  { id: 18218149, label: "Spain vs Belgium", group: "Quarter-final replay", start: "2026-07-10T19:00:00Z" },
] as const;

async function sha256(value: string) {
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))));
}

export function CreateMarketForm() {
  const program = useNortiaProgram();
  const router = useRouter();
  const { connected, publicKey } = useWallet();
  const { setVisible } = useWalletModal();
  const protocolStatus = useProtocolStatus();
  const [fixtureId, setFixtureId] = useState<number>(fixtures[0].id);
  const [mode, setMode] = useState<"live" | "replay">("replay");
  const threshold = 2;
  const [submitting, setSubmitting] = useState(false);
  const [signature, setSignature] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fixture = fixtures.find((item) => item.id === fixtureId) ?? fixtures[0];
  const liveAvailable = Date.parse(fixture.start) > Date.now() + 60_000;
  const displayThreshold = threshold + 0.5;
  const question = `Will ${fixture.label} finish with over ${displayThreshold} goals?`;
  const rules = `TxLINE participant-one goals plus participant-two goals for final period 100 must be greater than ${threshold}.`;
  const marketId = useMemo(() => new BN(`${fixture.id}${threshold}${mode === "replay" ? "1" : "0"}`), [fixture.id, mode, threshold]);
  const market = useMemo(() => publicKey ? marketPda(publicKey, marketId) : null, [marketId, publicKey]);
  const vault = useMemo(() => market ? vaultPda(market) : null, [market]);

  const submit = async () => {
    if (!program || !publicKey || !market || !vault) return;
    setSubmitting(true);
    setError(null);
    setSignature(null);
    try {
      const start = Math.floor(Date.parse(fixture.start) / 1000);
      const now = Math.floor(Date.now() / 1000);
      const lock = mode === "live" ? start : now + 15 * 60;
      const batchDeadline = lock + 15 * 60;
      const resolutionDeadline = Math.max(batchDeadline + 60 * 60, start + 8 * 60 * 60);
      const questionHash = await sha256(question);
      const rulesHash = await sha256(rules);
      const tx = await program.methods.initializeMarket({
        marketId,
        category: { sports: {} },
        resolverKind: { txlineStatV2: {} },
        questionHash,
        rulesHash,
        fixtureId: new BN(fixture.id),
        totalGoalsThreshold: threshold,
        marketMode: mode === "live" ? { live: {} } : { replay: {} },
        fixtureStartTs: new BN(start),
        lockTs: new BN(lock),
        batchDeadlineTs: new BN(batchDeadline),
        resolutionDeadlineTs: new BN(resolutionDeadline),
      }).accountsPartial({
        creator: publicKey,
        protocol: protocolPda(),
        collateralMint: DEVNET_USDC_MINT_KEY,
        market,
        vault,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      }).rpc();
      setSignature(tx);
      router.push(`/markets/${market.toBase58()}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Market transaction failed");
    } finally {
      setSubmitting(false);
    }
  };

  const unavailable = !protocolStatus.program || !protocolStatus.protocol;
  return (
    <div className="create-market-layout">
      <section className="create-form-card">
        <div className="form-section-heading"><span>01</span><div><strong>Resolution source</strong><p>Choose a connected adapter and covered event.</p></div></div>
        <div className="resolver-choice active"><span><Radio size={18} /></span><div><strong>TxLINE Sports</strong><p>Signed score data validated through the TxLINE Solana program.</p></div><b>CONNECTED</b></div>
        <label className="create-field"><span>Covered fixture</span><select value={fixtureId} onChange={(event) => setFixtureId(Number(event.target.value))}>{fixtures.map((item) => <option value={item.id} key={item.id}>{item.label} - {item.group}</option>)}</select></label>
        <div className="form-section-heading"><span>02</span><div><strong>Market condition</strong><p>The first adapter supports binary total-goals pools.</p></div></div>
        <label className="create-field"><span>Question</span><input value={question} readOnly /></label>
        <div className="create-field-grid"><label className="create-field"><span>Threshold</span><input value={`${displayThreshold} total goals`} readOnly /></label><label className="create-field"><span>Mode</span><select value={mode} onChange={(event) => setMode(event.target.value as "live" | "replay")}><option value="live" disabled={!liveAvailable}>Live fixture{liveAvailable ? "" : " - kickoff passed"}</option><option value="replay">Judge replay</option></select></label></div>
        <div className="form-section-heading"><span>03</span><div><strong>Review and create</strong><p>Your wallet pays account rent and signs the market instruction.</p></div></div>
        <div className="create-review"><div><span>Collateral</span><b>Devnet USDC</b></div><div><span>Ticket</span><b>1.00 USDC</b></div><div><span>Settlement fee</span><b>1% on success</b></div><div><span>Refund fee</span><b>0%</b></div><div><span>Market PDA</span><code>{market ? `${market.toBase58().slice(0, 8)}...${market.toBase58().slice(-8)}` : "Connect wallet to derive"}</code></div></div>
        {!connected ? <button className="create-submit" type="button" onClick={() => setVisible(true)}><Wallet size={16} />Connect wallet to create</button> : <button className="create-submit" type="button" disabled={unavailable || submitting} onClick={() => void submit()}>{submitting ? "Waiting for wallet" : unavailable ? "Deployment configuration required" : "Create market on devnet"}</button>}
        {error && <div className="transaction-message error"><AlertTriangle size={15} /><span>{error}</span></div>}
        {signature && <div className="transaction-message success"><Check size={15} /><span>Market created and confirmed.</span><a href={`https://explorer.solana.com/tx/${signature}?cluster=devnet`} target="_blank" rel="noreferrer">Explorer <ExternalLink size={12} /></a></div>}
      </section>
      <aside className="create-side-card">
        <span className="eyebrow">Creation readiness</span>
        <h2>Every dependency is explicit.</h2>
        <div className="readiness-list"><div className={protocolStatus.txline ? "ready" : "blocked"}><Radio size={15} /><span>TxLINE devnet program</span><b>{protocolStatus.loading ? "Checking" : protocolStatus.txline ? "Ready" : "Unavailable"}</b></div><div className={protocolStatus.program ? "ready" : "blocked"}><ShieldCheck size={15} /><span>Nortia program</span><b>{protocolStatus.loading ? "Checking" : protocolStatus.program ? "Ready" : "Not deployed"}</b></div><div className={protocolStatus.protocol ? "ready" : "blocked"}><CircleDollarSign size={15} /><span>Protocol security config</span><b>{protocolStatus.protocol ? "Pinned" : "Not initialized"}</b></div></div>
        <div className="creation-rule"><Clock3 size={16} /><p>Live markets lock at fixture start. Replay markets use a short future lock so judges can exercise the complete placement path.</p></div>
        <div className="creation-rule"><AlertTriangle size={16} /><p>Only TxLINE sports is enabled. Other categories require a reviewed resolver adapter before they can accept collateral.</p></div>
      </aside>
    </div>
  );
}

"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { AlertTriangle, Check, EyeOff, Info, LockKeyhole, ShieldCheck, Sparkles, Wallet } from "lucide-react";
import { useState } from "react";
import type { Market } from "@/lib/markets";
import { canPlaceOrder, tradingStateLabel } from "@/lib/markets";
import { savePrivatePosition, type PrivatePosition } from "@/lib/positions";
import { vaultPda } from "@/lib/solana/pdas";
import { useNortiaProgram, useProtocolStatus } from "@/lib/solana/use-nortia-program";

type Side = "yes" | "no";
type SubmissionState = "idle" | "proving" | "signing" | "committee" | "complete";

type ProofResponse = {
  commitment: string;
  shareCommitments: string[];
  proof: string;
  publicWitness: string;
  recovery: { secret: string; nullifier: string };
  shares: Array<{
    memberIndex: number;
    share: string;
    salt: string;
    expectedShareCommitment: string;
  }>;
  error?: string;
};

function fieldBytes(value: string) {
  const hex = value.startsWith("0x") ? value.slice(2) : value;
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) throw new Error("Prover returned an invalid field element");
  return Array.from(Uint8Array.from(hex.match(/.{2}/g) ?? [], (byte) => Number.parseInt(byte, 16)));
}

function base64Bytes(value: string) {
  const decoded = window.atob(value);
  return Array.from(Uint8Array.from(decoded, (character) => character.charCodeAt(0)));
}

function decimalField(value: string) {
  return BigInt(value).toString();
}

export function PrivateOrderPanel({ market }: { market: Market }) {
  const [side, setSide] = useState<Side>("yes");
  const [preview, setPreview] = useState(false);
  const [submission, setSubmission] = useState<SubmissionState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [signature, setSignature] = useState<string | null>(null);
  const { connected, publicKey } = useWallet();
  const { setVisible } = useWalletModal();
  const program = useNortiaProgram();
  const protocol = useProtocolStatus();
  const open = canPlaceOrder(market);
  const stateLabel = tradingStateLabel(market);
  const actionable = open && Boolean(market.address && market.marketId);

  const submit = async () => {
    if (!program || !publicKey || !market.address) return;
    setSubmission("proving");
    setError(null);
    setSignature(null);
    try {
      const marketAddress = new PublicKey(market.address);
      const account = await program.account.market.fetch(marketAddress);
      if (!("open" in account.phase) || Date.now() >= account.lockTs.toNumber() * 1_000) {
        throw new Error("The market locked before this order could be prepared");
      }
      const proofResponse = await fetch("/api/proofs/place", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          marketId: account.marketId.toString(),
          ticketAmount: account.ticketAmount.toString(),
          payer: publicKey.toBase58(),
          side: side === "yes",
        }),
      });
      const proof = await proofResponse.json() as ProofResponse;
      if (!proofResponse.ok || proof.error) throw new Error(proof.error ?? "Proof generation failed");
      if (proof.shareCommitments.length !== 3 || proof.shares.length !== 3) throw new Error("Prover returned an incomplete committee payload");

      const committeeShares = proof.shares.map((share) => ({
        memberIndex: share.memberIndex as 1 | 2 | 3,
        share: share.share,
        salt: share.salt,
        expectedShareCommitment: share.expectedShareCommitment,
      }));
      const prepared: PrivatePosition = {
        version: 1,
        marketId: account.marketId.toString(),
        marketAddress: market.address,
        question: market.question,
        side,
        ticketUsdc: 1,
        commitment: proof.commitment,
        secret: proof.recovery.secret,
        nullifier: proof.recovery.nullifier,
        committeeShares,
        createdAt: new Date().toISOString(),
        status: "prepared",
      };
      savePrivatePosition(prepared);

      const commitment = fieldBytes(proof.commitment);
      const payerToken = getAssociatedTokenAddressSync(account.collateralMint, publicKey);
      if (!await program.provider.connection.getAccountInfo(payerToken, "confirmed")) {
        throw new Error("The connected wallet has no devnet USDC token account");
      }
      const order = PublicKey.findProgramAddressSync(
        [Buffer.from("order"), marketAddress.toBuffer(), Buffer.from(commitment)],
        program.programId,
      )[0];
      setSubmission("signing");
      const transactionSignature = await program.methods.placeOrder({
        commitment,
        shareCommitments: proof.shareCommitments.map(fieldBytes) as [number[], number[], number[]],
        proof: base64Bytes(proof.proof),
        publicWitness: base64Bytes(proof.publicWitness),
      }).accountsPartial({
        payer: publicKey,
        market: marketAddress,
        collateralMint: account.collateralMint,
        payerToken,
        order,
        vault: vaultPda(marketAddress),
        placementVerifier: account.placementVerifier,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      }).rpc();
      setSignature(transactionSignature);
      savePrivatePosition({ ...prepared, transactionSignature, status: "open" });
      const placedOrder = await program.account.order.fetch(order);

      setSubmission("committee");
      const delivery = await fetch("/api/committee/shares", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shares: committeeShares.map((share) => ({
            market: market.address,
            orderIndex: placedOrder.orderIndex,
            orderCommitment: decimalField(proof.commitment),
            memberIndex: share.memberIndex,
            share: decimalField(share.share),
            salt: decimalField(share.salt),
            expectedShareCommitment: decimalField(share.expectedShareCommitment),
            placementSignature: transactionSignature,
          })),
        }),
      });
      const result = await delivery.json() as { error?: string };
      if (!delivery.ok) throw new Error(`Order confirmed, but committee delivery failed: ${result.error ?? "unknown error"}`);
      setSubmission("complete");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Private order failed");
      setSubmission("idle");
    }
  };

  const submitLabel = submission === "proving"
    ? "Generating private proof"
    : submission === "signing"
      ? "Waiting for wallet"
      : submission === "committee"
        ? "Delivering committee shares"
        : submission === "complete"
          ? "Order confirmed"
          : "Generate proof and submit";

  return (
    <aside className="order-panel">
      <div className="order-panel-header">
        <div><span className="eyebrow">Private order</span><h2>{open ? "Take a position" : stateLabel}</h2></div>
        <span className="zk-badge"><EyeOff size={13} />ZK</span>
      </div>
      {!open ? (
        <div className="market-closed-state">
          <span><LockKeyhole size={20} /></span>
          <h3>Orders are closed.</h3>
          <p>{market.tradingState === "resolved" || market.tradingState === "closed" ? "This market has resolved. Inspect the receipt or recover a winning position from Portfolio." : "The lock time has passed. No wallet can submit another ticket while batching or settlement is underway."}</p>
          <a href="#proof">Inspect settlement</a>
        </div>
      ) : (
        <>
          <div className="privacy-callout"><LockKeyhole size={16} /><p>Your side is committed before the transaction. The committee receives one encrypted share per member.</p></div>
          <span className="field-label">Outcome</span>
          <div className="outcome-toggle">
            <button type="button" className={side === "yes" ? "yes active" : "yes"} onClick={() => { setSide("yes"); setPreview(false); }}><span>YES</span><b>{market.yes}c</b></button>
            <button type="button" className={side === "no" ? "no active" : "no"} onClick={() => { setSide("no"); setPreview(false); }}><span>NO</span><b>{100 - market.yes}c</b></button>
          </div>
          <div className="consensus-note">Displayed cents are the TxLINE consensus reference, not an executable order-book quote.</div>
          <div className="ticket-field-row"><span>Ticket amount</span><small>Fixed pool entry</small></div>
          <div className="amount-field"><b>1.00</b><span>USDC</span></div>
          <div className="ticket-breakdown">
            <div><span>Position</span><strong>{side.toUpperCase()} - 1 ticket</strong></div>
            <div><span>Pool payout</span><strong>Known after private batch</strong></div>
            <div><span>Protocol fee if settled <Info size={12} /></span><strong>1% of gross pool</strong></div>
            <div className="payout-row"><span>Refund path</span><strong>1.00 USDC - no fee</strong></div>
          </div>
          {!connected ? <button type="button" className="primary-order-button" onClick={() => setVisible(true)}><Wallet size={16} />Connect wallet</button> : !actionable ? <button type="button" className="primary-order-button" disabled><AlertTriangle size={16} />Create this covered fixture onchain first</button> : <button type="button" className="primary-order-button" onClick={() => setPreview(true)}><Sparkles size={16} />Review private order</button>}
          {preview && actionable && (
            <div className="commitment-preview">
              <div className="preview-title"><ShieldCheck size={16} /><div><strong>Order preflight</strong><span>Recovery data is saved locally before signing</span></div></div>
              <div className="preview-step"><Check size={12} />Market is open and before lock time</div>
              <div className="preview-step"><Check size={12} />1.00 USDC ticket and 1% fee cap</div>
              <div className="preview-step"><Check size={12} />Fee-free timeout and cancellation refund</div>
              <button type="button" disabled={!protocol.program || !protocol.protocol || submission !== "idle"} onClick={() => void submit()}>{submitLabel}</button>
              {error && <small className="order-error"><AlertTriangle size={10} />{error}</small>}
              {signature && <a className="order-signature" href={`https://explorer.solana.com/tx/${signature}?cluster=devnet`} target="_blank" rel="noreferrer">View confirmed order</a>}
              {!protocol.program || !protocol.protocol ? <small><AlertTriangle size={10} /> Nortia program and protocol must be deployed before a transaction can be built.</small> : <small>The configured self-hosted prover sees the private input. Run it locally for end-to-end privacy.</small>}
            </div>
          )}
        </>
      )}
    </aside>
  );
}

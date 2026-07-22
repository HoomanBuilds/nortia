"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { ComputeBudgetProgram, PublicKey, SystemProgram } from "@solana/web3.js";
import { Buffer } from "buffer";
import { AlertTriangle, Check, EyeOff, Info, LockKeyhole, ShieldCheck, Sparkles, Wallet } from "lucide-react";
import { useState } from "react";
import { createShamirShare } from "nortia-client/committee";
import { orderCommitment, shareCommitment } from "nortia-client/commitments";
import { UsdcTokenIcon } from "@/components/market-icons";
import { generateBrowserProof, proofMode } from "@/lib/browser-prover";
import { deliverCommitteeShares } from "@/lib/committee-delivery";
import { createPlacementWitness, fieldHex, solanaPublicKeyHash } from "@/lib/crypto";
import type { Market } from "@/lib/markets";
import { canPlaceOrder, tradingStateLabel } from "@/lib/markets";
import { savePrivatePosition, unlockPrivatePositions, type PrivatePosition } from "@/lib/positions";
import { vaultPda } from "@/lib/solana/pdas";
import { useNortiaProgram, useProtocolStatus } from "@/lib/solana/use-nortia-program";

type Side = "yes" | "no";
type SubmissionState = "idle" | "proving" | "signing" | "committee" | "complete";

type ProofResponse = {
  proof: string;
  publicWitness: string;
  error?: string;
};

function fieldBytes(value: string) {
  const hex = value.startsWith("0x") ? value.slice(2) : value;
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) throw new Error("Prover returned an invalid field element");
  return Array.from(Uint8Array.from(hex.match(/.{2}/g) ?? [], (byte) => Number.parseInt(byte, 16)));
}

function base64Bytes(value: string) {
  return Buffer.from(value, "base64");
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
  const { connected, publicKey, signMessage } = useWallet();
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
      if (!signMessage) throw new Error("The connected wallet must support message signing to encrypt private recovery data");
      const marketAddress = new PublicKey(market.address);
      const account = await program.account.market.fetch(marketAddress);
      if (!("open" in account.phase) || Date.now() >= account.lockTs.toNumber() * 1_000) {
        throw new Error("The market locked before this order could be prepared");
      }
      const payerToken = getAssociatedTokenAddressSync(account.collateralMint, publicKey);
      const tokenBalance = await program.provider.connection.getTokenAccountBalance(payerToken, "confirmed").catch(() => null);
      if (!tokenBalance) throw new Error("The connected wallet needs devnet USDC from the Circle faucet");
      if (BigInt(tokenBalance.value.amount) < BigInt(account.ticketAmount.toString())) {
        throw new Error("The connected wallet needs at least 1.00 devnet USDC");
      }
      const owner = publicKey.toBase58();
      const { key: vaultKey } = await unlockPrivatePositions(owner, signMessage);
      const witness = createPlacementWitness();
      const marketId = BigInt(account.marketId.toString());
      const ticketAmount = BigInt(account.ticketAmount.toString());
      const secret = BigInt(witness.secret);
      const nullifier = BigInt(witness.nullifier);
      const coefficient = BigInt(witness.coefficient);
      const shares = [1, 2, 3].map((memberIndex) => createShamirShare(side === "yes", coefficient, memberIndex as 1 | 2 | 3));
      const shareCommitments = shares.map((share, index) => shareCommitment(share, BigInt(witness.salts[index] ?? "0")));
      const commitment = orderCommitment(marketId, ticketAmount, side === "yes", secret, nullifier);
      const commitmentHex = fieldHex(commitment);
      let proof: ProofResponse;
      if (proofMode === "browser") {
        proof = await generateBrowserProof("place_order", {
          market_id: fieldHex(marketId),
          ticket_amount: fieldHex(ticketAmount),
          payer_hash: fieldHex(solanaPublicKeyHash(publicKey.toBytes())),
          commitment: commitmentHex,
          share_commitment_1: fieldHex(shareCommitments[0] ?? 0n),
          share_commitment_2: fieldHex(shareCommitments[1] ?? 0n),
          share_commitment_3: fieldHex(shareCommitments[2] ?? 0n),
          side: side === "yes",
          secret: witness.secret,
          nullifier: witness.nullifier,
          coefficient: witness.coefficient,
          salt_1: witness.salts[0],
          salt_2: witness.salts[1],
          salt_3: witness.salts[2],
        });
      } else {
        const proofResponse = await fetch("/api/proofs/place", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            marketId: account.marketId.toString(),
            ticketAmount: account.ticketAmount.toString(),
            payer: owner,
            side: side === "yes",
            ...witness,
          }),
        });
        proof = await proofResponse.json() as ProofResponse;
        if (!proofResponse.ok || proof.error) throw new Error(proof.error ?? "Proof generation failed");
      }

      const committeeShares = shares.map((share, index) => ({
        memberIndex: (index + 1) as 1 | 2 | 3,
        share: fieldHex(share),
        salt: witness.salts[index] ?? "",
        expectedShareCommitment: fieldHex(shareCommitments[index] ?? 0n),
      }));
      const prepared: PrivatePosition = {
        version: 1,
        owner,
        marketId: account.marketId.toString(),
        marketAddress: market.address,
        question: market.question,
        side,
        ticketUsdc: 1,
        commitment: commitmentHex,
        secret: witness.secret,
        nullifier: witness.nullifier,
        committeeShares,
        createdAt: new Date().toISOString(),
        status: "prepared",
      };
      await savePrivatePosition(prepared, vaultKey);

      const commitmentBytes = fieldBytes(commitmentHex);
      const order = PublicKey.findProgramAddressSync(
        [Buffer.from("order"), marketAddress.toBuffer(), Buffer.from(commitmentBytes)],
        program.programId,
      )[0];
      setSubmission("signing");
      const transactionSignature = await program.methods.placeOrder({
        commitment: commitmentBytes,
        shareCommitments: shareCommitments.map((value) => fieldBytes(fieldHex(value))) as [number[], number[], number[]],
        proof: base64Bytes(proof.proof),
        publicWitness: base64Bytes(proof.publicWitness),
      }).preInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }),
      ]).accountsPartial({
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
      await savePrivatePosition({ ...prepared, transactionSignature, status: "delivery-pending" }, vaultKey);
      const placedOrder = await program.account.order.fetch(order);

      setSubmission("committee");
      await deliverCommitteeShares(committeeShares.map((share) => ({
        market: market.address as string,
        orderIndex: placedOrder.orderIndex,
        orderCommitment: decimalField(commitmentHex),
        memberIndex: share.memberIndex,
        share: decimalField(share.share),
        salt: decimalField(share.salt),
        expectedShareCommitment: decimalField(share.expectedShareCommitment),
        placementSignature: transactionSignature,
      })));
      await savePrivatePosition({ ...prepared, transactionSignature, status: "open", committeeShares: undefined }, vaultKey);
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
          <div className="privacy-callout"><LockKeyhole size={16} /><p>Your side is committed before the transaction. Each committee member receives one independently blinded share.</p></div>
          <span className="field-label">Outcome</span>
          <div className="outcome-toggle">
            <button type="button" className={side === "yes" ? "yes active" : "yes"} onClick={() => { setSide("yes"); setPreview(false); }}><span>YES</span><b>{market.yes}c</b></button>
            <button type="button" className={side === "no" ? "no active" : "no"} onClick={() => { setSide("no"); setPreview(false); }}><span>NO</span><b>{100 - market.yes}c</b></button>
          </div>
          <div className="consensus-note">Displayed cents are the TxLINE consensus reference, not an executable order-book quote.</div>
          <div className="ticket-field-row"><span>Ticket amount</span><small>Fixed pool entry</small></div>
          <div className="amount-field"><b>1.00</b><span><UsdcTokenIcon size={16} />USDC</span></div>
          <div className="ticket-breakdown">
            <div><span>Position</span><strong>{side.toUpperCase()} - 1 ticket</strong></div>
            <div><span>Pool payout</span><strong>Known after private batch</strong></div>
            <div><span>Protocol fee if settled <Info size={12} /></span><strong>1% of gross pool</strong></div>
            <div className="payout-row"><span>Refund path</span><strong>1.00 USDC - no fee</strong></div>
          </div>
          {!connected ? <button type="button" className="primary-order-button" onClick={() => setVisible(true)}><Wallet size={16} />Connect wallet</button> : !actionable ? <button type="button" className="primary-order-button" disabled><AlertTriangle size={16} />Create this covered fixture onchain first</button> : <button type="button" className="primary-order-button" onClick={() => setPreview(true)}><Sparkles size={16} />Review private order</button>}
          <a className="faucet-link" href="https://faucet.circle.com/" target="_blank" rel="noreferrer">Need test collateral? Get Circle devnet USDC</a>
          {preview && actionable && (
            <div className="commitment-preview">
              <div className="preview-title"><ShieldCheck size={16} /><div><strong>Order preflight</strong><span>Recovery data is wallet-encrypted before signing</span></div></div>
              <div className="preview-step"><Check size={12} />Market is open and before lock time</div>
              <div className="preview-step"><Check size={12} />1.00 USDC ticket and 1% fee cap</div>
              <div className="preview-step"><Check size={12} />Fee-free timeout and cancellation refund</div>
              <button type="button" disabled={!protocol.program || !protocol.protocol || submission !== "idle"} onClick={() => void submit()}>{submitLabel}</button>
              {error && <small className="order-error"><AlertTriangle size={10} />{error}</small>}
              {signature && <a className="order-signature" href={`https://explorer.solana.com/tx/${signature}?cluster=devnet`} target="_blank" rel="noreferrer">View confirmed order</a>}
              {!protocol.program || !protocol.protocol ? <small><AlertTriangle size={10} /> Nortia program and protocol must be deployed before a transaction can be built.</small> : proofMode === "browser" ? <small>Your private witness stays in this browser while the zero-knowledge proof is generated.</small> : <small>Hosted proof mode is enabled. The configured prover receives the private witness.</small>}
            </div>
          )}
        </>
      )}
    </aside>
  );
}

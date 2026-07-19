"use client";

import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { formatUsdc } from "nortia-client/economics";
import { AlertTriangle, ArrowUpRight, Clock3, EyeOff, ReceiptText, Wallet } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { HybridPortfolio, type HybridPortfolioSummary } from "@/components/hybrid-portfolio";
import { SolanaNetworkIcon, UsdcTokenIcon } from "@/components/market-icons";
import { RecoveryPanel } from "@/components/recovery-panel";
import { commitmentPath, fieldBigInt, fieldHex } from "@/lib/crypto";
import { loadPrivatePositions, savePrivatePosition, type PrivatePosition } from "@/lib/positions";
import { vaultPda } from "@/lib/solana/pdas";
import { useNortiaProgram } from "@/lib/solana/use-nortia-program";
import { useWalletBalances } from "@/lib/solana/use-wallet-balances";

function bytes32(value: string) {
  const hex = value.startsWith("0x") ? value.slice(2) : value;
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) throw new Error("Position contains an invalid field element");
  return Array.from(Uint8Array.from(hex.match(/.{2}/g) ?? [], (byte) => Number.parseInt(byte, 16)));
}

function base64Bytes(value: string) {
  const decoded = window.atob(value);
  return Array.from(Uint8Array.from(decoded, (character) => character.charCodeAt(0)));
}

export function PortfolioDashboard() {
  const { connected, publicKey } = useWallet();
  const { setVisible } = useWalletModal();
  const program = useNortiaProgram();
  const { balances } = useWalletBalances();
  const [positions, setPositions] = useState<PrivatePosition[]>([]);
  const [pending, setPending] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [hybridSummary, setHybridSummary] = useState<HybridPortfolioSummary>({ loading: false, active: 0, claimable: 0n });

  const replacePosition = useCallback((position: PrivatePosition) => {
    savePrivatePosition(position);
    setPositions((current) => current.map((item) => item.commitment === position.commitment ? position : item));
  }, []);

  useEffect(() => {
    const local = loadPrivatePositions();
    setPositions(local);
    if (!program) return;
    void Promise.all(local.map(async (position) => {
      if (!position.marketAddress || position.status === "claimed" || position.status === "refunded") return position;
      try {
        const account = await program.account.market.fetch(new PublicKey(position.marketAddress));
        const phase = Object.keys(account.phase)[0];
        let status = position.status;
        if (phase === "refunding") status = "refundable";
        else if (phase === "resolved") status = (account.outcome === 1) === (position.side === "yes") ? "claimable" : "lost";
        else if (phase === "open" || phase === "batched") status = "open";
        return { ...position, status } as PrivatePosition;
      } catch {
        return position;
      }
    })).then((next) => {
      next.forEach(savePrivatePosition);
      setPositions(next);
    });
  }, [program]);

  const onRecovered = (position: PrivatePosition) => setPositions((current) => [position, ...current.filter((item) => item.commitment !== position.commitment)]);

  const refund = async (position: PrivatePosition) => {
    if (!program || !publicKey || !position.marketAddress) return;
    setPending(position.commitment);
    setActionError(null);
    try {
      const market = new PublicKey(position.marketAddress);
      const account = await program.account.market.fetch(market);
      const commitment = bytes32(position.commitment);
      const order = PublicKey.findProgramAddressSync([Buffer.from("order"), market.toBuffer(), Buffer.from(commitment)], program.programId)[0];
      const payerToken = getAssociatedTokenAddressSync(account.collateralMint, publicKey);
      const signature = await program.methods.refundOrder().accountsPartial({
        payer: publicKey,
        market,
        collateralMint: account.collateralMint,
        order,
        vault: vaultPda(market),
        payerToken,
        tokenProgram: TOKEN_PROGRAM_ID,
      }).rpc();
      replacePosition({ ...position, status: "refunded", settlementSignature: signature });
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Refund failed");
    } finally {
      setPending(null);
    }
  };

  const redeem = async (position: PrivatePosition) => {
    if (!program || !publicKey || !position.marketAddress) return;
    setPending(position.commitment);
    setActionError(null);
    try {
      const market = new PublicKey(position.marketAddress);
      const account = await program.account.market.fetch(market);
      if (!("resolved" in account.phase)) throw new Error("Market is not ready for redemption");
      const orders = (await program.account.order.all())
        .filter((item) => item.account.market.equals(market))
        .sort((left, right) => left.account.orderIndex - right.account.orderIndex);
      const leaves = orders.map((item) => fieldBigInt(item.account.commitment));
      const commitment = fieldBigInt(position.commitment);
      const index = leaves.findIndex((value) => value === commitment);
      const path = commitmentPath(leaves, index);
      const expectedRoot = fieldBigInt(account.commitmentRoot);
      if (path.root !== expectedRoot) throw new Error("Local commitment path does not match the onchain batch root");

      const response = await fetch("/api/proofs/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          marketId: account.marketId.toString(),
          ticketAmount: account.ticketAmount.toString(),
          commitmentRoot: fieldHex(expectedRoot),
          outcome: account.outcome === 1,
          recipient: publicKey.toBase58(),
          payoutAmount: account.payoutAmount.toString(),
          side: position.side === "yes",
          secret: position.secret,
          nullifier: position.nullifier,
          pathBits: path.pathBits,
          siblings: path.siblings.map(fieldHex),
        }),
      });
      const proof = await response.json() as { nullifierHash?: string; proof?: string; publicWitness?: string; error?: string };
      if (!response.ok || !proof.nullifierHash || !proof.proof || !proof.publicWitness) throw new Error(proof.error ?? "Redeem proof generation failed");
      const nullifierHash = bytes32(proof.nullifierHash);
      const claim = PublicKey.findProgramAddressSync([Buffer.from("claim"), market.toBuffer(), Buffer.from(nullifierHash)], program.programId)[0];
      const recipientToken = getAssociatedTokenAddressSync(account.collateralMint, publicKey);
      const signature = await program.methods.redeem({
        nullifierHash,
        proof: base64Bytes(proof.proof),
        publicWitness: base64Bytes(proof.publicWitness),
      }).accountsPartial({
        relayer: publicKey,
        market,
        collateralMint: account.collateralMint,
        claim,
        vault: vaultPda(market),
        recipientOwner: publicKey,
        recipientToken,
        redeemVerifier: account.redeemVerifier,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      }).preInstructions([
        createAssociatedTokenAccountIdempotentInstruction(
          publicKey,
          recipientToken,
          publicKey,
          account.collateralMint,
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID,
        ),
      ]).rpc();
      replacePosition({ ...position, status: "claimed", settlementSignature: signature });
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Redemption failed");
    } finally {
      setPending(null);
    }
  };

  return (
    <>
      <div className="portfolio-stats">
        <div><span><UsdcTokenIcon size={14} />Connected balance</span><strong>{connected && balances ? balances.usdc.toFixed(2) : "--"} <small>USDC</small></strong></div>
        <div><span>Active positions</span><strong>{hybridSummary.loading ? "--" : hybridSummary.active}</strong></div>
        <div><span><UsdcTokenIcon size={14} />Claimable</span><strong>{hybridSummary.loading ? "--" : formatUsdc(hybridSummary.claimable)} <small>USDC</small></strong></div>
        <div><span><SolanaNetworkIcon size={14} />Wallet</span><strong className="network-value">{publicKey ? `${publicKey.toBase58().slice(0, 4)}...${publicKey.toBase58().slice(-4)}` : "Not connected"}</strong></div>
      </div>
      {!connected && (
        <section className="wallet-gate">
          <span><Wallet size={20} /></span>
          <div><strong>Connect your Solana wallet</strong><p>Balances and transaction-linked positions are loaded only after connection. Private recovery remains local.</p></div>
          <button type="button" onClick={() => setVisible(true)}>Connect wallet</button>
        </section>
      )}
      <HybridPortfolio onSummary={setHybridSummary} />
      <div className="portfolio-grid"><RecoveryPanel onRecovered={onRecovered} /><aside className="portfolio-side"><div className="portfolio-info-card"><span><UsdcTokenIcon size={17} /></span><div><strong>Fee model</strong><p>Each LMSR fill charges a 1% curve fee, split 70% to Nortia and 30% to market liquidity.</p></div></div><div className="portfolio-info-card"><span><ReceiptText size={17} /></span><div><strong>Redeem privately</strong><p>A winning commitment can be redeemed with a fresh address, without linking the payout to the order wallet.</p></div></div><div className="portfolio-info-card"><span><Clock3 size={17} /></span><div><strong>Permissionless fallback</strong><p>Any caller can open refunds after a missed deadline. A keeper is useful, but it is never the only recovery path.</p></div></div></aside></div>
      <section className="empty-positions">
        <div><span>Position</span><span>Market</span><span>Stake</span><span>Status</span></div>
        {positions.length === 0 ? <div className="empty-position-state"><EyeOff size={22} /><h3>No recovered positions</h3><p>Create or open a market, then save the private recovery record before signing.</p><Link href="/markets">Browse markets <ArrowUpRight size={14} /></Link></div> : <div className="position-list">{positions.map((position) => <article key={position.commitment}><strong>{position.side.toUpperCase()}</strong><span>{position.question}</span><b className="asset-value"><UsdcTokenIcon size={14} />{position.ticketUsdc.toFixed(2)} USDC</b><em>{position.status}{position.status === "claimable" && <button type="button" disabled={!connected || pending === position.commitment} onClick={() => void redeem(position)}>Claim</button>}{position.status === "refundable" && <button type="button" disabled={!connected || pending === position.commitment} onClick={() => void refund(position)}>Refund</button>}</em></article>)}</div>}
      </section>
      {actionError && <div className="portfolio-action-error"><AlertTriangle size={14} />{actionError}</div>}
    </>
  );
}

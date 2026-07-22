"use client";

import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import { Buffer } from "buffer";
import { nullifierHash as computeNullifierHash } from "nortia-client/commitments";
import { calculatePrivatePayout, formatUsdc } from "nortia-client/economics";
import { AlertTriangle, ArrowUpRight, Clock3, EyeOff, KeyRound, ReceiptText, Wallet } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { HybridPortfolio, type HybridPortfolioSummary } from "@/components/hybrid-portfolio";
import { UsdcTokenIcon } from "@/components/market-icons";
import { RecoveryPanel } from "@/components/recovery-panel";
import { generateBrowserProof, proofMode } from "@/lib/browser-prover";
import { deliverCommitteeShares } from "@/lib/committee-delivery";
import { commitmentPath, fieldBigInt, fieldHex, solanaPublicKeyHash } from "@/lib/crypto";
import { exportPrivatePositionVault, importPrivatePositionVault, loadPrivatePositions, savePrivatePosition, unlockPrivatePositions, type PrivatePosition } from "@/lib/positions";
import { vaultPda } from "@/lib/solana/pdas";
import { useNortiaProgram } from "@/lib/solana/use-nortia-program";
import { useWalletBalances } from "@/lib/solana/use-wallet-balances";

function bytes32(value: string) {
  const hex = value.startsWith("0x") ? value.slice(2) : value;
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) throw new Error("Position contains an invalid field element");
  return Array.from(Uint8Array.from(hex.match(/.{2}/g) ?? [], (byte) => Number.parseInt(byte, 16)));
}

export function PortfolioDashboard() {
  const { connected, publicKey, signMessage } = useWallet();
  const { setVisible } = useWalletModal();
  const program = useNortiaProgram();
  const { balances } = useWalletBalances();
  const [positions, setPositions] = useState<PrivatePosition[]>([]);
  const [vaultKey, setVaultKey] = useState<CryptoKey | null>(null);
  const [vaultState, setVaultState] = useState<"locked" | "unlocking" | "unlocked">("locked");
  const [vaultError, setVaultError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [payoutRecipient, setPayoutRecipient] = useState("");
  const [hybridSummary, setHybridSummary] = useState<HybridPortfolioSummary>({ loading: false, active: 0, claimable: 0n, value: 0n, pnl: 0n });

  const replacePosition = useCallback(async (position: PrivatePosition) => {
    if (!vaultKey) throw new Error("Unlock the private position vault first");
    await savePrivatePosition(position, vaultKey);
    setPositions((current) => current.map((item) => item.commitment === position.commitment ? position : item));
  }, [vaultKey]);

  const unlockVault = useCallback(async () => {
    if (!publicKey || !signMessage) {
      setVaultError("The connected wallet must support message signing");
      return;
    }
    setVaultState("unlocking");
    setVaultError(null);
    try {
      const unlocked = await unlockPrivatePositions(publicKey.toBase58(), signMessage);
      setVaultKey(unlocked.key);
      setPositions(unlocked.positions);
      setVaultState("unlocked");
    } catch (error) {
      setVaultError(error instanceof Error ? error.message : "Private vault unlock failed");
      setVaultState("locked");
    }
  }, [publicKey, signMessage]);

  useEffect(() => {
    setVaultKey(null);
    setPositions([]);
    setVaultState("locked");
    setVaultError(null);
    setPayoutRecipient("");
  }, [publicKey]);

  useEffect(() => {
    if (!program || !publicKey || !vaultKey) return;
    let cancelled = false;
    void loadPrivatePositions(publicKey.toBase58(), vaultKey).then(async (local) => {
      const next = await Promise.all(local.map(async (position) => {
      if (!position.marketAddress || position.status === "claimed" || position.status === "refunded") return position;
      try {
        const account = await program.account.market.fetch(new PublicKey(position.marketAddress));
        const phase = Object.keys(account.phase)[0];
        let status = position.status;
        if (phase === "refunding") status = "refundable";
        else if (phase === "resolved") status = "claimable";
        else if (phase === "open" || phase === "batched") {
          status = !position.transactionSignature
            ? "prepared"
            : position.committeeShares?.length === 3
              ? "delivery-pending"
              : "open";
        }
        return { ...position, status } as PrivatePosition;
      } catch {
        return position;
      }
      }));
      await Promise.all(next.map((position) => savePrivatePosition(position, vaultKey)));
      if (!cancelled) setPositions(next);
    });
    return () => { cancelled = true; };
  }, [program, publicKey, vaultKey]);

  const onRecovered = (position: PrivatePosition) => setPositions((current) => [position, ...current.filter((item) => item.commitment !== position.commitment)]);

  const exportVault = async () => {
    if (!publicKey || !vaultKey) throw new Error("Unlock the private position vault first");
    const backup = await exportPrivatePositionVault(publicKey.toBase58(), vaultKey);
    const url = URL.createObjectURL(new Blob([backup], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `nortia-private-positions-${publicKey.toBase58().slice(0, 8)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const importVault = async (file: File) => {
    if (!publicKey || !vaultKey) throw new Error("Unlock the private position vault first");
    if (file.size > 5 * 1024 * 1024) throw new Error("Private position backup exceeds 5 MB");
    const imported = await importPrivatePositionVault(publicKey.toBase58(), vaultKey, await file.text());
    setPositions(imported);
    return imported.length;
  };

  const refund = async (position: PrivatePosition) => {
    if (!program || !publicKey || !position.marketAddress) return;
    setPending(position.commitment);
    setActionError(null);
    try {
      if (position.owner !== publicKey.toBase58()) throw new Error("Connect the wallet that placed this order to receive its refund");
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
      await replacePosition({ ...position, status: "refunded", settlementSignature: signature });
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Refund failed");
    } finally {
      setPending(null);
    }
  };

  const retryCommitteeDelivery = async (position: PrivatePosition) => {
    if (!program || !position.marketAddress || !position.transactionSignature || position.committeeShares?.length !== 3) return;
    setPending(position.commitment);
    setActionError(null);
    try {
      const market = new PublicKey(position.marketAddress);
      const commitment = bytes32(position.commitment);
      const orderAddress = PublicKey.findProgramAddressSync(
        [Buffer.from("order"), market.toBuffer(), Buffer.from(commitment)],
        program.programId,
      )[0];
      const order = await program.account.order.fetch(orderAddress);
      await deliverCommitteeShares(position.committeeShares.map((share) => ({
        market: position.marketAddress as string,
        orderIndex: order.orderIndex,
        orderCommitment: BigInt(position.commitment).toString(),
        memberIndex: share.memberIndex,
        sideShare: BigInt(share.sideShare).toString(),
        yesAmountShare: BigInt(share.yesAmountShare).toString(),
        totalAmountShare: BigInt(share.totalAmountShare).toString(),
        salt: BigInt(share.salt).toString(),
        expectedShareCommitment: BigInt(share.expectedShareCommitment).toString(),
        placementSignature: position.transactionSignature as string,
      })));
      await replacePosition({ ...position, status: "open", committeeShares: undefined });
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Committee delivery failed");
    } finally {
      setPending(null);
    }
  };

  const redeem = async (position: PrivatePosition) => {
    if (!program || !publicKey || !position.marketAddress) return;
    setPending(position.commitment);
    setActionError(null);
    try {
      const recipient = new PublicKey(payoutRecipient.trim());
      if (!PublicKey.isOnCurve(recipient.toBytes())) throw new Error("Fresh payout recipient must be a wallet address");
      if (recipient.equals(publicKey)) throw new Error("Use a fresh payout wallet that differs from the order wallet");
      const market = new PublicKey(position.marketAddress);
      const account = await program.account.market.fetch(market);
      if (!("resolved" in account.phase)) throw new Error("Market is not ready for redemption");
      const orders = (await program.account.order.all())
        .filter((item) => item.account.market.equals(market))
        .sort((left, right) => left.account.orderIndex - right.account.orderIndex);
      const leaves = orders.map((item) => fieldBigInt(item.account.commitment));
      const commitment = fieldBigInt(position.commitment);
      const index = leaves.findIndex((value) => value === commitment);
      if (index < 0) throw new Error("Private position commitment is missing from this market");
      const path = commitmentPath(leaves, index);
      const expectedRoot = fieldBigInt(account.commitmentRoot);
      if (path.root !== expectedRoot) throw new Error("Local commitment path does not match the onchain batch root");
      const marketId = BigInt(account.marketId.toString());
      const stakeAmount = BigInt(account.stakeAmount.toString());
      const amount = BigInt(position.amount);
      if (BigInt(position.stakeAmount) !== stakeAmount) throw new Error("Private position collateral does not match this market");
      const netPool = BigInt(account.netPool.toString());
      const winningAmount = account.outcome === 1
        ? BigInt(account.yesAmount.toString())
        : BigInt(account.noAmount.toString());
      const winner = (position.side === "yes") === (account.outcome === 1);
      const payoutAmount = calculatePrivatePayout(stakeAmount, amount, winner, netPool, winningAmount).payoutAmount;
      const nullifierValue = computeNullifierHash(marketId, BigInt(position.nullifier));
      const nullifierHex = fieldHex(nullifierValue);
      let proof: { proof?: string; publicWitness?: string; nullifierHash?: string; error?: string };
      if (proofMode === "browser") {
        proof = await generateBrowserProof("redeem", {
          market_id: fieldHex(marketId),
          stake_amount: fieldHex(stakeAmount),
          commitment_root: fieldHex(expectedRoot),
          outcome: account.outcome === 1,
          nullifier_hash: nullifierHex,
          recipient_hash: fieldHex(solanaPublicKeyHash(recipient.toBytes())),
          net_pool: fieldHex(netPool),
          winning_amount: fieldHex(winningAmount),
          payout_amount: fieldHex(payoutAmount),
          side: position.side === "yes",
          amount: position.amount,
          secret: position.secret,
          nullifier: position.nullifier,
          path_bits: path.pathBits,
          siblings: path.siblings.map(fieldHex),
        });
      } else {
        const response = await fetch("/api/proofs/redeem", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            marketId: account.marketId.toString(),
            stakeAmount: stakeAmount.toString(),
            amount: position.amount,
            commitmentRoot: fieldHex(expectedRoot),
            outcome: account.outcome === 1,
            recipient: recipient.toBase58(),
            netPool: netPool.toString(),
            winningAmount: winningAmount.toString(),
            payoutAmount: payoutAmount.toString(),
            side: position.side === "yes",
            secret: position.secret,
            nullifier: position.nullifier,
            pathBits: path.pathBits,
            siblings: path.siblings.map(fieldHex),
          }),
        });
        proof = await response.json() as typeof proof;
        if (!response.ok) throw new Error(proof.error ?? "Redeem proof generation failed");
        if (proof.nullifierHash !== nullifierHex) throw new Error("Hosted prover returned a mismatched nullifier hash");
      }
      if (!proof.proof || !proof.publicWitness) throw new Error(proof.error ?? "Redeem proof generation failed");
      const response = await fetch("/api/redeem/relay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          market: market.toBase58(),
          recipient: recipient.toBase58(),
          nullifierHash: nullifierHex,
          payoutAmount: payoutAmount.toString(),
          proof: proof.proof,
          publicWitness: proof.publicWitness,
        }),
      });
      const relay = await response.json() as { signature?: string; error?: string };
      if (!response.ok || !relay.signature) throw new Error(relay.error ?? "Private relay rejected the redemption");
      const signature = relay.signature;
      await replacePosition({ ...position, status: "claimed", settlementSignature: signature });
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
        <div><span><UsdcTokenIcon size={14} />Portfolio value</span><strong>{hybridSummary.loading ? "--" : formatUsdc(hybridSummary.value)} <small>USDC</small></strong></div>
        <div><span>Total profit and loss</span><strong className={hybridSummary.pnl >= 0n ? "positive" : "negative"}>{hybridSummary.loading ? "--" : `${hybridSummary.pnl >= 0n ? "+" : "-"}${formatUsdc(hybridSummary.pnl >= 0n ? hybridSummary.pnl : -hybridSummary.pnl)}`} <small>USDC</small></strong></div>
        <div><span><UsdcTokenIcon size={14} />Claimable</span><strong>{hybridSummary.loading ? "--" : formatUsdc(hybridSummary.claimable)} <small>USDC</small></strong></div>
      </div>
      {!connected && (
        <section className="wallet-gate">
          <span><Wallet size={20} /></span>
          <div><strong>Connect your Solana wallet</strong><p>Balances and transaction-linked positions are loaded only after connection. Private recovery remains local.</p></div>
          <button type="button" onClick={() => setVisible(true)}>Connect wallet</button>
        </section>
      )}
      {connected && vaultState !== "unlocked" && (
        <section className="wallet-gate">
          <span><KeyRound size={20} /></span>
          <div><strong>Unlock encrypted private positions</strong><p>Sign a read-only message to decrypt this wallet's local recovery vault. The signature cannot move funds.</p></div>
          <button type="button" disabled={vaultState === "unlocking" || !signMessage} onClick={() => void unlockVault()}>{vaultState === "unlocking" ? "Waiting for signature" : "Unlock vault"}</button>
        </section>
      )}
      {vaultError && <div className="portfolio-action-error"><AlertTriangle size={14} />{vaultError}</div>}
      <HybridPortfolio onSummary={setHybridSummary} />
      {vaultState === "unlocked" && (
        <div className="portfolio-grid">
          <RecoveryPanel positions={positions} onRecovered={onRecovered} onExport={exportVault} onImport={importVault} />
          <aside className="portfolio-side">
            <div className="portfolio-info-card"><span><UsdcTokenIcon size={17} /></span><div><strong>Fee model</strong><p>Each LMSR fill uses an immutable base rate up to 1%. The effective fee is probability-sensitive and splits 70% to Nortia and 30% to market liquidity.</p></div></div>
            <div className="portfolio-info-card private-recipient-card">
              <span><ReceiptText size={17} /></span>
              <div>
                <strong>Fresh payout wallet</strong>
                <p>The browser binds your claim to this address. Nortia&apos;s relay submits it without exposing your order wallet on the redemption transaction.</p>
                <input value={payoutRecipient} onChange={(event) => setPayoutRecipient(event.target.value)} placeholder="Fresh Solana wallet address" spellCheck={false} />
              </div>
            </div>
            <div className="portfolio-info-card"><span><Clock3 size={17} /></span><div><strong>Permissionless fallback</strong><p>Any caller can open refunds after a missed deadline. A keeper is useful, but it is never the only recovery path.</p></div></div>
          </aside>
        </div>
      )}
      <section className="empty-positions">
        <div><span>Position</span><span>Market</span><span>Hidden wager</span><span>Status</span></div>
        {vaultState !== "unlocked" ? <div className="empty-position-state"><KeyRound size={22} /><h3>Private vault locked</h3><p>Unlock with the connected wallet to decrypt private positions.</p></div> : positions.length === 0 ? <div className="empty-position-state"><EyeOff size={22} /><h3>No recovered positions</h3><p>Create or open a market. Nortia encrypts the recovery record before the order is signed.</p><Link href="/markets">Browse markets <ArrowUpRight size={14} /></Link></div> : <div className="position-list">{positions.map((position) => <article key={position.commitment}><strong>{position.side.toUpperCase()}</strong><span>{position.question}</span><b className="asset-value"><UsdcTokenIcon size={14} />{formatUsdc(BigInt(position.amount))} USDC</b><em>{position.status}{position.status === "delivery-pending" && <button type="button" disabled={pending === position.commitment} onClick={() => void retryCommitteeDelivery(position)}>Deliver shares</button>}{position.status === "claimable" && <button type="button" disabled={!connected || !payoutRecipient.trim() || pending === position.commitment} onClick={() => void redeem(position)}>Settle privately</button>}{position.status === "refundable" && <button type="button" disabled={!connected || pending === position.commitment} onClick={() => void refund(position)}>Refund</button>}</em></article>)}</div>}
      </section>
      {actionError && <div className="portfolio-action-error"><AlertTriangle size={14} />{actionError}</div>}
    </>
  );
}

"use client";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { PublicKey, SystemProgram, type Transaction } from "@solana/web3.js";
import { formatUsdc } from "nortia-client/economics";
import { normalizeEvidenceUri, optimisticEvidenceHash } from "nortia-client/optimistic";
import {
  hybridVaultPda,
  optimisticBondVaultPda,
  optimisticProposalPda,
  resolutionReceiptPda,
} from "nortia-client/market-engine";
import {
  AlertTriangle,
  ArrowUpRight,
  Check,
  Clock3,
  ExternalLink,
  Gavel,
  RefreshCw,
  Scale,
  ShieldAlert,
  Wallet,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { UsdcTokenIcon } from "@/components/market-icons";
import type { Market } from "@/lib/markets";
import { translateNortiaError } from "@/lib/solana/errors";
import { useNortiaProgram } from "@/lib/solana/use-nortia-program";

type IntegerLike = { toString(): string; toNumber(): number };

type HybridMarketAccount = {
  collateralMint: PublicKey;
  treasuryOwner: PublicKey;
  oracleConfig: PublicKey;
  phase: Record<string, unknown>;
  resolveNotBeforeTs: IntegerLike;
  resolutionDeadlineTs: IntegerLike;
};

type OracleAccount = {
  bondAmount: IntegerLike;
  optimisticProposal: PublicKey;
};

type ProposalAccount = {
  proposer: PublicKey;
  proposedOutcome: number;
  assertionHash: number[];
  assertionEvidenceUri: string;
  proposedAt: IntegerLike;
  challengeDeadline: IntegerLike;
  challenger: PublicKey;
  challengedOutcome: number;
  challengeHash: number[];
  challengeEvidenceUri: string;
  bondAmount: IntegerLike;
  proposerPayout: IntegerLike;
  challengerPayout: IntegerLike;
  treasuryPayout: IntegerLike;
  proposerClaimed: boolean;
  challengerClaimed: boolean;
  treasuryClaimed: boolean;
  finalized: boolean;
  winner: PublicKey;
};

type PanelState = {
  market: HybridMarketAccount;
  oracle: OracleAccount;
  proposal: ProposalAccount | null;
  balance: bigint;
};

type Stage = "idle" | "signing" | "confirming";

function enumName(value: Record<string, unknown>): string {
  return (Object.keys(value)[0] ?? "").replaceAll("_", "").toLowerCase();
}

function outcomeLabel(value: number): string {
  return value === 1 ? "YES" : value === 0 ? "NO" : "UNSET";
}

function evidenceLink(value: string): string {
  if (value.startsWith("ipfs://")) return `https://ipfs.io/ipfs/${value.slice(7)}`;
  if (value.startsWith("ar://")) return `https://arweave.net/${value.slice(5)}`;
  return value;
}

function shortHash(value: number[]): string {
  const hash = Buffer.from(value).toString("hex");
  return `${hash.slice(0, 10)}...${hash.slice(-10)}`;
}

export function OptimisticResolutionPanel({ market }: { market: Market }) {
  const program = useNortiaProgram();
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const { setVisible } = useWalletModal();
  const [state, setState] = useState<PanelState | null>(null);
  const [outcome, setOutcome] = useState<0 | 1>(1);
  const [evidenceUri, setEvidenceUri] = useState("");
  const [stage, setStage] = useState<Stage>("idle");
  const [loading, setLoading] = useState(false);
  const [signature, setSignature] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const address = useMemo(() => new PublicKey(market.address ?? PublicKey.default), [market.address]);
  const proposalAddress = useMemo(() => optimisticProposalPda(address), [address]);

  const refresh = useCallback(async () => {
    if (!program) return;
    setLoading(true);
    try {
      const marketAccount = await program.account.hybridMarket.fetch(address) as HybridMarketAccount;
      const [oracle, proposal, balance] = await Promise.all([
        program.account.oracleConfig.fetch(marketAccount.oracleConfig) as Promise<OracleAccount>,
        program.account.optimisticProposal.fetchNullable(proposalAddress) as Promise<ProposalAccount | null>,
        publicKey
          ? connection.getTokenAccountBalance(
            getAssociatedTokenAddressSync(marketAccount.collateralMint, publicKey),
            "confirmed",
          ).catch(() => null)
          : Promise.resolve(null),
      ]);
      setState({ market: marketAccount, oracle, proposal, balance: balance ? BigInt(balance.value.amount) : 0n });
    } catch (cause) {
      console.error("optimistic resolver refresh failed", cause);
      setError(translateNortiaError(cause));
    } finally {
      setLoading(false);
    }
  }, [address, connection, program, proposalAddress, publicKey]);

  useEffect(() => {
    void refresh();
    if (!program) return;
    const timer = window.setInterval(() => void refresh(), 4_000);
    return () => window.clearInterval(timer);
  }, [program, refresh]);

  const sendAndConfirm = async (transaction: Transaction) => {
    if (!publicKey) throw new Error("Connect a wallet before submitting resolver evidence");
    const latest = await connection.getLatestBlockhash("confirmed");
    transaction.feePayer = publicKey;
    transaction.recentBlockhash = latest.blockhash;
    setStage("signing");
    const nextSignature = await sendTransaction(transaction, connection, {
      preflightCommitment: "confirmed",
      skipPreflight: false,
    });
    setStage("confirming");
    const confirmation = await connection.confirmTransaction(
      { signature: nextSignature, ...latest },
      "confirmed",
    );
    if (confirmation.value.err) throw new Error("Transaction confirmation failed");
    setSignature(nextSignature);
  };

  const run = async (build: () => Promise<Transaction>) => {
    setError(null);
    setSignature(null);
    try {
      await sendAndConfirm(await build());
      setEvidenceUri("");
      await refresh();
    } catch (cause) {
      console.error("optimistic resolver transaction failed", cause);
      setError(translateNortiaError(cause));
    } finally {
      setStage("idle");
    }
  };

  const propose = () => run(async () => {
    if (!program || !publicKey || !state) throw new Error("AccountNotInitialized");
    const uri = normalizeEvidenceUri(evidenceUri);
    const proposerToken = getAssociatedTokenAddressSync(state.market.collateralMint, publicKey);
    const assertionHash = Array.from(await optimisticEvidenceHash("assertion", address, outcome, uri));
    return program.methods.proposeOptimisticResolution({ outcome, assertionHash, evidenceUri: uri }).accountsPartial({
      proposer: publicKey,
      market: address,
      oracleConfig: state.market.oracleConfig,
      proposal: proposalAddress,
      bondVault: optimisticBondVaultPda(address),
      collateralMint: state.market.collateralMint,
      proposerToken,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    }).preInstructions([
      createAssociatedTokenAccountIdempotentInstruction(
        publicKey,
        proposerToken,
        publicKey,
        state.market.collateralMint,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID,
      ),
    ]).transaction();
  });

  const challenge = () => run(async () => {
    if (!program || !publicKey || !state?.proposal) throw new Error("AccountNotInitialized");
    const uri = normalizeEvidenceUri(evidenceUri);
    const challengeOutcome = state.proposal.proposedOutcome === 1 ? 0 : 1;
    const challengerToken = getAssociatedTokenAddressSync(state.market.collateralMint, publicKey);
    const challengeHash = Array.from(await optimisticEvidenceHash("challenge", address, challengeOutcome, uri));
    return program.methods.challengeOptimisticResolution({
      outcome: challengeOutcome,
      challengeHash,
      evidenceUri: uri,
    }).accountsPartial({
      challenger: publicKey,
      market: address,
      oracleConfig: state.market.oracleConfig,
      proposal: proposalAddress,
      bondVault: optimisticBondVaultPda(address),
      collateralMint: state.market.collateralMint,
      challengerToken,
      tokenProgram: TOKEN_PROGRAM_ID,
    }).preInstructions([
      createAssociatedTokenAccountIdempotentInstruction(
        publicKey,
        challengerToken,
        publicKey,
        state.market.collateralMint,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID,
      ),
    ]).transaction();
  });

  const finalize = () => run(async () => {
    if (!program || !publicKey || !state) throw new Error("AccountNotInitialized");
    return program.methods.finalizeOptimisticResolution().accountsPartial({
      keeper: publicKey,
      market: address,
      oracleConfig: state.market.oracleConfig,
      proposal: proposalAddress,
      receipt: resolutionReceiptPda(address),
      vault: hybridVaultPda(address),
      systemProgram: SystemProgram.programId,
    }).transaction();
  });

  const timeoutDispute = () => run(async () => {
    if (!program || !publicKey || !state) throw new Error("AccountNotInitialized");
    return program.methods.timeoutOptimisticDispute().accountsPartial({
      keeper: publicKey,
      market: address,
      oracleConfig: state.market.oracleConfig,
      proposal: proposalAddress,
      receipt: resolutionReceiptPda(address),
      vault: hybridVaultPda(address),
      systemProgram: SystemProgram.programId,
    }).transaction();
  });

  const claim = () => run(async () => {
    if (!program || !publicKey || !state) throw new Error("AccountNotInitialized");
    const destination = getAssociatedTokenAddressSync(state.market.collateralMint, publicKey);
    return program.methods.claimOptimisticBond().accountsPartial({
      claimant: publicKey,
      market: address,
      proposal: proposalAddress,
      bondVault: optimisticBondVaultPda(address),
      collateralMint: state.market.collateralMint,
      destination,
      tokenProgram: TOKEN_PROGRAM_ID,
    }).preInstructions([
      createAssociatedTokenAccountIdempotentInstruction(
        publicKey,
        destination,
        publicKey,
        state.market.collateralMint,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID,
      ),
    ]).transaction();
  });

  const now = Date.now() / 1_000;
  const phase = state ? enumName(state.market.phase) : "loading";
  const proposal = state?.proposal ?? null;
  const bond = BigInt(state?.oracle.bondAmount.toString() ?? "0");
  const canPropose = Boolean(state)
    && !proposal
    && (phase === "open" || phase === "locked")
    && now >= (state?.market.resolveNotBeforeTs.toNumber() ?? Number.MAX_SAFE_INTEGER)
    && now <= (state?.market.resolutionDeadlineTs.toNumber() ?? 0);
  const canChallenge = Boolean(proposal)
    && phase === "resolving"
    && now <= (proposal?.challengeDeadline.toNumber() ?? 0)
    && !proposal?.proposer.equals(publicKey ?? PublicKey.default);
  const canFinalize = Boolean(proposal)
    && phase === "resolving"
    && now > (proposal?.challengeDeadline.toNumber() ?? Number.MAX_SAFE_INTEGER);
  const hardDeadlineElapsed = now > (state?.market.resolutionDeadlineTs.toNumber() ?? Number.MAX_SAFE_INTEGER);
  const canTimeoutDispute = Boolean(proposal) && phase === "disputed" && hardDeadlineElapsed;
  const claimable = publicKey && proposal?.finalized
    ? (proposal.proposer.equals(publicKey) && !proposal.proposerClaimed ? BigInt(proposal.proposerPayout.toString()) : 0n)
      + (proposal.challenger.equals(publicKey) && !proposal.challengerClaimed ? BigInt(proposal.challengerPayout.toString()) : 0n)
      + (state?.market.treasuryOwner.equals(publicKey) && !proposal.treasuryClaimed ? BigInt(proposal.treasuryPayout.toString()) : 0n)
    : 0n;
  const validEvidence = (() => {
    try {
      normalizeEvidenceUri(evidenceUri);
      return true;
    } catch {
      return false;
    }
  })();
  const busy = stage !== "idle";
  const actionText = stage === "signing" ? "Confirm in wallet" : stage === "confirming" ? "Confirming on devnet" : null;

  return (
    <section className="optimistic-panel" id="optimistic-resolution">
      <div className="optimistic-heading"><div><span className="eyebrow"><Scale size={12} />Bonded optimistic resolver</span><h2>Evidence, challenge, settlement.</h2><p>Any wallet can assert a result with a {formatUsdc(bond)} USDC bond. Opposing evidence posted before the deadline moves the market to committee arbitration.</p></div><button type="button" disabled={loading || busy} onClick={() => void refresh()}><RefreshCw size={13} className={loading ? "spin" : ""} />Refresh state</button></div>
      <div className="optimistic-state-grid">
        <div><span>Market phase</span><strong>{phase}</strong></div>
        <div><span>Required bond</span><strong>{formatUsdc(bond)} USDC</strong></div>
        <div><span>Wallet balance</span><strong>{publicKey ? `${formatUsdc(state?.balance ?? 0n)} USDC` : "Connect wallet"}</strong></div>
        <div><span>Hard deadline</span><strong>{state ? new Date(state.market.resolutionDeadlineTs.toNumber() * 1_000).toLocaleString() : "Loading"}</strong></div>
      </div>
      {proposal ? <div className="evidence-ledger">
        <article><span className="evidence-role"><Gavel size={14} />Assertion</span><strong>{outcomeLabel(proposal.proposedOutcome)}</strong><a href={evidenceLink(proposal.assertionEvidenceUri)} target="_blank" rel="noreferrer">{proposal.assertionEvidenceUri}<ExternalLink size={11} /></a><code>{shortHash(proposal.assertionHash)}</code><small>Proposed by {proposal.proposer.toBase58().slice(0, 6)}...{proposal.proposer.toBase58().slice(-6)}</small></article>
        <article className={proposal.challenger.equals(PublicKey.default) ? "empty-evidence" : ""}><span className="evidence-role"><ShieldAlert size={14} />Challenge</span>{proposal.challenger.equals(PublicKey.default) ? <><strong>Open until {new Date(proposal.challengeDeadline.toNumber() * 1_000).toLocaleString()}</strong><small>No opposing bond has been posted.</small></> : <><strong>{outcomeLabel(proposal.challengedOutcome)}</strong><a href={evidenceLink(proposal.challengeEvidenceUri)} target="_blank" rel="noreferrer">{proposal.challengeEvidenceUri}<ExternalLink size={11} /></a><code>{shortHash(proposal.challengeHash)}</code><small>Challenged by {proposal.challenger.toBase58().slice(0, 6)}...{proposal.challenger.toBase58().slice(-6)}</small></>}</article>
      </div> : <div className="no-assertion"><Clock3 size={18} /><div><strong>No assertion posted</strong><p>The market remains locked until valid evidence is bonded or its hard deadline opens invalid refunds.</p></div></div>}
      {(canPropose || canChallenge) && <div className="optimistic-action"><div className="optimistic-outcomes">{canPropose ? <><button type="button" className={outcome === 1 ? "yes active" : "yes"} disabled={busy} onClick={() => setOutcome(1)}>Assert YES</button><button type="button" className={outcome === 0 ? "no active" : "no"} disabled={busy} onClick={() => setOutcome(0)}>Assert NO</button></> : <span>Challenge as {proposal?.proposedOutcome === 1 ? "NO" : "YES"}</span>}</div><label><span>Public evidence URI</span><input value={evidenceUri} disabled={busy} maxLength={160} onChange={(event) => setEvidenceUri(event.target.value)} placeholder="https://official-source.example/result" /></label>{!publicKey ? <button type="button" className="optimistic-submit" onClick={() => setVisible(true)}><Wallet size={14} />Connect wallet</button> : <button type="button" className="optimistic-submit" disabled={busy || !validEvidence || (state?.balance ?? 0n) < bond} onClick={() => void (canPropose ? propose() : challenge())}><UsdcTokenIcon size={14} />{actionText ?? ((state?.balance ?? 0n) < bond ? "Insufficient devnet USDC" : canPropose ? `Post ${outcome === 1 ? "YES" : "NO"} assertion` : "Post opposing challenge")}</button>}</div>}
      {canFinalize && <div className="permissionless-finalize"><div><Check size={16} /><span><strong>{hardDeadlineElapsed ? "Hard deadline elapsed" : "Challenge window complete"}</strong><small>{hardDeadlineElapsed ? "Finalization now resolves invalid, opens share refunds, and returns the proposer bond." : "This unchallenged result can now finalize permissionlessly."}</small></span></div><button type="button" disabled={!publicKey || busy} onClick={() => void finalize()}>{actionText ?? (hardDeadlineElapsed ? "Finalize invalid timeout" : "Finalize result")}</button></div>}
      {phase === "disputed" && <div className="dispute-banner"><ShieldAlert size={16} /><div><strong>{canTimeoutDispute ? "Arbitration deadline elapsed." : "Settlement is paused for arbitration."}</strong><p>{canTimeoutDispute ? "Any wallet can resolve the market invalid and return both participant bonds." : "The 2-of-3 Nortia committee must compare both public evidence items. If no decision arrives before the hard deadline, anyone can resolve invalid and return both bonds."}</p></div>{canTimeoutDispute && <button type="button" disabled={!publicKey || busy} onClick={() => void timeoutDispute()}>{actionText ?? "Resolve invalid timeout"}</button>}</div>}
      {claimable > 0n && <div className="permissionless-finalize"><div><UsdcTokenIcon size={16} /><span><strong>{formatUsdc(claimable)} USDC bond payout</strong><small>The finalized proposal records this wallet as an entitled claimant.</small></span></div><button type="button" disabled={busy} onClick={() => void claim()}>{actionText ?? "Claim bond payout"}</button></div>}
      {error && <div className="portfolio-action-error"><AlertTriangle size={14} />{error}</div>}
      {signature && <a className="optimistic-signature" href={`https://explorer.solana.com/tx/${signature}?cluster=devnet`} target="_blank" rel="noreferrer"><Check size={12} />Confirmed resolver transaction<ArrowUpRight size={11} /></a>}
    </section>
  );
}

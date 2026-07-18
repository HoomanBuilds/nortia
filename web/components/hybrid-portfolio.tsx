"use client";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { PublicKey, type Transaction } from "@solana/web3.js";
import { formatUsdc } from "nortia-client/economics";
import {
  HYBRID_LIQUIDITY_OWNER_OFFSET,
  POSITION_OWNER_OFFSET,
  hybridPositionPayout,
  hybridPositionStatus,
  hybridRealizedPnl,
  withdrawableHybridLiquidity,
  type HybridOutcomeName,
  type HybridPhaseName,
  type HybridPositionStatus,
} from "nortia-client/portfolio";
import { hybridMetadataPda, hybridVaultPda } from "nortia-client/market-engine";
import {
  AlertTriangle,
  ArrowUpRight,
  Check,
  CircleDollarSign,
  RefreshCw,
  ShieldCheck,
  WalletCards,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { translateNortiaError } from "@/lib/solana/errors";
import { useNortiaProgram } from "@/lib/solana/use-nortia-program";

type IntegerLike = { toString(): string; toNumber(): number };

type HybridMarketAccount = {
  marketId: IntegerLike;
  creator: PublicKey;
  liquidityOwner: PublicKey;
  collateralMint: PublicKey;
  questionHash: number[];
  phase: Record<string, unknown>;
  outcome: number;
  yesQuantity: IntegerLike;
  noQuantity: IntegerLike;
  outstandingLiability: IntegerLike;
  lockTs: IntegerLike;
};

type PositionAccount = {
  market: PublicKey;
  owner: PublicKey;
  yesShares: IntegerLike;
  noShares: IntegerLike;
  totalSpent: IntegerLike;
  totalProceeds: IntegerLike;
  settledAmount: IntegerLike;
  settled: boolean;
};

type MetadataAccount = {
  market: PublicKey;
  question: string;
  yesLabel: string;
  noLabel: string;
};

type PositionRow = {
  address: PublicKey;
  marketAddress: PublicKey;
  market: HybridMarketAccount;
  question: string;
  yesLabel: string;
  noLabel: string;
  yesShares: bigint;
  noShares: bigint;
  totalSpent: bigint;
  totalProceeds: bigint;
  settledAmount: bigint;
  payout: bigint;
  pnl: bigint;
  phase: HybridPhaseName;
  outcome: HybridOutcomeName;
  status: HybridPositionStatus;
};

type LiquidityRow = {
  address: PublicKey;
  market: HybridMarketAccount;
  question: string;
  phase: HybridPhaseName;
  withdrawable: bigint;
};

export type HybridPortfolioSummary = {
  loading: boolean;
  active: number;
  claimable: bigint;
};

type PendingAction = {
  key: string;
  stage: "signing" | "confirming";
};

function enumName(value: Record<string, unknown>): string {
  return (Object.keys(value)[0] ?? "").replaceAll("_", "").toLowerCase();
}

function phaseName(value: Record<string, unknown>): HybridPhaseName {
  const phase = enumName(value);
  if (phase === "open" || phase === "locked" || phase === "resolving" || phase === "disputed" || phase === "resolved" || phase === "closed") return phase;
  return "locked";
}

function outcomeName(value: number): HybridOutcomeName {
  return (["no", "yes", "invalid", "unset"] as const)[value] ?? "unset";
}

function signedUsdc(value: bigint): string {
  const sign = value > 0n ? "+" : value < 0n ? "-" : "";
  return `${sign}${formatUsdc(value < 0n ? -value : value)} USDC`;
}

function shortAddress(value: PublicKey): string {
  const address = value.toBase58();
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

function actionLabel(action: PendingAction | null, key: string, fallback: string): string {
  if (action?.key !== key) return fallback;
  return action.stage === "signing" ? "Confirm in wallet" : "Confirming on devnet";
}

export function HybridPortfolio({ onSummary }: { onSummary(summary: HybridPortfolioSummary): void }) {
  const program = useNortiaProgram();
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const [positions, setPositions] = useState<PositionRow[]>([]);
  const [liquidity, setLiquidity] = useState<LiquidityRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [signature, setSignature] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const summary = useMemo<HybridPortfolioSummary>(() => ({
    loading,
    active: positions.filter((position) => position.phase !== "resolved" && position.phase !== "closed").length,
    claimable: positions
      .filter((position) => position.status === "claimable")
      .reduce((total, position) => total + position.payout, 0n),
  }), [loading, positions]);

  useEffect(() => onSummary(summary), [onSummary, summary]);

  const refresh = useCallback(async () => {
    if (!program || !publicKey) {
      setPositions([]);
      setLiquidity([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [positionAccounts, liquidityMarkets] = await Promise.all([
        program.account.position.all([{ memcmp: { offset: POSITION_OWNER_OFFSET, bytes: publicKey.toBase58() } }]),
        program.account.hybridMarket.all([{ memcmp: { offset: HYBRID_LIQUIDITY_OWNER_OFFSET, bytes: publicKey.toBase58() } }]),
      ]);
      const marketAddresses = new Map<string, PublicKey>();
      for (const item of positionAccounts) marketAddresses.set(item.account.market.toBase58(), item.account.market);
      for (const item of liquidityMarkets) marketAddresses.set(item.publicKey.toBase58(), item.publicKey);
      const addresses = [...marketAddresses.values()];
      const [marketAccounts, metadataAccounts] = addresses.length === 0
        ? [[], []]
        : await Promise.all([
          program.account.hybridMarket.fetchMultiple(addresses),
          program.account.hybridMarketMetadata.fetchMultiple(addresses.map((address) => hybridMetadataPda(address))),
        ]);
      const markets = new Map<string, HybridMarketAccount>();
      const metadata = new Map<string, MetadataAccount>();
      addresses.forEach((address, index) => {
        const market = marketAccounts[index] as HybridMarketAccount | null;
        const details = metadataAccounts[index] as MetadataAccount | null;
        if (market) markets.set(address.toBase58(), market);
        if (details?.market.equals(address)) metadata.set(address.toBase58(), details);
      });
      const nextPositions = positionAccounts.flatMap(({ publicKey: positionAddress, account }) => {
        const position = account as PositionAccount;
        const market = markets.get(position.market.toBase58());
        if (!market || !position.owner.equals(publicKey)) return [];
        const phase = phaseName(market.phase);
        const outcome = outcomeName(market.outcome);
        const shares = {
          yesShares: BigInt(position.yesShares.toString()),
          noShares: BigInt(position.noShares.toString()),
        };
        const payout = hybridPositionPayout(shares, outcome);
        const details = metadata.get(position.market.toBase58());
        const totalSpent = BigInt(position.totalSpent.toString());
        const totalProceeds = BigInt(position.totalProceeds.toString());
        return [{
          address: positionAddress,
          marketAddress: position.market,
          market,
          question: details?.question ?? `Onchain market ${market.marketId.toString()}`,
          yesLabel: details?.yesLabel ?? "YES",
          noLabel: details?.noLabel ?? "NO",
          yesShares: shares.yesShares,
          noShares: shares.noShares,
          totalSpent,
          totalProceeds,
          settledAmount: BigInt(position.settledAmount.toString()),
          payout,
          pnl: hybridRealizedPnl({ totalSpent, totalProceeds, payout }),
          phase,
          outcome,
          status: hybridPositionStatus(phase, outcome, position.settled, shares),
        }];
      });
      const vaultBalances = await Promise.all(liquidityMarkets.map(({ publicKey: address }) =>
        connection.getTokenAccountBalance(hybridVaultPda(address), "confirmed").catch(() => null),
      ));
      const nextLiquidity = liquidityMarkets.flatMap(({ publicKey: address, account }, index) => {
        const market = account as HybridMarketAccount;
        if (!market.liquidityOwner.equals(publicKey)) return [];
        const balance = vaultBalances[index];
        const phase = phaseName(market.phase);
        const withdrawable = balance && phase === "resolved"
          ? withdrawableHybridLiquidity(BigInt(balance.value.amount), BigInt(market.outstandingLiability.toString()))
          : 0n;
        return [{
          address,
          market,
          question: metadata.get(address.toBase58())?.question ?? `Onchain market ${market.marketId.toString()}`,
          phase,
          withdrawable,
        }];
      });
      setPositions(nextPositions);
      setLiquidity(nextLiquidity);
    } catch (cause) {
      console.error("hybrid portfolio refresh failed", cause);
      setError(translateNortiaError(cause));
    } finally {
      setLoading(false);
    }
  }, [connection, program, publicKey]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const sendAndConfirm = async (transaction: Transaction, key: string) => {
    if (!publicKey) throw new Error("Connect a wallet before submitting this transaction");
    const latest = await connection.getLatestBlockhash("confirmed");
    transaction.feePayer = publicKey;
    transaction.recentBlockhash = latest.blockhash;
    setPending({ key, stage: "signing" });
    const nextSignature = await sendTransaction(transaction, connection, {
      preflightCommitment: "confirmed",
      skipPreflight: false,
    });
    setPending({ key, stage: "confirming" });
    const confirmation = await connection.confirmTransaction(
      { signature: nextSignature, ...latest },
      "confirmed",
    );
    if (confirmation.value.err) throw new Error("Transaction confirmation failed");
    setSignature(nextSignature);
  };

  const settle = async (position: PositionRow) => {
    if (!program || !publicKey) return;
    const key = `settle:${position.address.toBase58()}`;
    setError(null);
    setSignature(null);
    try {
      const ownerToken = getAssociatedTokenAddressSync(position.market.collateralMint, publicKey);
      const transaction = await program.methods.settleHybridPosition().accountsPartial({
        owner: publicKey,
        market: position.marketAddress,
        position: position.address,
        collateralMint: position.market.collateralMint,
        vault: hybridVaultPda(position.marketAddress),
        ownerToken,
        tokenProgram: TOKEN_PROGRAM_ID,
      }).preInstructions([
        createAssociatedTokenAccountIdempotentInstruction(
          publicKey,
          ownerToken,
          publicKey,
          position.market.collateralMint,
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID,
        ),
      ]).transaction();
      await sendAndConfirm(transaction, key);
      await refresh();
    } catch (cause) {
      console.error("hybrid position settlement failed", cause);
      setError(translateNortiaError(cause));
    } finally {
      setPending(null);
    }
  };

  const withdraw = async (row: LiquidityRow) => {
    if (!program || !publicKey) return;
    const key = `withdraw:${row.address.toBase58()}`;
    setError(null);
    setSignature(null);
    try {
      const liquidityToken = getAssociatedTokenAddressSync(row.market.collateralMint, publicKey);
      const transaction = await program.methods.withdrawHybridLiquidity().accountsPartial({
        liquidityOwner: publicKey,
        market: row.address,
        collateralMint: row.market.collateralMint,
        vault: hybridVaultPda(row.address),
        liquidityToken,
        tokenProgram: TOKEN_PROGRAM_ID,
      }).preInstructions([
        createAssociatedTokenAccountIdempotentInstruction(
          publicKey,
          liquidityToken,
          publicKey,
          row.market.collateralMint,
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID,
        ),
      ]).transaction();
      await sendAndConfirm(transaction, key);
      await refresh();
    } catch (cause) {
      console.error("hybrid liquidity withdrawal failed", cause);
      setError(translateNortiaError(cause));
    } finally {
      setPending(null);
    }
  };

  if (!publicKey) return <section className="hybrid-portfolio"><div className="portfolio-section-heading"><div><span className="eyebrow"><WalletCards size={12} />Public LMSR portfolio</span><h2>Onchain positions</h2><p>Connect a Solana wallet to load its position PDAs, claimable payouts, and creator liquidity.</p></div></div><div className="portfolio-loading"><WalletCards size={18} />Wallet connection required</div></section>;
  return (
    <section className="hybrid-portfolio">
      <div className="portfolio-section-heading">
        <div><span className="eyebrow"><WalletCards size={12} />Public LMSR portfolio</span><h2>Onchain positions</h2><p>Balances, claimable payouts, and profit and loss are derived from your wallet-owned position PDAs.</p></div>
        <button type="button" disabled={loading || pending !== null} onClick={() => void refresh()}><RefreshCw size={13} className={loading ? "spin" : ""} />Refresh</button>
      </div>
      <div className="hybrid-position-table">
        <div className="hybrid-position-head"><span>Market</span><span>Holdings</span><span>Cash flow</span><span>Settlement</span><span>Action</span></div>
        {loading && positions.length === 0 ? <div className="portfolio-loading"><RefreshCw size={18} className="spin" />Reading wallet positions from devnet</div> : positions.length === 0 ? <div className="portfolio-loading"><WalletCards size={18} />No LMSR positions found for this wallet. <Link href="/markets">Browse markets</Link></div> : positions.map((position) => {
          const key = `settle:${position.address.toBase58()}`;
          return <article className="hybrid-position-row" key={position.address.toBase58()}>
            <div><Link href={`/markets/${position.marketAddress.toBase58()}`}>{position.question}</Link><small>{shortAddress(position.marketAddress)}</small></div>
            <div className="position-holdings"><span className="yes">{formatUsdc(position.yesShares)} {position.yesLabel}</span><span className="no">{formatUsdc(position.noShares)} {position.noLabel}</span></div>
            <div><strong>{formatUsdc(position.totalSpent)} USDC spent</strong><small>{formatUsdc(position.totalProceeds)} USDC sold</small></div>
            <div><strong>{position.phase === "resolved" ? `${formatUsdc(position.payout)} USDC` : position.phase}</strong><small className={position.pnl >= 0n ? "positive" : "negative"}>{position.phase === "resolved" ? `${signedUsdc(position.pnl)} final P/L` : `Locks ${new Date(position.market.lockTs.toNumber() * 1_000).toLocaleString()}`}</small></div>
            <div className="portfolio-row-action"><span className={`position-status ${position.status}`}>{position.status}</span>{position.status === "claimable" && <button type="button" disabled={pending !== null} onClick={() => void settle(position)}>{actionLabel(pending, key, `Claim ${formatUsdc(position.payout)} USDC`)}</button>}{position.status === "settled" && <span className="settled-check"><Check size={12} />Paid {formatUsdc(position.settledAmount)}</span>}</div>
          </article>;
        })}
      </div>
      {liquidity.length > 0 && <div className="liquidity-console"><div className="portfolio-section-heading compact"><div><span className="eyebrow"><ShieldCheck size={12} />Creator collateral</span><h2>Liquidity operations</h2><p>Only collateral above unresolved trader liability is withdrawable.</p></div></div>{liquidity.map((row) => {
        const key = `withdraw:${row.address.toBase58()}`;
        return <article key={row.address.toBase58()}><div><Link href={`/markets/${row.address.toBase58()}`}>{row.question}</Link><small>{row.phase} - {shortAddress(row.address)}</small></div><strong>{formatUsdc(row.withdrawable)} USDC available</strong><button type="button" disabled={row.withdrawable === 0n || pending !== null} onClick={() => void withdraw(row)}>{actionLabel(pending, key, row.phase === "resolved" ? "Withdraw surplus" : "Await resolution")}</button></article>;
      })}</div>}
      {error && <div className="portfolio-action-error"><AlertTriangle size={14} />{error}</div>}
      {signature && <a className="portfolio-signature" href={`https://explorer.solana.com/tx/${signature}?cluster=devnet`} target="_blank" rel="noreferrer"><CircleDollarSign size={13} />Confirmed on devnet <ArrowUpRight size={12} /></a>}
    </section>
  );
}

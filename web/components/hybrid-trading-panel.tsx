"use client";

import { BN } from "@anchor-lang/core";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { formatUsdc, parseUsdc } from "nortia-client/economics";
import {
  quoteLmsrBuy,
  quoteLmsrSell,
  type OutcomeSide,
  type TradeQuote,
} from "nortia-client/lmsr";
import { hybridVaultPda, positionPda } from "nortia-client/market-engine";
import {
  AlertTriangle,
  Check,
  Info,
  LockKeyhole,
  RefreshCw,
  Wallet,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { UsdcTokenIcon } from "@/components/market-icons";
import type { Market } from "@/lib/markets";
import { translateNortiaError } from "@/lib/solana/errors";
import { useNortiaProgram } from "@/lib/solana/use-nortia-program";

type Direction = "buy" | "sell";
type TransactionStage = "idle" | "signing" | "confirming";
type SlippageBps = 50 | 100 | 200;

type HybridAccount = {
  collateralMint: PublicKey;
  treasuryOwner: PublicKey;
  liquidityOwner: PublicKey;
  liquidityParameter: { toString(): string };
  yesQuantity: { toString(): string };
  noQuantity: { toString(): string };
  tradeFeeBps: number;
  maxTradeShares: { toString(): string };
  lockTs: { toNumber(): number };
  phase: Record<string, unknown>;
};

type PositionAccount = {
  yesShares: { toString(): string };
  noShares: { toString(): string };
};

function phaseName(value: Record<string, unknown>): string {
  return (Object.keys(value)[0] ?? "").replaceAll("_", "").toLowerCase();
}

function percent(value: bigint): string {
  return `${(Number(value) / 10_000).toFixed(2)}%`;
}

function price(value: bigint): string {
  return `${(Number(value) / 10_000).toFixed(2)}c`;
}

function amountGuard(quote: TradeQuote, slippageBps: number): bigint {
  return quote.direction === "buy"
    ? (quote.totalAmount * BigInt(10_000 + slippageBps) + 9_999n) / 10_000n
    : quote.totalAmount * BigInt(10_000 - slippageBps) / 10_000n;
}

function signedPercentagePoints(value: bigint): string {
  const sign = value > 0n ? "+" : "";
  return `${sign}${(Number(value) / 10_000).toFixed(2)} pts`;
}

function closedStateCopy(market: Market): { title: string; detail: string; action: string; href: string } {
  if (market.tradingState === "resolved") {
    return {
      title: `Outcome finalized ${market.hybrid?.outcome.toUpperCase() ?? ""}`.trim(),
      detail: "Trading has ended. Winning positions can now claim their exact contract payout.",
      action: "Open portfolio",
      href: "/portfolio",
    };
  }
  if (market.tradingState === "closed") {
    return { title: "Settlement complete", detail: "All liabilities and maker surplus have been withdrawn from the market vault.", action: "Inspect receipt", href: "#proof" };
  }
  if (market.tradingState === "resolving") {
    return { title: "Resolution proposed", detail: "The assertion is inside its immutable challenge period. Trading remains disabled.", action: "Inspect evidence", href: "#proof" };
  }
  if (market.tradingState === "disputed") {
    return { title: "Resolution disputed", detail: "Conflicting evidence is awaiting arbitration or the hard-timeout fallback.", action: "Inspect dispute", href: "#proof" };
  }
  return { title: "Trading locked", detail: "The close time has passed. A permissionless keeper can submit valid resolver evidence.", action: "Inspect resolver", href: "#proof" };
}

export function HybridTradingPanel({ market }: { market: Market }) {
  const details = market.hybrid;
  const program = useNortiaProgram();
  const { connection } = useConnection();
  const { connected, publicKey, sendTransaction } = useWallet();
  const { setVisible } = useWalletModal();
  const [side, setSide] = useState<OutcomeSide>("yes");
  const [direction, setDirection] = useState<Direction>("buy");
  const [sharesInput, setSharesInput] = useState("1.00");
  const [slippageBps, setSlippageBps] = useState<SlippageBps>(100);
  const [account, setAccount] = useState<HybridAccount | null>(null);
  const [position, setPosition] = useState<PositionAccount | null>(null);
  const [ownerBalance, setOwnerBalance] = useState<bigint | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [stage, setStage] = useState<TransactionStage>("idle");
  const [signature, setSignature] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const address = useMemo(() => market.address ? new PublicKey(market.address) : null, [market.address]);
  const positionAddress = useMemo(
    () => address && publicKey ? positionPda(address, publicKey) : null,
    [address, publicKey],
  );

  const refresh = useCallback(async () => {
    if (!program || !address || !publicKey || !positionAddress) return;
    setRefreshing(true);
    try {
      const nextAccount = await program.account.hybridMarket.fetch(address) as HybridAccount;
      const nextPosition = await program.account.position.fetchNullable(positionAddress) as PositionAccount | null;
      const ownerToken = getAssociatedTokenAddressSync(nextAccount.collateralMint, publicKey);
      const balance = await connection.getTokenAccountBalance(ownerToken, "confirmed").catch(() => null);
      setAccount(nextAccount);
      setPosition(nextPosition);
      setOwnerBalance(balance ? BigInt(balance.value.amount) : 0n);
    } catch (cause) {
      console.error("hybrid market refresh failed", cause);
      setError(translateNortiaError(cause));
    } finally {
      setRefreshing(false);
    }
  }, [address, connection, positionAddress, program, publicKey]);

  useEffect(() => {
    void refresh();
    if (!program || !publicKey) return;
    const timer = window.setInterval(() => void refresh(), 4_000);
    return () => window.clearInterval(timer);
  }, [program, publicKey, refresh]);

  const quote = useMemo(() => {
    if (!details && !account) return null;
    try {
      const shares = parseUsdc(sharesInput);
      const quantities = {
        yes: BigInt(account?.yesQuantity.toString() ?? details?.yesQuantity ?? "0"),
        no: BigInt(account?.noQuantity.toString() ?? details?.noQuantity ?? "0"),
      };
      const liquidity = BigInt(account?.liquidityParameter.toString() ?? details?.liquidityParameter ?? "0");
      const feeBps = account?.tradeFeeBps ?? details?.tradeFeeBps ?? 0;
      return direction === "buy"
        ? quoteLmsrBuy(quantities, liquidity, side, shares, feeBps)
        : quoteLmsrSell(quantities, liquidity, side, shares, feeBps);
    } catch {
      return null;
    }
  }, [account, details, direction, sharesInput, side]);

  const availableShares = side === "yes"
    ? BigInt(position?.yesShares.toString() ?? "0")
    : BigInt(position?.noShares.toString() ?? "0");
  const open = account
    ? phaseName(account.phase) === "open" && Date.now() < account.lockTs.toNumber() * 1_000
    : market.tradingState === "open" && Date.now() < Date.parse(market.lockAt);
  const insufficientBalance = direction === "buy"
    && quote !== null
    && ownerBalance !== null
    && ownerBalance < quote.totalAmount;
  const insufficientPosition = direction === "sell"
    && quote !== null
    && availableShares < quote.shares;
  const maxTradeShares = BigInt(account?.maxTradeShares.toString() ?? details?.maxTradeShares ?? "0");
  const exceedsTradeLimit = quote !== null && quote.shares > maxTradeShares;
  const selectedProbabilityBefore = quote
    ? side === "yes" ? quote.beforeYesProbability : 1_000_000n - quote.beforeYesProbability
    : 0n;
  const selectedProbabilityAfter = quote
    ? side === "yes" ? quote.afterYesProbability : 1_000_000n - quote.afterYesProbability
    : 0n;
  const potentialProfit = quote?.direction === "buy" ? quote.shares - quote.totalAmount : null;
  const busy = stage !== "idle";
  const closedCopy = closedStateCopy(market);

  const submit = async () => {
    if (!program || !publicKey || !address || !positionAddress || !quote || !account) return;
    setError(null);
    setSignature(null);
    try {
      const current = await program.account.hybridMarket.fetch(address) as HybridAccount;
      if (phaseName(current.phase) !== "open" || Date.now() >= current.lockTs.toNumber() * 1_000) {
        throw new Error("MarketLocked");
      }
      const currentPosition = await program.account.position.fetchNullable(positionAddress) as PositionAccount | null;
      if (direction === "sell") {
        const currentShares = side === "yes"
          ? BigInt(currentPosition?.yesShares.toString() ?? "0")
          : BigInt(currentPosition?.noShares.toString() ?? "0");
        if (currentShares < quote.shares) throw new Error("InsufficientPosition");
      }
      const ownerToken = getAssociatedTokenAddressSync(current.collateralMint, publicKey);
      const treasuryToken = getAssociatedTokenAddressSync(current.collateralMint, current.treasuryOwner);
      const liquidityToken = getAssociatedTokenAddressSync(current.collateralMint, current.liquidityOwner);
      const tokenAccounts = new Map(
        [ownerToken, treasuryToken, liquidityToken].map((token) => [token.toBase58(), token]),
      );
      const setup = [...tokenAccounts.values()].map((token) =>
        createAssociatedTokenAccountIdempotentInstruction(
          publicKey,
          token,
          token.equals(ownerToken)
            ? publicKey
            : token.equals(treasuryToken)
              ? current.treasuryOwner
              : current.liquidityOwner,
          current.collateralMint,
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID,
        ),
      );
      if (!currentPosition) {
        setup.push(await program.methods.initializePosition().accountsPartial({
          owner: publicKey,
          market: address,
          position: positionAddress,
          systemProgram: SystemProgram.programId,
        }).instruction());
      }
      const args = {
        side: side === "yes" ? 1 : 0,
        shares: new BN(quote.shares.toString()),
        amountGuard: new BN(amountGuard(quote, slippageBps).toString()),
        deadlineTs: new BN(Math.floor(Date.now() / 1_000) + 120),
      };
      const builder = direction === "buy"
        ? program.methods.buyHybridShares(args)
        : program.methods.sellHybridShares(args);
      const transaction = await builder.accountsPartial({
        owner: publicKey,
        market: address,
        position: positionAddress,
        collateralMint: current.collateralMint,
        ownerToken,
        vault: hybridVaultPda(address),
        treasuryToken,
        liquidityToken,
        tokenProgram: TOKEN_PROGRAM_ID,
      }).preInstructions(setup).transaction();
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
      await refresh();
    } catch (cause) {
      console.error("hybrid trade failed", cause);
      setError(translateNortiaError(cause));
    } finally {
      setStage("idle");
    }
  };

  if (!details) return null;
  return (
    <aside className="order-panel">
      <div className="order-panel-header">
        <div><span className="eyebrow">Continuous market</span><h2>{open ? "Trade outcome shares" : "Trading closed"}</h2></div>
        <button type="button" className="quote-refresh" disabled={refreshing || !connected} onClick={() => void refresh()} aria-label="Refresh market quote"><RefreshCw size={13} className={refreshing ? "spin" : ""} /></button>
      </div>
      {!open ? <div className="market-closed-state"><span><LockKeyhole size={20} /></span><h3>{closedCopy.title}</h3><p>{closedCopy.detail}</p><a href={closedCopy.href}>{closedCopy.action}</a></div> : <>
        <div className="direction-toggle"><button type="button" disabled={busy} className={direction === "buy" ? "active" : ""} onClick={() => setDirection("buy")}>Buy</button><button type="button" disabled={busy} className={direction === "sell" ? "active" : ""} onClick={() => setDirection("sell")}>Sell</button></div>
        <span className="field-label">Outcome</span>
        <div className="outcome-toggle">
          <button type="button" disabled={busy} className={side === "yes" ? "yes active" : "yes"} onClick={() => setSide("yes")}><span>YES</span><b>{quote ? percent(quote.beforeYesProbability) : `${market.yes}%`}</b></button>
          <button type="button" disabled={busy} className={side === "no" ? "no active" : "no"} onClick={() => setSide("no")}><span>NO</span><b>{quote ? percent(1_000_000n - quote.beforeYesProbability) : `${100 - market.yes}%`}</b></button>
        </div>
        <div className="ticket-field-row"><span>Outcome shares</span><small>{connected && ownerBalance !== null ? `${formatUsdc(ownerBalance)} USDC available` : "1 winning share pays 1 USDC"}</small></div>
        <div className="amount-field trade-amount"><input disabled={busy} value={sharesInput} onChange={(event) => setSharesInput(event.target.value)} inputMode="decimal" aria-label="Outcome shares" /><span>SHARES</span></div>
        <div className="trade-size-presets">
          {["1", "5", "10"].map((value) => <button type="button" key={value} disabled={busy} onClick={() => setSharesInput(value)}>{value}</button>)}
          <button type="button" disabled={busy || direction !== "sell" || availableShares === 0n} onClick={() => setSharesInput(formatUsdc(availableShares))}>Max</button>
        </div>
        <div className="slippage-control"><span>Slippage limit</span><div>{([50, 100, 200] as const).map((value) => <button type="button" key={value} disabled={busy} className={slippageBps === value ? "active" : ""} onClick={() => setSlippageBps(value)}>{(value / 100).toFixed(value === 50 ? 1 : 0)}%</button>)}</div></div>
        <div className="ticket-breakdown">
          <div><span>{direction === "buy" ? "Maximum cost" : "Minimum proceeds"}</span><strong>{quote ? `${formatUsdc(amountGuard(quote, slippageBps))} USDC` : "Enter a valid amount"}</strong></div>
          <div><span>Live quote</span><strong>{quote ? `${formatUsdc(quote.totalAmount)} USDC ($${formatUsdc(quote.totalAmount)})` : "Unavailable"}</strong></div>
          <div><span>Average fill <Info size={12} /></span><strong>{quote ? price(quote.averagePrice) : "-"}</strong></div>
          <div><span>Curve fee</span><strong>{quote ? `${formatUsdc(quote.feeAmount)} USDC` : "-"}</strong></div>
          <div><span>Price impact</span><strong>{quote ? signedPercentagePoints(selectedProbabilityAfter - selectedProbabilityBefore) : "-"}</strong></div>
          <div><span>YES after trade</span><strong>{quote ? percent(quote.afterYesProbability) : "-"}</strong></div>
          {direction === "buy" && <div className="payout-row"><span>Potential payout</span><strong>{quote ? `${formatUsdc(quote.shares)} USDC` : "-"}</strong></div>}
          {direction === "buy" && <div><span>Maximum trade profit</span><strong>{potentialProfit === null ? "-" : `${potentialProfit >= 0n ? "+" : "-"}${formatUsdc(potentialProfit >= 0n ? potentialProfit : -potentialProfit)} USDC`}</strong></div>}
          {direction === "sell" && <div><span>Your {side.toUpperCase()} shares</span><strong>{formatUsdc(availableShares)}</strong></div>}
          <div><span>Per-market maximum</span><strong>{formatUsdc(maxTradeShares)} shares</strong></div>
        </div>
        {!connected
          ? <button type="button" className="primary-order-button" onClick={() => setVisible(true)}><Wallet size={16} />Connect wallet</button>
          : <button type="button" className="primary-order-button" disabled={!quote || busy || insufficientBalance || insufficientPosition || exceedsTradeLimit || !account} onClick={() => void submit()}><UsdcTokenIcon size={16} />{stage === "signing" ? "Confirm in wallet" : stage === "confirming" ? "Confirming on devnet" : insufficientBalance ? "Insufficient devnet USDC" : insufficientPosition ? "Insufficient shares" : exceedsTradeLimit ? "Above market trade limit" : `${direction === "buy" ? "Buy" : "Sell"} ${side.toUpperCase()}`}</button>}
        {error && <small className="order-error"><AlertTriangle size={10} />{error}</small>}
        {signature && <a className="order-signature" href={`https://explorer.solana.com/tx/${signature}?cluster=devnet`} target="_blank" rel="noreferrer"><Check size={12} />View confirmed trade</a>}
        <a className="faucet-link" href="https://faucet.circle.com/" target="_blank" rel="noreferrer">Need test collateral? Get Circle devnet USDC</a>
      </>}
    </aside>
  );
}

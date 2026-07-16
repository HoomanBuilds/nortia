"use client";

import { BN } from "@anchor-lang/core";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { PublicKey, SystemProgram, type Transaction } from "@solana/web3.js";
import { formatUsdc } from "nortia-client/economics";
import { requiredLmsrSubsidy } from "nortia-client/lmsr";
import {
  PYTH_PRICE_FEEDS,
  marketIdFromEntropy,
  oracleSourceIdBytes,
  parseDecimalAtExponent,
} from "nortia-client/oracles";
import {
  enginePda,
  hybridMarketPda,
  hybridMetadataPda,
  hybridVaultPda,
  oracleConfigPda,
} from "nortia-client/v2";
import {
  AlertTriangle,
  Check,
  CircleDollarSign,
  Clock3,
  ExternalLink,
  Radio,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  DEVNET_USDC_MINT_KEY,
  NORTIA_PROGRAM_KEY,
  PYTH_RECEIVER_PROGRAM_KEY,
} from "@/lib/solana/constants";
import { translateNortiaError } from "@/lib/solana/errors";
import { marketPda, protocolPda, vaultPda } from "@/lib/solana/pdas";
import { useNortiaProgram, useProtocolStatus } from "@/lib/solana/use-nortia-program";

const fixtures = [
  { id: 18_222_446, label: "Argentina vs Switzerland", group: "Quarter-final replay", start: "2026-07-12T01:00:00Z" },
  { id: 18_218_149, label: "Spain vs Belgium", group: "Quarter-final replay", start: "2026-07-10T19:00:00Z" },
] as const;

const LIQUIDITY_PARAMETER = 25_000_000n;
const ROUNDING_RESERVE = 2n;
const INITIAL_SUBSIDY = requiredLmsrSubsidy(LIQUIDITY_PARAMETER, ROUNDING_RESERVE);
const MAX_TRADE_SHARES = 10_000_000n;
const TRADE_FEE_BPS = 100;
const OPTIMISTIC_BOND = 25_000_000n;

type ResolverChoice = "pyth" | "optimistic" | "txline-replay";
type SubmissionStage = "idle" | "validating" | "market-signing" | "market-confirming" | "metadata-signing" | "metadata-confirming" | "confirmed";

async function sha256(value: string) {
  return Array.from(new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
  ));
}

function timestamp(value: string): number {
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)) throw new Error("Choose a valid resolution date and time");
  return Math.floor(milliseconds / 1_000);
}

function futureLocalDate(minutes: number): string {
  const date = new Date(Date.now() + minutes * 60_000);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function randomMarketId(): bigint {
  for (;;) {
    const entropy = crypto.getRandomValues(new Uint8Array(8));
    try {
      return marketIdFromEntropy(entropy);
    } catch {
      continue;
    }
  }
}

function bytesHex(value: number[]): string {
  return Buffer.from(value).toString("hex");
}

export function CreateMarketForm() {
  const program = useNortiaProgram();
  const router = useRouter();
  const { connection } = useConnection();
  const { connected, publicKey, sendTransaction } = useWallet();
  const { setVisible } = useWalletModal();
  const protocolStatus = useProtocolStatus();
  const [resolver, setResolver] = useState<ResolverChoice>("pyth");
  const [marketId, setMarketId] = useState<bigint | null>(null);
  const [resolutionAt, setResolutionAt] = useState("");
  const [feedId, setFeedId] = useState<string>(PYTH_PRICE_FEEDS[0].id);
  const [priceThreshold, setPriceThreshold] = useState("120000.00");
  const [category, setCategory] = useState<"politics" | "technology" | "culture" | "other">("politics");
  const [customQuestion, setCustomQuestion] = useState("Will the stated event happen by the resolution time?");
  const [customRules, setCustomRules] = useState("Resolve YES only when the public primary source unambiguously confirms the event. Otherwise resolve NO.");
  const [fixtureId, setFixtureId] = useState<number>(fixtures[0].id);
  const [stage, setStage] = useState<SubmissionStage>("idle");
  const [signature, setSignature] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMarketId(randomMarketId());
    setResolutionAt(futureLocalDate(60));
  }, []);

  const selectedFeed = PYTH_PRICE_FEEDS.find((feed) => feed.id === feedId) ?? PYTH_PRICE_FEEDS[0];
  const fixture = fixtures.find((item) => item.id === fixtureId) ?? fixtures[0];
  const question = resolver === "pyth"
    ? `Will ${selectedFeed.symbol} be at or above $${priceThreshold} at the resolution time?`
    : resolver === "optimistic"
      ? customQuestion.trim()
      : `Will ${fixture.label} finish with over 2.5 goals?`;
  const rules = resolver === "pyth"
    ? `Resolve from the fully verified Pyth ${selectedFeed.symbol} update that uniquely brackets the configured timestamp. YES requires a price greater than or equal to ${priceThreshold} USD with no more than 1% confidence width.`
    : resolver === "optimistic"
      ? customRules.trim()
      : "TxLINE participant-one goals plus participant-two goals for final period 100 must be greater than 2.";
  const marketAddress = useMemo(() => {
    if (!publicKey || marketId === null) return null;
    const id = new BN(marketId.toString());
    return resolver === "txline-replay"
      ? marketPda(publicKey, id)
      : hybridMarketPda(publicKey, marketId);
  }, [marketId, publicKey, resolver]);

  const sendAndConfirm = async (
    transaction: Transaction,
    signingStage: SubmissionStage,
    confirmingStage: SubmissionStage,
  ) => {
    if (!publicKey) throw new Error("Connect a wallet before creating a market");
    const latest = await connection.getLatestBlockhash("confirmed");
    transaction.feePayer = publicKey;
    transaction.recentBlockhash = latest.blockhash;
    setStage(signingStage);
    const nextSignature = await sendTransaction(transaction, connection, {
      preflightCommitment: "confirmed",
      skipPreflight: false,
    });
    setStage(confirmingStage);
    const confirmation = await connection.confirmTransaction(
      { signature: nextSignature, ...latest },
      "confirmed",
    );
    if (confirmation.value.err) throw new Error("Transaction confirmation failed");
    return nextSignature;
  };

  const createReplayMarket = async () => {
    if (!program || !publicKey || marketId === null || !marketAddress) return;
    const now = Math.floor(Date.now() / 1_000);
    const lockTs = now + 15 * 60;
    const marketIdBn = new BN(marketId.toString());
    const transaction = await program.methods.initializeMarket({
      marketId: marketIdBn,
      category: { sports: {} },
      resolverKind: { txlineStatV2: {} },
      questionHash: await sha256(question),
      rulesHash: await sha256(rules),
      fixtureId: new BN(fixture.id),
      totalGoalsThreshold: 2,
      marketMode: { replay: {} },
      fixtureStartTs: new BN(Math.floor(Date.parse(fixture.start) / 1_000)),
      lockTs: new BN(lockTs),
      batchDeadlineTs: new BN(lockTs + 15 * 60),
      resolutionDeadlineTs: new BN(lockTs + 2 * 60 * 60),
    }).accountsPartial({
      creator: publicKey,
      protocol: protocolPda(),
      collateralMint: DEVNET_USDC_MINT_KEY,
      market: marketAddress,
      vault: vaultPda(marketAddress),
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    }).transaction();
    return sendAndConfirm(transaction, "market-signing", "market-confirming");
  };

  const createHybridMarket = async () => {
    if (!program || !publicKey || marketId === null || !marketAddress) return;
    const existingMarket = await connection.getAccountInfo(marketAddress, "confirmed");
    if (existingMarket && !existingMarket.owner.equals(program.programId)) {
      throw new Error("A different program owns the derived market address");
    }
    const observationTs = timestamp(resolutionAt);
    const now = Math.floor(Date.now() / 1_000);
    if (observationTs < now + 20 * 60) {
      throw new Error("Resolution must be at least 20 minutes in the future");
    }
    if (!question || !rules) throw new Error("Question and resolution rules are required");
    const lockTs = observationTs - 5 * 60;
    const questionHash = await sha256(question);
    const rulesHash = await sha256(rules);
    const outcomeLabelsHash = await sha256("YES\nNO");
    const isPyth = resolver === "pyth";
    const sourceId = isPyth ? oracleSourceIdBytes(feedId) : questionHash;
    const threshold = isPyth ? parseDecimalAtExponent(priceThreshold, -2) : 0n;
    const oracleFingerprint = [
      isPyth ? "pyth-price-v2" : "optimistic-v1",
      isPyth ? PYTH_RECEIVER_PROGRAM_KEY.toBase58() : NORTIA_PROGRAM_KEY.toBase58(),
      bytesHex(sourceId),
      isPyth ? "greater-than-or-equal" : "equal",
      threshold.toString(),
      isPyth ? "-2" : "0",
      observationTs.toString(),
      bytesHex(questionHash),
      bytesHex(rulesHash),
    ].join("\n");
    const configHash = await sha256(oracleFingerprint);
    const oracle = {
      resolver: isPyth ? { pythPriceV2: {} } : { optimisticV1: {} },
      sourceProgram: isPyth ? PYTH_RECEIVER_PROGRAM_KEY : NORTIA_PROGRAM_KEY,
      sourceQueue: PublicKey.default,
      sourceId,
      comparator: isPyth ? { greaterThanOrEqual: {} } : { equal: {} },
      threshold: new BN(threshold.toString()),
      thresholdExponent: isPyth ? -2 : 0,
      observationTs: new BN(observationTs),
      observationWindowSecs: isPyth ? 60 : 24 * 60 * 60,
      maxStalenessSecs: isPyth ? 30 : 0,
      maxStalenessSlots: new BN(0),
      maxConfidenceBps: isPyth ? 100 : 0,
      minSamples: 0,
      challengePeriodSecs: isPyth ? 0 : 6 * 60 * 60,
      bondAmount: new BN(isPyth ? 0 : OPTIMISTIC_BOND.toString()),
      configHash,
    };
    let marketSignature: string | null = null;
    if (!existingMarket) {
      const engineAddress = enginePda();
      const engine = await program.account.engineConfig.fetch(engineAddress);
      const creatorToken = getAssociatedTokenAddressSync(engine.collateralMint, publicKey);
      const tokenBalance = await connection.getTokenAccountBalance(creatorToken, "confirmed").catch(() => null);
      if (!tokenBalance || BigInt(tokenBalance.value.amount) < INITIAL_SUBSIDY) {
        throw new Error(`The creator wallet needs at least ${formatUsdc(INITIAL_SUBSIDY)} devnet USDC`);
      }
      const transaction = await program.methods.initializeHybridMarket({
        marketId: new BN(marketId.toString()),
        category: isPyth ? { crypto: {} } : { [category]: {} },
        tradingMode: { continuous: {} },
        questionHash,
        rulesHash,
        outcomeLabelsHash,
        liquidityParameter: new BN(LIQUIDITY_PARAMETER.toString()),
        roundingReserve: new BN(ROUNDING_RESERVE.toString()),
        maxTradeShares: new BN(MAX_TRADE_SHARES.toString()),
        tradeFeeBps: TRADE_FEE_BPS,
        lockTs: new BN(lockTs),
        resolveNotBeforeTs: new BN(observationTs),
        resolutionDeadlineTs: new BN(observationTs + (isPyth ? 30 * 60 : 48 * 60 * 60)),
        oracle,
      }).accountsPartial({
        creator: publicKey,
        engine: engineAddress,
        collateralMint: engine.collateralMint,
        creatorToken,
        market: marketAddress,
        oracleConfig: oracleConfigPda(marketAddress),
        vault: hybridVaultPda(marketAddress),
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      }).transaction();
      marketSignature = await sendAndConfirm(
        transaction,
        "market-signing",
        "market-confirming",
      );
      setSignature(marketSignature);
    }
    const metadataAddress = hybridMetadataPda(marketAddress);
    const existingMetadata = await connection.getAccountInfo(metadataAddress, "confirmed");
    if (existingMetadata) {
      if (!existingMetadata.owner.equals(program.programId)) {
        throw new Error("A different program owns the derived metadata address");
      }
      return marketSignature;
    }
    const metadataTransaction = await program.methods.publishHybridMetadata({
      question,
      rules,
      yesLabel: "YES",
      noLabel: "NO",
      referenceUrl: "",
    }).accountsPartial({
      creator: publicKey,
      market: marketAddress,
      metadata: metadataAddress,
      systemProgram: SystemProgram.programId,
    }).transaction();
    return sendAndConfirm(
      metadataTransaction,
      "metadata-signing",
      "metadata-confirming",
    );
  };

  const submit = async () => {
    if (!program || !publicKey || !marketAddress || marketId === null) return;
    setStage("validating");
    setError(null);
    setSignature(null);
    try {
      const nextSignature = resolver === "txline-replay"
        ? await createReplayMarket()
        : await createHybridMarket();
      if (nextSignature) setSignature(nextSignature);
      setStage("confirmed");
      router.push(`/markets/${marketAddress.toBase58()}?q=${encodeURIComponent(question)}`);
    } catch (cause) {
      console.error("market creation failed", cause);
      setError(translateNortiaError(cause));
      setStage("idle");
    }
  };

  const v2 = resolver !== "txline-replay";
  const unavailable = !protocolStatus.program
    || !protocolStatus.protocol
    || (v2 && (!protocolStatus.engine || (resolver === "pyth" && !protocolStatus.pyth)))
    || (!v2 && !protocolStatus.txline);
  const busy = stage !== "idle" && stage !== "confirmed";
  const submitLabel = stage === "validating"
    ? "Checking market configuration"
    : stage === "market-signing"
      ? "Confirm market in wallet"
      : stage === "market-confirming"
        ? "Confirming market on devnet"
        : stage === "metadata-signing"
          ? "Confirm metadata in wallet"
          : stage === "metadata-confirming"
            ? "Publishing verified metadata"
        : stage === "confirmed"
          ? "Market confirmed"
          : v2
            ? "Create LMSR market"
            : "Create private replay pool";

  return (
    <div className="create-market-layout">
      <section className="create-form-card">
        <div className="form-section-heading"><span>01</span><div><strong>Resolution source</strong><p>Select a resolver whose evidence is verified by the market contract.</p></div></div>
        <div className="resolver-grid">
          <button type="button" className={resolver === "pyth" ? "resolver-choice active" : "resolver-choice"} onClick={() => setResolver("pyth")}><span><Radio size={18} /></span><div><strong>Pyth Price</strong><p>Timestamped, fully verified crypto price settlement.</p></div><b>CONNECTED</b></button>
          <button type="button" className={resolver === "optimistic" ? "resolver-choice active" : "resolver-choice"} onClick={() => setResolver("optimistic")}><span><ShieldCheck size={18} /></span><div><strong>Bonded Facts</strong><p>Long-tail facts with challenge bonds and committee arbitration.</p></div><b>CONNECTED</b></button>
          <button type="button" className={resolver === "txline-replay" ? "resolver-choice active" : "resolver-choice"} onClick={() => setResolver("txline-replay")}><span><Radio size={18} /></span><div><strong>TxLINE Replay</strong><p>Private fixed-ticket sports flow for the hackathon demo.</p></div><b>CONNECTED</b></button>
        </div>

        <div className="form-section-heading"><span>02</span><div><strong>Market predicate</strong><p>The displayed predicate is hashed into immutable onchain configuration.</p></div></div>
        {resolver === "pyth" && <div className="create-field-grid"><label className="create-field"><span>Pyth feed</span><select value={feedId} onChange={(event) => setFeedId(event.target.value)}>{PYTH_PRICE_FEEDS.map((feed) => <option value={feed.id} key={feed.id}>{feed.symbol}</option>)}</select></label><label className="create-field"><span>Price threshold in USD</span><input value={priceThreshold} onChange={(event) => setPriceThreshold(event.target.value)} inputMode="decimal" /></label></div>}
        {resolver === "optimistic" && <><div className="create-field-grid"><label className="create-field"><span>Category</span><select value={category} onChange={(event) => setCategory(event.target.value as typeof category)}><option value="politics">Politics</option><option value="technology">Technology</option><option value="culture">Culture</option><option value="other">Other</option></select></label><label className="create-field"><span>Outcome labels</span><input value="YES / NO" readOnly /></label></div><label className="create-field"><span>Question</span><input value={customQuestion} onChange={(event) => setCustomQuestion(event.target.value)} maxLength={160} /></label><label className="create-field"><span>Resolution rules</span><input value={customRules} onChange={(event) => setCustomRules(event.target.value)} maxLength={420} /></label></>}
        {resolver === "txline-replay" && <label className="create-field"><span>Covered fixture</span><select value={fixtureId} onChange={(event) => setFixtureId(Number(event.target.value))}>{fixtures.map((item) => <option value={item.id} key={item.id}>{item.label} - {item.group}</option>)}</select></label>}
        <label className="create-field"><span>Question preview</span><input value={question} readOnly /></label>
        {v2 && <label className="create-field"><span>Resolution time in your local timezone</span><input type="datetime-local" value={resolutionAt} min={futureLocalDate(20)} onChange={(event) => setResolutionAt(event.target.value)} /></label>}

        <div className="form-section-heading"><span>03</span><div><strong>Economics and confirmation</strong><p>V2 creators fund the LMSR loss bound before trading opens.</p></div></div>
        <div className="create-review">
          <div><span>Collateral</span><b>Devnet USDC</b></div>
          <div><span>Pricing</span><b>{v2 ? "LMSR" : "Private pool"}</b></div>
          <div><span>Creator funding</span><b>{v2 ? `${formatUsdc(INITIAL_SUBSIDY)} USDC` : "Account rent"}</b></div>
          <div><span>Trading fee</span><b>{v2 ? "Up to 1% curve fee" : "1% on settlement"}</b></div>
          <div><span>Protocol share</span><b>{v2 ? "70% of trade fee" : "Treasury after keeper"}</b></div>
          <div><span>Market PDA</span><code>{marketAddress ? `${marketAddress.toBase58().slice(0, 8)}...${marketAddress.toBase58().slice(-8)}` : "Connect wallet to derive"}</code></div>
        </div>
        {!connected
          ? <button className="create-submit" type="button" onClick={() => setVisible(true)}><Wallet size={16} />Connect wallet to create</button>
          : <button className="create-submit" type="button" disabled={unavailable || busy || !marketAddress} onClick={() => void submit()}>{unavailable ? "Deployment configuration required" : submitLabel}</button>}
        {error && <div className="transaction-message error"><AlertTriangle size={15} /><span>{error}</span></div>}
        {signature && <div className="transaction-message success"><Check size={15} /><span>Market created and confirmed.</span><a href={`https://explorer.solana.com/tx/${signature}?cluster=devnet`} target="_blank" rel="noreferrer">Explorer <ExternalLink size={12} /></a></div>}
      </section>

      <aside className="create-side-card">
        <span className="eyebrow">Creation readiness</span>
        <h2>Every dependency is explicit.</h2>
        <div className="readiness-list">
          <div className={protocolStatus.program ? "ready" : "blocked"}><ShieldCheck size={15} /><span>Nortia program</span><b>{protocolStatus.loading ? "Checking" : protocolStatus.program ? "Ready" : "Not deployed"}</b></div>
          <div className={protocolStatus.engine ? "ready" : "blocked"}><CircleDollarSign size={15} /><span>V2 LMSR engine</span><b>{protocolStatus.loading ? "Checking" : protocolStatus.engine ? "Ready" : "Upgrade required"}</b></div>
          <div className={resolver === "pyth" ? (protocolStatus.pyth ? "ready" : "blocked") : resolver === "txline-replay" ? (protocolStatus.txline ? "ready" : "blocked") : "ready"}><Radio size={15} /><span>{resolver === "pyth" ? "Pyth receiver" : resolver === "txline-replay" ? "TxLINE program" : "Bonded resolver"}</span><b>{resolver === "pyth" ? (protocolStatus.pyth ? "Verified" : "Unavailable") : resolver === "txline-replay" ? (protocolStatus.txline ? "Verified" : "Unavailable") : "Native"}</b></div>
        </div>
        <div className="creation-rule"><Clock3 size={16} /><p>Trading closes five minutes before a V2 observation. The contract rejects late trades even if the page is stale.</p></div>
        <div className="creation-rule"><CircleDollarSign size={16} /><p>The default 25 USDC liquidity parameter requires {formatUsdc(INITIAL_SUBSIDY)} USDC of creator subsidy. This collateral funds the LMSR worst-case loss bound.</p></div>
        <div className="creation-rule"><AlertTriangle size={16} /><p>Switchboard remains curated-only until a canonical quote feed is provisioned. UMA and Chainlink stay disabled until their exact verification path is deployed.</p></div>
      </aside>
    </div>
  );
}

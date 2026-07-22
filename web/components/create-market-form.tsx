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
  SWITCHBOARD_DEVNET_QUEUE_ADDRESS,
  marketIdFromEntropy,
  oracleSourceIdBytes,
  parseDecimalAtExponent,
  type OracleMarketCategory,
  type PythFeed,
} from "nortia-client/oracles";
import {
  enginePda,
  hybridMarketPda,
  hybridMetadataPda,
  hybridVaultPda,
  oracleConfigPda,
} from "nortia-client/market-engine";
import {
  AlertTriangle,
  Check,
  Clock3,
  ExternalLink,
  KeyRound,
  Search,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { MarketCategoryIcon, ResolverIcon, UsdcTokenIcon } from "@/components/market-icons";
import type { MarketCategory } from "@/lib/markets";
import {
  DEVNET_USDC_MINT_KEY,
  NORTIA_PROGRAM_KEY,
  PYTH_PUSH_ORACLE_PROGRAM_KEY,
  PYTH_RECEIVER_PROGRAM_KEY,
  STORK_ORACLE_PROGRAM_KEY,
  SWITCHBOARD_QUOTE_PROGRAM_KEY,
} from "@/lib/solana/constants";
import { translateNortiaError } from "@/lib/solana/errors";
import { marketPda, protocolPda, vaultPda } from "@/lib/solana/pdas";
import { useNortiaProgram, useProtocolStatus } from "@/lib/solana/use-nortia-program";

const fixtures = [
  { id: 18_222_446, label: "Argentina vs Switzerland", group: "Quarter-final replay", start: "2026-07-12T01:00:00Z" },
  { id: 18_218_149, label: "Spain vs Belgium", group: "Quarter-final replay", start: "2026-07-10T19:00:00Z" },
] as const;

const categories: Array<{ id: OracleMarketCategory; label: MarketCategory; detail: string }> = [
  { id: "sports", label: "Sports", detail: "TxLINE match facts" },
  { id: "crypto", label: "Crypto", detail: "Tokens, NAV, rates" },
  { id: "economics", label: "Economics", detail: "Equities, FX, commodities" },
  { id: "politics", label: "Politics", detail: "Elections and policy" },
  { id: "technology", label: "Technology", detail: "Products and adoption" },
  { id: "culture", label: "Culture", detail: "Media and entertainment" },
  { id: "science", label: "Science", detail: "Research and climate" },
  { id: "other", label: "Other", detail: "Objective long-tail facts" },
];

const LIQUIDITY_PARAMETER = 25_000_000n;
const ROUNDING_RESERVE = 2n;
const INITIAL_SUBSIDY = requiredLmsrSubsidy(LIQUIDITY_PARAMETER, ROUNDING_RESERVE);
const MAX_TRADE_SHARES = 10_000_000n;
const TRADE_FEE_BPS = 100;
const OPTIMISTIC_BOND = 25_000_000n;
const PRIVATE_STAKE_OPTIONS = [1, 5, 10, 25, 50, 100, 250, 500, 1_000] as const;
const SWITCHBOARD_QUEUE = new PublicKey(SWITCHBOARD_DEVNET_QUEUE_ADDRESS);
const PYTH_API_KEY_DATE = Date.parse("2026-08-18T00:00:00Z");

type ResolverChoice = "pyth" | "switchboard" | "stork" | "optimistic" | "txline-replay";
type SubmissionStage = "idle" | "validating" | "market-signing" | "market-confirming" | "metadata-signing" | "metadata-confirming" | "confirmed";
type Readiness = {
  pyth: { available: boolean; authenticated: boolean; publicEndpoint: boolean; apiKeyRequiredFrom: string };
  switchboard: { available: boolean; authenticated: boolean; publicEndpoint: boolean };
  stork: { available: boolean; authenticated: boolean; externalPusherRequired: boolean };
  txline: { available: boolean; replayAvailable: boolean };
};
type StorkAsset = { assetId: string; feedId: string; price: string; timestampNs: string };

function resolverChoices(category: OracleMarketCategory): ResolverChoice[] {
  if (category === "sports") return ["txline-replay"];
  if (category === "crypto") return ["pyth", "stork"];
  if (category === "economics") return ["pyth", "switchboard", "stork", "optimistic"];
  return ["optimistic", "switchboard"];
}

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

function categoryArgument(category: OracleMarketCategory) {
  return { [category]: {} };
}

function resolverLabel(resolver: ResolverChoice) {
  return {
    pyth: "Pyth Price",
    switchboard: "Switchboard Numeric",
    stork: "Stork Price",
    optimistic: "Bonded Facts",
    "txline-replay": "TxLINE Replay",
  }[resolver];
}

export function CreateMarketForm() {
  const program = useNortiaProgram();
  const router = useRouter();
  const { connection } = useConnection();
  const { connected, publicKey, sendTransaction } = useWallet();
  const { setVisible } = useWalletModal();
  const protocolStatus = useProtocolStatus();
  const [category, setCategory] = useState<OracleMarketCategory>("crypto");
  const [resolver, setResolver] = useState<ResolverChoice>("pyth");
  const [marketId, setMarketId] = useState<bigint | null>(null);
  const [resolutionAt, setResolutionAt] = useState("");
  const [pythFeeds, setPythFeeds] = useState<readonly PythFeed[]>(PYTH_PRICE_FEEDS);
  const [selectedFeed, setSelectedFeed] = useState<PythFeed | null>(PYTH_PRICE_FEEDS[0] ?? null);
  const [feedQuery, setFeedQuery] = useState("");
  const [feedLoading, setFeedLoading] = useState(false);
  const [feedDegraded, setFeedDegraded] = useState(false);
  const [priceThreshold, setPriceThreshold] = useState("120000");
  const [customQuestion, setCustomQuestion] = useState("Will the stated event happen by the resolution time?");
  const [customRules, setCustomRules] = useState("Resolve YES only when the named primary source unambiguously confirms the event. Otherwise resolve NO.");
  const [customReferenceUrl, setCustomReferenceUrl] = useState("");
  const [switchboardFeedHash, setSwitchboardFeedHash] = useState("");
  const [switchboardUnit, setSwitchboardUnit] = useState("USD");
  const [switchboardLabel, setSwitchboardLabel] = useState("the configured metric");
  const [switchboardValidated, setSwitchboardValidated] = useState(false);
  const [switchboardChecking, setSwitchboardChecking] = useState(false);
  const [storkAssets, setStorkAssets] = useState<string[]>([]);
  const [storkAssetId, setStorkAssetId] = useState("");
  const [storkAsset, setStorkAsset] = useState<StorkAsset | null>(null);
  const [fixtureId, setFixtureId] = useState<number>(fixtures[0].id);
  const [privateStakeUsdc, setPrivateStakeUsdc] = useState<number>(100);
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [stage, setStage] = useState<SubmissionStage>("idle");
  const [signature, setSignature] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMarketId(randomMarketId());
    setResolutionAt(futureLocalDate(60));
    void fetch("/api/oracles/readiness", { cache: "no-store" })
      .then((response) => response.json())
      .then((value: Readiness) => setReadiness(value))
      .catch(() => setReadiness(null));
  }, []);

  useEffect(() => {
    if (resolver !== "pyth") return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setFeedLoading(true);
      const params = new URLSearchParams({ category });
      if (feedQuery.trim()) params.set("query", feedQuery.trim());
      void fetch(`/api/oracles/pyth?${params}`, { signal: controller.signal })
        .then((response) => response.json())
        .then((value: { feeds?: PythFeed[]; degraded?: boolean }) => {
          if (!value.feeds) return;
          setPythFeeds(value.feeds);
          setFeedDegraded(Boolean(value.degraded));
          setSelectedFeed((current) => value.feeds?.find((feed) => feed.id === current?.id) ?? value.feeds?.[0] ?? null);
        })
        .catch((cause) => {
          if ((cause as Error).name !== "AbortError") setFeedDegraded(true);
        })
        .finally(() => setFeedLoading(false));
    }, 300);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [category, feedQuery, resolver]);

  useEffect(() => {
    if (resolver !== "stork" || !readiness?.stork.available || storkAssets.length > 0) return;
    void fetch("/api/oracles/stork", { cache: "no-store" })
      .then((response) => response.json())
      .then((value: { assets?: string[] }) => {
        const assets = value.assets ?? [];
        setStorkAssets(assets);
        if (assets[0]) setStorkAssetId(assets[0]);
      })
      .catch(() => setStorkAssets([]));
  }, [readiness?.stork.available, resolver, storkAssets.length]);

  useEffect(() => {
    if (resolver !== "stork" || !storkAssetId) return;
    setStorkAsset(null);
    const controller = new AbortController();
    void fetch(`/api/oracles/stork?asset=${encodeURIComponent(storkAssetId)}`, { signal: controller.signal })
      .then((response) => response.json())
      .then((value: { asset?: StorkAsset }) => setStorkAsset(value.asset ?? null))
      .catch((cause) => {
        if ((cause as Error).name !== "AbortError") setStorkAsset(null);
      });
    return () => controller.abort();
  }, [resolver, storkAssetId]);

  const fixture = fixtures.find((item) => item.id === fixtureId) ?? fixtures[0];
  const quotePrefix = selectedFeed?.quoteCurrency === "USD" ? "$" : "";
  const question = resolver === "pyth"
    ? selectedFeed
      ? `Will ${selectedFeed.symbol} be at or above ${quotePrefix}${priceThreshold} ${selectedFeed.quoteCurrency} at the resolution time?`
      : "Select a verified Pyth feed to define this market."
    : resolver === "switchboard"
      ? `Will ${switchboardLabel.trim() || "the configured metric"} be at or above ${priceThreshold} ${switchboardUnit.trim() || "units"} at the resolution time?`
      : resolver === "stork"
        ? `Will ${storkAssetId || "the selected Stork asset"} be at or above ${priceThreshold} USD at the resolution time?`
        : resolver === "optimistic"
          ? customQuestion.trim()
          : `Will ${fixture.label} finish with over 2.5 goals?`;
  const rules = resolver === "pyth"
    ? selectedFeed
      ? `Resolve from the fully verified Pyth ${selectedFeed.symbol} update that uniquely brackets the configured timestamp. YES requires a value greater than or equal to ${priceThreshold} ${selectedFeed.quoteCurrency} with no more than 1% confidence width.`
      : "A verified Pyth feed is required before this market can be created."
    : resolver === "switchboard"
      ? `Resolve from the canonical Switchboard devnet quote for feed ${switchboardFeedHash}. YES requires the 1e18-scaled value to be greater than or equal to ${priceThreshold} ${switchboardUnit}, with at least three distinct oracle signatures.`
      : resolver === "stork"
        ? `Resolve from the canonical Stork Solana account for ${storkAssetId}. YES requires the 1e18-scaled value to be greater than or equal to ${priceThreshold} USD inside the configured observation window.`
        : resolver === "optimistic"
          ? customRules.trim()
          : "TxLINE participant-one goals plus participant-two goals for final period 100 must be greater than 2.";
  const referenceUrl = resolver === "pyth"
    ? "https://docs.pyth.network/price-feeds/core/price-feeds"
    : resolver === "switchboard" && /^[0-9a-f]{64}$/i.test(switchboardFeedHash)
      ? `https://crossbar.switchboard.xyz/v2/fetch/${switchboardFeedHash.toLowerCase()}`
      : resolver === "stork"
        ? "https://docs.stork.network/resources/asset-id-registry"
        : resolver === "optimistic"
          ? customReferenceUrl.trim()
          : "";
  const marketAddress = useMemo(() => {
    if (!publicKey || marketId === null) return null;
    const id = new BN(marketId.toString());
    return resolver === "txline-replay"
      ? marketPda(publicKey, id)
      : hybridMarketPda(publicKey, marketId);
  }, [marketId, publicKey, resolver]);

  const selectCategory = (nextCategory: OracleMarketCategory) => {
    const choices = resolverChoices(nextCategory);
    setCategory(nextCategory);
    if (!choices.includes(resolver)) setResolver(choices[0]!);
    if (nextCategory === "crypto" || nextCategory === "economics") {
      const fallback = PYTH_PRICE_FEEDS.find((feed) => feed.category === nextCategory) ?? null;
      setSelectedFeed(fallback);
      setPythFeeds(PYTH_PRICE_FEEDS.filter((feed) => feed.category === nextCategory));
    }
  };

  const validateSwitchboard = async () => {
    setSwitchboardChecking(true);
    setSwitchboardValidated(false);
    setError(null);
    try {
      const response = await fetch(`/api/oracles/switchboard?feedHash=${encodeURIComponent(switchboardFeedHash)}`, { cache: "no-store" });
      const value = await response.json() as { available?: boolean; error?: string };
      if (!response.ok || !value.available) throw new Error(value.error ?? "Switchboard feed is unavailable");
      setSwitchboardValidated(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Switchboard feed validation failed");
    } finally {
      setSwitchboardChecking(false);
    }
  };

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
      resolverKind: { txlineStat: {} },
      questionHash: await sha256(question),
      rulesHash: await sha256(rules),
      fixtureId: new BN(fixture.id),
      totalGoalsThreshold: 2,
      marketMode: { replay: {} },
      fixtureStartTs: new BN(Math.floor(Date.parse(fixture.start) / 1_000)),
      stakeAmount: new BN((BigInt(privateStakeUsdc) * 1_000_000n).toString()),
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
    if (observationTs < now + 20 * 60) throw new Error("Resolution must be at least 20 minutes in the future");
    if (!question || !rules) throw new Error("Question and resolution rules are required");
    if (question.length > 160 || rules.length > 420) throw new Error("Question or resolution rules exceed contract limits");
    if (resolver === "optimistic" && !/^https:\/\//.test(referenceUrl)) {
      throw new Error("Bonded fact markets require an HTTPS primary source");
    }
    if (resolver === "switchboard" && !switchboardValidated) {
      throw new Error("Validate the stored Switchboard feed before creating the market");
    }
    if (resolver === "stork" && !storkAsset) throw new Error("Choose a verified Stork asset");

    const lockTs = observationTs - 5 * 60;
    const questionHash = await sha256(question);
    const rulesHash = await sha256(rules);
    const outcomeLabelsHash = await sha256("YES\nNO");
    let sourceProgram = NORTIA_PROGRAM_KEY;
    let sourceQueue = PublicKey.default;
    let sourceId = questionHash;
    let resolverArgument: Record<string, Record<string, never>> = { optimistic: {} };
    let comparator: Record<string, Record<string, never>> = { equal: {} };
    let threshold = 0n;
    let thresholdExponent = 0;
    let observationWindowSecs = 24 * 60 * 60;
    let maxStalenessSecs = 0;
    let maxStalenessSlots = 0n;
    let maxConfidenceBps = 0;
    let minSamples = 0;
    let challengePeriodSecs = 6 * 60 * 60;
    let bondAmount = OPTIMISTIC_BOND;
    let resolutionDeadlineTs = observationTs + 48 * 60 * 60;

    if (resolver === "pyth") {
      if (!selectedFeed) throw new Error("Select a verified Pyth feed before creating the market");
      sourceProgram = selectedFeed.delivery === "sponsored-push"
        ? PYTH_PUSH_ORACLE_PROGRAM_KEY
        : PYTH_RECEIVER_PROGRAM_KEY;
      sourceId = oracleSourceIdBytes(selectedFeed.id);
      resolverArgument = { pythPrice: {} };
      comparator = { greaterThanOrEqual: {} };
      threshold = parseDecimalAtExponent(priceThreshold, -8);
      thresholdExponent = -8;
      observationWindowSecs = selectedFeed.delivery === "sponsored-push"
        ? Math.max((selectedFeed.heartbeatSeconds ?? 60) + 30, 90)
        : 60;
      maxStalenessSecs = observationWindowSecs;
      maxConfidenceBps = 100;
      challengePeriodSecs = 0;
      bondAmount = 0n;
      resolutionDeadlineTs = observationTs + 30 * 60;
    } else if (resolver === "switchboard") {
      sourceProgram = SWITCHBOARD_QUOTE_PROGRAM_KEY;
      sourceQueue = SWITCHBOARD_QUEUE;
      sourceId = oracleSourceIdBytes(switchboardFeedHash);
      resolverArgument = { switchboardQuote: {} };
      comparator = { greaterThanOrEqual: {} };
      threshold = parseDecimalAtExponent(priceThreshold, -18);
      thresholdExponent = -18;
      observationWindowSecs = 5 * 60;
      maxStalenessSlots = 150n;
      minSamples = 3;
      challengePeriodSecs = 0;
      bondAmount = 0n;
      resolutionDeadlineTs = observationTs + 60 * 60;
    } else if (resolver === "stork") {
      sourceProgram = STORK_ORACLE_PROGRAM_KEY;
      sourceId = oracleSourceIdBytes(storkAsset!.feedId);
      resolverArgument = { storkPrice: {} };
      comparator = { greaterThanOrEqual: {} };
      threshold = parseDecimalAtExponent(priceThreshold, -18);
      thresholdExponent = -18;
      observationWindowSecs = 30;
      maxStalenessSecs = 15;
      challengePeriodSecs = 0;
      bondAmount = 0n;
      resolutionDeadlineTs = observationTs + 30 * 60;
    }

    const oracleFingerprint = [
      resolver,
      sourceProgram.toBase58(),
      sourceQueue.toBase58(),
      bytesHex(sourceId),
      Object.keys(comparator)[0],
      threshold.toString(),
      thresholdExponent.toString(),
      observationTs.toString(),
      observationWindowSecs.toString(),
      bytesHex(questionHash),
      bytesHex(rulesHash),
    ].join("\n");
    const configHash = await sha256(oracleFingerprint);
    const oracle = {
      resolver: resolverArgument,
      sourceProgram,
      sourceQueue,
      sourceId,
      comparator,
      threshold: new BN(threshold.toString()),
      thresholdExponent,
      observationTs: new BN(observationTs),
      observationWindowSecs,
      maxStalenessSecs,
      maxStalenessSlots: new BN(maxStalenessSlots.toString()),
      maxConfidenceBps,
      minSamples,
      challengePeriodSecs,
      bondAmount: new BN(bondAmount.toString()),
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
        category: categoryArgument(category),
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
        resolutionDeadlineTs: new BN(resolutionDeadlineTs),
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
      marketSignature = await sendAndConfirm(transaction, "market-signing", "market-confirming");
      setSignature(marketSignature);
    }
    const metadataAddress = hybridMetadataPda(marketAddress);
    const existingMetadata = await connection.getAccountInfo(metadataAddress, "confirmed");
    if (existingMetadata) {
      if (!existingMetadata.owner.equals(program.programId)) throw new Error("A different program owns the derived metadata address");
      return marketSignature;
    }
    const metadataTransaction = await program.methods.publishHybridMetadata({
      question,
      rules,
      yesLabel: "YES",
      noLabel: "NO",
      referenceUrl,
    }).accountsPartial({
      creator: publicKey,
      market: marketAddress,
      metadata: metadataAddress,
      systemProgram: SystemProgram.programId,
    }).transaction();
    return sendAndConfirm(metadataTransaction, "metadata-signing", "metadata-confirming");
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

  const usesMarketEngine = resolver !== "txline-replay";
  const pythProgramReady = selectedFeed
    ? selectedFeed.delivery === "sponsored-push" ? protocolStatus.pythPush : protocolStatus.pyth
    : false;
  const pythAccessReady = Boolean(selectedFeed) && (
    selectedFeed?.delivery === "sponsored-push"
    || Boolean(readiness?.pyth.authenticated)
    || Date.now() < PYTH_API_KEY_DATE
  );
  const resolverReady = resolver === "pyth"
    ? pythProgramReady && pythAccessReady && selectedFeed?.category === category
    : resolver === "switchboard"
      ? protocolStatus.switchboard && switchboardValidated
      : resolver === "stork"
        ? protocolStatus.stork && Boolean(readiness?.stork.available) && Boolean(storkAsset)
        : resolver === "txline-replay"
          ? protocolStatus.txline
          : true;
  const unavailable = !protocolStatus.program
    || !protocolStatus.protocol
    || (usesMarketEngine && !protocolStatus.engine)
    || !resolverReady;
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
              : usesMarketEngine
                ? "Create LMSR market"
                : "Create private replay pool";

  return (
    <div className="create-market-layout">
      <section className="create-form-card">
        <div className="form-section-heading"><span>01</span><div><strong>Market category</strong><p>Category determines which evidence systems the contract will accept.</p></div></div>
        <div className="category-choice-grid">
          {categories.map((item) => (
            <button type="button" className={category === item.id ? "category-choice active" : "category-choice"} onClick={() => selectCategory(item.id)} key={item.id} aria-pressed={category === item.id}>
              <i><MarketCategoryIcon category={item.label} size={17} /></i><strong>{item.label}</strong><span>{item.detail}</span>
            </button>
          ))}
        </div>

        <div className="form-section-heading"><span>02</span><div><strong>Resolution source</strong><p>Only category-compatible, contract-verifiable resolvers are shown.</p></div></div>
        <div className="resolver-grid">
          {resolverChoices(category).map((choice) => {
            const blocked = choice === "stork" && readiness !== null && !readiness.stork.available;
            return (
              <button type="button" disabled={blocked} className={resolver === choice ? "resolver-choice active" : "resolver-choice"} onClick={() => setResolver(choice)} key={choice} aria-pressed={resolver === choice}>
                <span><ResolverIcon resolver={resolverLabel(choice)} size={18} /></span>
                <div><strong>{resolverLabel(choice)}</strong><p>{choice === "pyth" ? "Prices across crypto, equities, FX, commodities, metals, and rates." : choice === "switchboard" ? "Canonical custom numeric feeds with multi-oracle signatures." : choice === "stork" ? "Token-gated coverage for 500+ price assets." : choice === "optimistic" ? "Long-tail facts with USDC bonds and challenge arbitration." : "Cryptographically validated World Cup replay data."}</p></div>
                <b>{blocked ? "API KEY NEEDED" : choice === "stork" ? "CONFIGURED KEY" : "AVAILABLE"}</b>
              </button>
            );
          })}
        </div>

        <div className="form-section-heading"><span>03</span><div><strong>Market predicate</strong><p>The feed, threshold, timestamp, and rules become immutable onchain inputs.</p></div></div>
        {resolver === "pyth" && (
          <>
            <label className="create-field"><span>Search Pyth feeds</span><div className="feed-search"><Search size={15} /><input value={feedQuery} onChange={(event) => setFeedQuery(event.target.value)} placeholder="Search BTC, Apple, EUR, gold, oil..." /></div></label>
            <div className="create-field-grid">
              <label className="create-field"><span>Pyth feed {feedLoading ? "- loading" : ""}</span><select value={selectedFeed?.id ?? ""} onChange={(event) => setSelectedFeed(pythFeeds.find((feed) => feed.id === event.target.value) ?? null)} disabled={pythFeeds.length === 0}>{pythFeeds.length === 0 && <option value="">No verified feeds found</option>}{pythFeeds.map((feed) => <option value={feed.id} key={feed.id}>{feed.symbol} - {feed.assetType}</option>)}</select></label>
              <label className="create-field"><span>Threshold in {selectedFeed?.quoteCurrency ?? "feed units"}</span><input value={priceThreshold} onChange={(event) => setPriceThreshold(event.target.value)} inputMode="decimal" disabled={!selectedFeed} /></label>
            </div>
            {selectedFeed
              ? <div className="oracle-feed-summary">
                <div><span>Delivery</span><b>{selectedFeed.delivery === "sponsored-push" ? "Sponsored Solana push" : "Hermes timestamped pull"}</b></div>
                <div><span>API key</span><b>{selectedFeed.delivery === "sponsored-push" ? "Not required" : readiness?.pyth.authenticated ? "Configured" : "Required Aug 18, 2026"}</b></div>
                <div><span>Asset class</span><b>{selectedFeed.assetType}</b></div>
                <div><span>Schedule</span><b>{selectedFeed.schedule ?? "Continuous or feed-defined"}</b></div>
                {feedDegraded && <p><AlertTriangle size={14} />Hermes search is degraded. Showing the sponsored fallback catalog.</p>}
              </div>
              : <div className="oracle-key-notice"><AlertTriangle size={16} /><p>No verified feed matches this category and search. Clear the search or configure Hermes access for the full Economics catalog.</p></div>}
          </>
        )}
        {resolver === "switchboard" && (
          <>
            <div className="create-field-grid"><label className="create-field"><span>Metric label</span><input value={switchboardLabel} onChange={(event) => setSwitchboardLabel(event.target.value)} maxLength={64} /></label><label className="create-field"><span>Unit</span><input value={switchboardUnit} onChange={(event) => setSwitchboardUnit(event.target.value)} maxLength={16} /></label></div>
            <label className="create-field"><span>Stored Switchboard feed hash</span><div className="feed-validation"><input value={switchboardFeedHash} onChange={(event) => { setSwitchboardFeedHash(event.target.value.trim()); setSwitchboardValidated(false); }} placeholder="64 hexadecimal characters" /><button type="button" onClick={() => void validateSwitchboard()} disabled={switchboardChecking}>{switchboardChecking ? "Checking" : switchboardValidated ? "Verified" : "Validate"}</button></div></label>
            <label className="create-field"><span>Threshold in {switchboardUnit || "configured units"}</span><input value={priceThreshold} onChange={(event) => setPriceThreshold(event.target.value)} inputMode="decimal" /></label>
          </>
        )}
        {resolver === "stork" && (
          <>
            {!readiness?.stork.available && <div className="oracle-key-notice"><KeyRound size={16} /><p>Add `STORK_API_TOKEN` on the server to list and verify Stork assets. The token never reaches the browser.</p></div>}
            <div className="create-field-grid"><label className="create-field"><span>Stork asset</span><select value={storkAssetId} onChange={(event) => setStorkAssetId(event.target.value)} disabled={!readiness?.stork.available}><option value="">Select an asset</option>{storkAssets.map((asset) => <option value={asset} key={asset}>{asset}</option>)}</select></label><label className="create-field"><span>Threshold in USD</span><input value={priceThreshold} onChange={(event) => setPriceThreshold(event.target.value)} inputMode="decimal" /></label></div>
            <div className="oracle-feed-summary"><div><span>Feed ID</span><code>{storkAsset ? `${storkAsset.feedId.slice(0, 10)}...${storkAsset.feedId.slice(-8)}` : "Waiting for verified metadata"}</code></div><div><span>Update model</span><b>External Stork chain pusher</b></div></div>
          </>
        )}
        {resolver === "optimistic" && (
          <>
            <label className="create-field"><span>Question</span><input value={customQuestion} onChange={(event) => setCustomQuestion(event.target.value)} maxLength={160} /></label>
            <label className="create-field"><span>Resolution rules</span><input value={customRules} onChange={(event) => setCustomRules(event.target.value)} maxLength={420} /></label>
            <label className="create-field"><span>Primary source URL</span><input value={customReferenceUrl} onChange={(event) => setCustomReferenceUrl(event.target.value)} placeholder="https://official-source.example/result" maxLength={160} /></label>
          </>
        )}
        {resolver === "txline-replay" && <div className="create-field-grid"><label className="create-field"><span>Covered fixture</span><select value={fixtureId} onChange={(event) => setFixtureId(Number(event.target.value))}>{fixtures.map((item) => <option value={item.id} key={item.id}>{item.label} - {item.group}</option>)}</select></label><label className="create-field"><span>Private order collateral ceiling</span><select value={privateStakeUsdc} onChange={(event) => setPrivateStakeUsdc(Number(event.target.value))}>{PRIVATE_STAKE_OPTIONS.map((amount) => <option value={amount} key={amount}>{amount.toLocaleString("en-US")} USDC</option>)}</select></label></div>}
        <label className="create-field"><span>Question preview</span><input value={question} readOnly /></label>
        {usesMarketEngine && <label className="create-field"><span>Resolution time in your local timezone</span><input type="datetime-local" value={resolutionAt} min={futureLocalDate(20)} onChange={(event) => setResolutionAt(event.target.value)} /></label>}

        <div className="form-section-heading"><span>04</span><div><strong>Economics and confirmation</strong><p>Market creators fund the deterministic LMSR loss bound before trading opens.</p></div></div>
        <div className="create-review">
          <div><span>Collateral</span><b className="asset-value"><UsdcTokenIcon size={15} />Devnet USDC</b></div>
          <div><span>Pricing</span><b>{usesMarketEngine ? "LMSR" : "Private pool"}</b></div>
          <div><span>Creator funding</span><b>{usesMarketEngine ? `${formatUsdc(INITIAL_SUBSIDY)} USDC` : "Account rent"}</b></div>
          <div><span>Trading fee</span><b>{usesMarketEngine ? "Up to 1% curve fee" : "1% on settlement"}</b></div>
          {!usesMarketEngine && <div><span>Hidden wager range</span><b>1 to {privateStakeUsdc.toLocaleString("en-US")} USDC</b></div>}
          <div><span>Protocol share</span><b>{usesMarketEngine ? "70% of trade fee" : "Treasury after keeper"}</b></div>
          <div><span>Market PDA</span><code>{marketAddress ? `${marketAddress.toBase58().slice(0, 8)}...${marketAddress.toBase58().slice(-8)}` : "Connect wallet to derive"}</code></div>
        </div>
        {!connected
          ? <button className="create-submit" type="button" onClick={() => setVisible(true)}><Wallet size={16} />Connect wallet to create</button>
          : <button className="create-submit" type="button" disabled={unavailable || busy || !marketAddress} onClick={() => void submit()}>{unavailable ? "Resolver configuration required" : submitLabel}</button>}
        {error && <div className="transaction-message error"><AlertTriangle size={15} /><span>{error}</span></div>}
        {signature && <div className="transaction-message success"><Check size={15} /><span>Market created and confirmed.</span><a href={`https://explorer.solana.com/tx/${signature}?cluster=devnet`} target="_blank" rel="noreferrer">Explorer <ExternalLink size={12} /></a></div>}
      </section>

      <aside className="create-side-card">
        <span className="eyebrow">Creation readiness</span>
        <h2>Every dependency is explicit.</h2>
        <div className="readiness-list">
          <div className={protocolStatus.program ? "ready" : "blocked"}><ShieldCheck size={15} /><span>Nortia program</span><b>{protocolStatus.loading ? "Checking" : protocolStatus.program ? "Ready" : "Not deployed"}</b></div>
          <div className={protocolStatus.engine ? "ready" : "blocked"}><ResolverIcon resolver="Market engine" size={15} /><span>LMSR market engine</span><b>{protocolStatus.loading ? "Checking" : protocolStatus.engine ? "Ready" : "Deployment required"}</b></div>
          <div className={resolverReady ? "ready" : "blocked"}><ResolverIcon resolver={resolverLabel(resolver)} size={15} /><span>{resolverLabel(resolver)}</span><b>{resolverReady ? "Verified" : "Unavailable"}</b></div>
        </div>
        <div className="creation-rule"><Clock3 size={16} /><p>Trading closes five minutes before the observation. Resolver evidence must land inside its immutable time window.</p></div>
        <div className="creation-rule"><UsdcTokenIcon size={16} /><p>The default 25 USDC liquidity parameter requires {formatUsdc(INITIAL_SUBSIDY)} USDC of creator subsidy and funds the LMSR worst-case loss bound.</p></div>
        <div className="creation-rule"><AlertTriangle size={16} /><p>If valid evidence does not arrive before the hard deadline, any keeper can invalidate the market and open the neutral refund path.</p></div>
        <div className="creation-rule"><KeyRound size={16} /><p>Pyth sponsored push and public Switchboard need no API key. Pyth pull requires a key from August 18, 2026. Stork requires `STORK_API_TOKEN` now.</p></div>
      </aside>
    </div>
  );
}

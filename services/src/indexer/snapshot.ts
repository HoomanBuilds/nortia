import { createHash } from "node:crypto";
import type { PublicKey } from "@solana/web3.js";
import { lmsrYesProbability } from "nortia-client/lmsr";
import { hybridPhaseName, oracleResolverName } from "../solana.js";

type IntegerLike = number | bigint | { toString(): string; toNumber?: () => number };
type EnumLike = Record<string, unknown>;

type HybridMarketAccount = {
  version: number;
  marketId: IntegerLike;
  creator: PublicKey;
  liquidityOwner: PublicKey;
  category: EnumLike;
  tradingMode: EnumLike;
  pricingModel: EnumLike;
  questionHash: number[];
  rulesHash: number[];
  outcomeLabelsHash: number[];
  collateralMint: PublicKey;
  tokenProgram: PublicKey;
  treasuryOwner: PublicKey;
  oracleConfig: PublicKey;
  liquidityParameter: IntegerLike;
  initialSubsidy: IntegerLike;
  roundingReserve: IntegerLike;
  maxTradeShares: IntegerLike;
  resolverSecurityCap: IntegerLike;
  yesQuantity: IntegerLike;
  noQuantity: IntegerLike;
  tradeFeeBps: number;
  treasuryFeeShareBps: number;
  openTs: IntegerLike;
  lockTs: IntegerLike;
  resolveNotBeforeTs: IntegerLike;
  resolutionDeadlineTs: IntegerLike;
  phase: EnumLike;
  outcome: number;
  tradeCount: IntegerLike;
  volume: IntegerLike;
  treasuryFees: IntegerLike;
  liquidityFees: IntegerLike;
  outstandingLiability: IntegerLike;
  redeemedLiability: IntegerLike;
  settledAt: IntegerLike;
  settlementEvidenceHash: number[];
};

type OracleAccount = {
  version: number;
  market: PublicKey;
  resolver: EnumLike;
  sourceProgram: PublicKey;
  sourceQueue: PublicKey;
  sourceId: number[];
  comparator: EnumLike;
  threshold: IntegerLike;
  thresholdExponent: number;
  observationTs: IntegerLike;
  observationWindowSecs: number;
  maxStalenessSecs: number;
  maxStalenessSlots: IntegerLike;
  maxConfidenceBps: number;
  minSamples: number;
  challengePeriodSecs: number;
  bondAmount: IntegerLike;
  configHash: number[];
  optimisticProposal: PublicKey;
  consumed: boolean;
};

type ResolutionReceiptAccount = {
  version: number;
  market: PublicKey;
  resolver: EnumLike;
  outcome: number;
  observationValue: IntegerLike;
  observationExponent: number;
  observationTs: IntegerLike;
  observationSlot: IntegerLike;
  confidence: IntegerLike;
  sampleCount: number;
  sourceQueue: PublicKey;
  sourceId: number[];
  sourceAccount: PublicKey;
  evidenceHash: number[];
  finalizedAt: IntegerLike;
};

type HybridMetadataAccount = {
  version: number;
  market: PublicKey;
  creator: PublicKey;
  question: string;
  rules: string;
  yesLabel: string;
  noLabel: string;
  referenceUrl: string;
  publishedAt: IntegerLike;
};

function integerString(value: IntegerLike, label: string): string {
  const encoded = value.toString();
  if (!/^-?\d+$/.test(encoded)) throw new Error(`${label} is not an integer`);
  return encoded;
}

function safeInteger(value: IntegerLike, label: string): number {
  const parsed = Number(integerString(value, label));
  if (!Number.isSafeInteger(parsed)) throw new Error(`${label} exceeds the safe integer range`);
  return parsed;
}

function bytes32(value: number[], label: string): string {
  const bytes = Buffer.from(value);
  if (bytes.length !== 32) throw new Error(`${label} must contain exactly 32 bytes`);
  return bytes.toString("hex");
}

function enumName<T extends string>(
  value: EnumLike,
  names: Readonly<Record<string, T>>,
  label: string,
): T {
  const key = Object.keys(value)[0];
  const name = key ? names[key] : undefined;
  if (!name) throw new Error(`Unknown ${label}`);
  return name;
}

function outcomeName(value: number): "no" | "yes" | "invalid" | "unset" {
  const outcomes = ["no", "yes", "invalid", "unset"] as const;
  const outcome = outcomes[value];
  if (!outcome) throw new Error("Unknown hybrid market outcome");
  return outcome;
}

function comparatorName(value: EnumLike) {
  return enumName(
    value,
    {
      greaterThan: "greater-than",
      greaterThanOrEqual: "greater-than-or-equal",
      lessThan: "less-than",
      lessThanOrEqual: "less-than-or-equal",
      equal: "equal",
    },
    "value comparator",
  );
}

function buildMetadataSnapshot(
  metadata: HybridMetadataAccount,
  market: HybridMarketAccount,
  address: PublicKey,
) {
  if (!metadata.market.equals(address) || !metadata.creator.equals(market.creator)) {
    throw new Error("Hybrid metadata belongs to a different market or creator");
  }
  const questionHash = createHash("sha256").update(metadata.question, "utf8").digest("hex");
  const rulesHash = createHash("sha256").update(metadata.rules, "utf8").digest("hex");
  const labelsHash = createHash("sha256")
    .update(`${metadata.yesLabel}\n${metadata.noLabel}`, "utf8")
    .digest("hex");
  if (
    questionHash !== bytes32(market.questionHash, "question hash")
    || rulesHash !== bytes32(market.rulesHash, "rules hash")
    || labelsHash !== bytes32(market.outcomeLabelsHash, "outcome labels hash")
  ) {
    throw new Error("Hybrid metadata hashes do not match immutable market state");
  }
  return {
    version: metadata.version,
    market: metadata.market.toBase58(),
    creator: metadata.creator.toBase58(),
    question: metadata.question,
    rules: metadata.rules,
    yesLabel: metadata.yesLabel,
    noLabel: metadata.noLabel,
    referenceUrl: metadata.referenceUrl || null,
    publishedAt: integerString(metadata.publishedAt, "metadata publication timestamp"),
  };
}

export function buildResolutionReceiptSnapshot(receipt: ResolutionReceiptAccount) {
  return {
    version: receipt.version,
    market: receipt.market.toBase58(),
    resolver: oracleResolverName(receipt.resolver),
    outcome: outcomeName(receipt.outcome),
    observationValue: integerString(receipt.observationValue, "observation value"),
    observationExponent: receipt.observationExponent,
    observationTs: integerString(receipt.observationTs, "observation timestamp"),
    observationSlot: integerString(receipt.observationSlot, "observation slot"),
    confidence: integerString(receipt.confidence, "observation confidence"),
    sampleCount: receipt.sampleCount,
    sourceQueue: receipt.sourceQueue.toBase58(),
    sourceId: bytes32(receipt.sourceId, "receipt source ID"),
    sourceAccount: receipt.sourceAccount.toBase58(),
    evidenceHash: bytes32(receipt.evidenceHash, "receipt evidence hash"),
    finalizedAt: integerString(receipt.finalizedAt, "receipt finalization timestamp"),
  };
}

export function buildHybridMarketSnapshot(input: {
  address: PublicKey;
  vault: PublicKey;
  vaultBalance: bigint | null;
  market: HybridMarketAccount;
  oracle: OracleAccount;
  receipt: ResolutionReceiptAccount | null;
  metadata: HybridMetadataAccount | null;
  traderCount: number;
  now: number;
}) {
  if (!input.oracle.market.equals(input.address)) {
    throw new Error("Oracle config belongs to a different hybrid market");
  }
  if (input.receipt && !input.receipt.market.equals(input.address)) {
    throw new Error("Resolution receipt belongs to a different hybrid market");
  }
  const liquidityParameter = BigInt(integerString(input.market.liquidityParameter, "liquidity parameter"));
  const yesQuantity = BigInt(integerString(input.market.yesQuantity, "YES quantity"));
  const noQuantity = BigInt(integerString(input.market.noQuantity, "NO quantity"));
  const phase = hybridPhaseName(input.market.phase);
  const lockTs = safeInteger(input.market.lockTs, "lock timestamp");
  const resolver = oracleResolverName(input.oracle.resolver);

  return {
    version: input.market.version,
    address: input.address.toBase58(),
    marketId: integerString(input.market.marketId, "market ID"),
    creator: input.market.creator.toBase58(),
    liquidityOwner: input.market.liquidityOwner.toBase58(),
    category: enumName(
      input.market.category,
      {
        sports: "sports",
        crypto: "crypto",
        politics: "politics",
        technology: "technology",
        culture: "culture",
        other: "other",
      },
      "market category",
    ),
    tradingMode: enumName(
      input.market.tradingMode,
      { continuous: "continuous", privateBatch: "private-batch" },
      "hybrid trading mode",
    ),
    pricingModel: enumName(input.market.pricingModel, { lmsr: "lmsr" }, "pricing model"),
    questionHash: bytes32(input.market.questionHash, "question hash"),
    rulesHash: bytes32(input.market.rulesHash, "rules hash"),
    outcomeLabelsHash: bytes32(input.market.outcomeLabelsHash, "outcome labels hash"),
    collateralMint: input.market.collateralMint.toBase58(),
    tokenProgram: input.market.tokenProgram.toBase58(),
    treasuryOwner: input.market.treasuryOwner.toBase58(),
    oracleConfigAddress: input.market.oracleConfig.toBase58(),
    vault: input.vault.toBase58(),
    vaultBalance: input.vaultBalance?.toString() ?? null,
    liquidityParameter: liquidityParameter.toString(),
    initialSubsidy: integerString(input.market.initialSubsidy, "initial subsidy"),
    roundingReserve: integerString(input.market.roundingReserve, "rounding reserve"),
    maxTradeShares: integerString(input.market.maxTradeShares, "maximum trade shares"),
    resolverSecurityCap: integerString(input.market.resolverSecurityCap, "resolver security cap"),
    yesQuantity: yesQuantity.toString(),
    noQuantity: noQuantity.toString(),
    yesProbabilityPpm: Number(lmsrYesProbability({ yes: yesQuantity, no: noQuantity }, liquidityParameter)),
    tradeFeeBps: input.market.tradeFeeBps,
    treasuryFeeShareBps: input.market.treasuryFeeShareBps,
    openTs: integerString(input.market.openTs, "open timestamp"),
    lockTs: lockTs.toString(),
    resolveNotBeforeTs: integerString(input.market.resolveNotBeforeTs, "resolution start timestamp"),
    resolutionDeadlineTs: integerString(input.market.resolutionDeadlineTs, "resolution deadline"),
    phase,
    tradingOpen: phase === "open" && input.now < lockTs,
    outcome: outcomeName(input.market.outcome),
    tradeCount: integerString(input.market.tradeCount, "trade count"),
    traderCount: input.traderCount,
    volume: integerString(input.market.volume, "volume"),
    treasuryFees: integerString(input.market.treasuryFees, "treasury fees"),
    liquidityFees: integerString(input.market.liquidityFees, "liquidity fees"),
    outstandingLiability: integerString(input.market.outstandingLiability, "outstanding liability"),
    redeemedLiability: integerString(input.market.redeemedLiability, "redeemed liability"),
    settledAt: integerString(input.market.settledAt, "settlement timestamp"),
    settlementEvidenceHash: bytes32(
      input.market.settlementEvidenceHash,
      "market settlement evidence hash",
    ),
    resolver,
    oracle: {
      version: input.oracle.version,
      resolver,
      sourceProgram: input.oracle.sourceProgram.toBase58(),
      sourceQueue: input.oracle.sourceQueue.toBase58(),
      sourceId: bytes32(input.oracle.sourceId, "oracle source ID"),
      comparator: comparatorName(input.oracle.comparator),
      threshold: integerString(input.oracle.threshold, "oracle threshold"),
      thresholdExponent: input.oracle.thresholdExponent,
      observationTs: integerString(input.oracle.observationTs, "oracle observation timestamp"),
      observationWindowSecs: input.oracle.observationWindowSecs,
      maxStalenessSecs: input.oracle.maxStalenessSecs,
      maxStalenessSlots: integerString(input.oracle.maxStalenessSlots, "oracle maximum staleness slots"),
      maxConfidenceBps: input.oracle.maxConfidenceBps,
      minSamples: input.oracle.minSamples,
      challengePeriodSecs: input.oracle.challengePeriodSecs,
      bondAmount: integerString(input.oracle.bondAmount, "optimistic bond amount"),
      configHash: bytes32(input.oracle.configHash, "oracle config hash"),
      optimisticProposal: input.oracle.optimisticProposal.toBase58(),
      consumed: input.oracle.consumed,
    },
    receipt: input.receipt ? buildResolutionReceiptSnapshot(input.receipt) : null,
    metadata: input.metadata
      ? buildMetadataSnapshot(input.metadata, input.market, input.address)
      : null,
  };
}

export type HybridMarketSnapshot = ReturnType<typeof buildHybridMarketSnapshot>;

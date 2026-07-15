import assert from "node:assert/strict";
import test from "node:test";
import { PublicKey } from "@solana/web3.js";
import {
  buildHybridMarketSnapshot,
  buildResolutionReceiptSnapshot,
} from "./snapshot.js";

const key = (seed: number) => new PublicKey(Uint8Array.from({ length: 32 }, () => seed));
const integer = (value: number | bigint) => ({
  toNumber: () => Number(value),
  toString: () => value.toString(),
});

const market = {
  version: 2,
  marketId: integer(42),
  creator: key(1),
  liquidityOwner: key(2),
  category: { crypto: {} },
  tradingMode: { continuous: {} },
  pricingModel: { lmsr: {} },
  questionHash: Array(32).fill(3),
  rulesHash: Array(32).fill(4),
  outcomeLabelsHash: Array(32).fill(5),
  collateralMint: key(6),
  tokenProgram: key(7),
  treasuryOwner: key(8),
  oracleConfig: key(9),
  liquidityParameter: integer(100_000_000),
  initialSubsidy: integer(69_314_721),
  roundingReserve: integer(2),
  maxTradeShares: integer(10_000_000),
  resolverSecurityCap: integer(0),
  yesQuantity: integer(10_000_000),
  noQuantity: integer(0),
  tradeFeeBps: 100,
  treasuryFeeShareBps: 7_000,
  openTs: integer(900),
  lockTs: integer(1_100),
  resolveNotBeforeTs: integer(1_200),
  resolutionDeadlineTs: integer(1_500),
  phase: { open: {} },
  outcome: 3,
  tradeCount: integer(7),
  volume: integer(24_000_000),
  treasuryFees: integer(12_345),
  liquidityFees: integer(5_290),
  outstandingLiability: integer(0),
  redeemedLiability: integer(0),
  settledAt: integer(0),
  settlementEvidenceHash: Array(32).fill(0),
};

const oracle = {
  version: 1,
  market: key(10),
  resolver: { pythPriceV2: {} },
  sourceProgram: key(11),
  sourceQueue: PublicKey.default,
  sourceId: Array(32).fill(12),
  comparator: { greaterThanOrEqual: {} },
  threshold: integer(100_000),
  thresholdExponent: -2,
  observationTs: integer(1_200),
  observationWindowSecs: 30,
  maxStalenessSecs: 5,
  maxStalenessSlots: integer(0),
  maxConfidenceBps: 100,
  minSamples: 0,
  challengePeriodSecs: 0,
  bondAmount: integer(0),
  configHash: Array(32).fill(13),
  optimisticProposal: PublicKey.default,
  consumed: false,
};

test("V2 snapshot preserves exact amounts and deterministic LMSR probability", () => {
  const snapshot = buildHybridMarketSnapshot({
    address: key(10),
    vault: key(14),
    vaultBalance: 75_000_000n,
    market,
    oracle,
    receipt: null,
    traderCount: 4,
    now: 1_000,
  });

  assert.equal(snapshot.marketId, "42");
  assert.equal(snapshot.category, "crypto");
  assert.equal(snapshot.resolver, "pyth-price-v2");
  assert.equal(snapshot.yesProbabilityPpm, 524_980);
  assert.equal(snapshot.vaultBalance, "75000000");
  assert.equal(snapshot.volume, "24000000");
  assert.equal(snapshot.tradingOpen, true);
  assert.equal(snapshot.outcome, "unset");
  assert.equal(snapshot.oracle.comparator, "greater-than-or-equal");
  assert.equal(snapshot.oracle.threshold, "100000");
  assert.equal(snapshot.receipt, null);
});

test("snapshot closes trading at the exact lock boundary", () => {
  const snapshot = buildHybridMarketSnapshot({
    address: key(10),
    vault: key(14),
    vaultBalance: null,
    market,
    oracle,
    receipt: null,
    traderCount: 0,
    now: 1_100,
  });
  assert.equal(snapshot.tradingOpen, false);
  assert.equal(snapshot.vaultBalance, null);
});

test("resolution receipts expose immutable oracle evidence", () => {
  const receipt = buildResolutionReceiptSnapshot({
    version: 1,
    market: key(10),
    resolver: { switchboardQuoteV1: {} },
    outcome: 1,
    observationValue: integer(1_234_000_000_000_000_000n),
    observationExponent: -18,
    observationTs: integer(1_300),
    observationSlot: integer(999),
    confidence: integer(0),
    sampleCount: 3,
    sourceQueue: key(15),
    sourceId: Array(32).fill(16),
    sourceAccount: key(17),
    evidenceHash: Array(32).fill(18),
    finalizedAt: integer(1_305),
  });

  assert.equal(receipt.resolver, "switchboard-quote-v1");
  assert.equal(receipt.outcome, "yes");
  assert.equal(receipt.observationValue, "1234000000000000000");
  assert.equal(receipt.sampleCount, 3);
  assert.equal(receipt.evidenceHash, "12".repeat(32));
});

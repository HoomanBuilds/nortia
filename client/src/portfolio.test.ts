import assert from "node:assert/strict";
import test from "node:test";
import {
  HYBRID_LIQUIDITY_OWNER_OFFSET,
  POSITION_OWNER_OFFSET,
  hybridPositionPayout,
  hybridPositionStatus,
  hybridMarkedPnl,
  hybridMarkedValue,
  hybridRealizedPnl,
  withdrawableHybridLiquidity,
} from "./portfolio.js";

test("wallet memcmp filters match the Anchor account prefixes", () => {
  assert.equal(POSITION_OWNER_OFFSET, 8 + 1 + 1 + 32);
  assert.equal(HYBRID_LIQUIDITY_OWNER_OFFSET, 8 + 1 + 1 + 1 + 8 + 32);
});

test("binary settlement pays exactly one USDC per winning share", () => {
  const position = { yesShares: 7_250_000n, noShares: 2_000_000n };
  assert.equal(hybridPositionPayout(position, "yes"), 7_250_000n);
  assert.equal(hybridPositionPayout(position, "no"), 2_000_000n);
});

test("invalid settlement refunds half of aggregate shares with floor rounding", () => {
  assert.equal(
    hybridPositionPayout({ yesShares: 3_000_001n, noShares: 2_000_000n }, "invalid"),
    2_500_000n,
  );
});

test("position status follows the onchain lifecycle and payout", () => {
  const shares = { yesShares: 3_000_000n, noShares: 1_000_000n };
  assert.equal(hybridPositionStatus("open", "unset", false, shares), "open");
  assert.equal(hybridPositionStatus("locked", "unset", false, shares), "locked");
  assert.equal(hybridPositionStatus("resolving", "unset", false, shares), "resolving");
  assert.equal(hybridPositionStatus("disputed", "unset", false, shares), "disputed");
  assert.equal(hybridPositionStatus("resolved", "yes", false, shares), "claimable");
  assert.equal(hybridPositionStatus("resolved", "no", false, { yesShares: 3_000_000n, noShares: 0n }), "lost");
  assert.equal(hybridPositionStatus("resolved", "yes", true, shares), "settled");
});

test("realized profit and loss includes prior sell proceeds", () => {
  assert.equal(hybridRealizedPnl({
    totalSpent: 8_000_000n,
    totalProceeds: 2_250_000n,
    payout: 7_000_000n,
  }), 1_250_000n);
  assert.equal(hybridRealizedPnl({
    totalSpent: 8_000_000n,
    totalProceeds: 2_250_000n,
    payout: 0n,
  }), -5_750_000n);
});

test("open positions use the current LMSR probabilities for marked value", () => {
  const markedValue = hybridMarkedValue({
    yesShares: 8_000_000n,
    noShares: 2_000_000n,
  }, 625_000n);
  assert.equal(markedValue, 5_750_000n);
  assert.equal(hybridMarkedPnl({
    totalSpent: 6_500_000n,
    totalProceeds: 1_000_000n,
    markedValue,
  }), 250_000n);
});

test("position mark rejects an invalid probability", () => {
  const position = { yesShares: 1_000_000n, noShares: 0n };
  assert.throws(() => hybridMarkedValue(position, -1n), /probability/i);
  assert.throws(() => hybridMarkedValue(position, 1_000_001n), /probability/i);
});

test("liquidity withdrawal never consumes unsettled trader liability", () => {
  assert.equal(withdrawableHybridLiquidity(30_000_000n, 11_250_000n), 18_750_000n);
  assert.equal(withdrawableHybridLiquidity(11_250_000n, 11_250_000n), 0n);
  assert.throws(() => withdrawableHybridLiquidity(11_249_999n, 11_250_000n), /insolvent/i);
});

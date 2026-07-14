import assert from "node:assert/strict";
import test from "node:test";
import {
  LMSR_FIXED_SCALE,
  LMSR_PROBABILITY_SCALE,
  MAX_IMBALANCE_MULTIPLIER,
  MAX_TRADING_FEE_BPS,
  MIN_TRADE_SHARES,
  lmsrCostFixed,
  lmsrYesProbability,
  quoteLmsrBuy,
  quoteLmsrSell,
  requiredLmsrSubsidy,
  type MarketQuantities,
  type OutcomeSide,
} from "./lmsr.js";

const B = 100_000_000n;

test("initial market is balanced and fully subsidized", () => {
  const state = { yes: 0n, no: 0n };
  assert.equal(lmsrYesProbability(state, B), 500_000n);
  assert.equal(requiredLmsrSubsidy(B, 2n), 69_314_721n);
  assert.ok(lmsrCostFixed(state, B) > 69_314_718n * LMSR_FIXED_SCALE);
});

test("known quotes match the contract vectors", () => {
  const vectors = [
    {
      state: { yes: 0n, no: 0n },
      side: "yes" as const,
      shares: 10_000_000n,
      rawAmount: 5_124_948n,
      feeAmount: 24_985n,
      afterProbability: 524_980n,
    },
    {
      state: { yes: 75_000_000n, no: 20_000_000n },
      side: "no" as const,
      shares: 30_000_000n,
      rawAmount: 12_044_694n,
      feeAmount: 72_089n,
      afterProbability: 562_177n,
    },
  ];
  for (const vector of vectors) {
    const quote = quoteLmsrBuy(vector.state, B, vector.side, vector.shares, 100);
    assert.equal(quote.rawAmount, vector.rawAmount);
    assert.equal(quote.feeAmount, vector.feeAmount);
    assert.equal(quote.afterYesProbability, vector.afterProbability);
  }
});

test("integer quotes agree with an independent floating reference", () => {
  const liquidity = 100_000_000;
  const shares = 12_340_000;
  const referenceCost = (yes: number, no: number) => {
    const maximum = Math.max(yes, no);
    return maximum + liquidity * Math.log1p(Math.exp(-Math.abs(yes - no) / liquidity));
  };
  for (let yes = 0; yes <= 200_000_000; yes += 20_000_000) {
    for (let no = 0; no <= 200_000_000; no += 20_000_000) {
      for (const side of ["yes", "no"] as const) {
        const afterYes = yes + (side === "yes" ? shares : 0);
        const afterNo = no + (side === "no" ? shares : 0);
        const expected = Math.ceil(referenceCost(afterYes, afterNo) - referenceCost(yes, no));
        const quote = quoteLmsrBuy(
          { yes: BigInt(yes), no: BigInt(no) },
          BigInt(liquidity),
          side,
          BigInt(shares),
          100,
        );
        assert.ok(Math.abs(Number(quote.rawAmount) - expected) <= 1);
      }
    }
  }
});

test("YES and NO prices remain exact complements", () => {
  const start = { yes: 0n, no: 0n };
  const yes = quoteLmsrBuy(start, B, "yes", 25_000_000n, 100);
  const no = quoteLmsrBuy(start, B, "no", 25_000_000n, 100);
  assert.equal(yes.rawAmount, no.rawAmount);
  assert.equal(yes.feeAmount, no.feeAmount);
  assert.equal(yes.afterYesProbability, LMSR_PROBABILITY_SCALE - no.afterYesProbability);
});

test("same-side demand increases price and average fill", () => {
  const first = quoteLmsrBuy({ yes: 0n, no: 0n }, B, "yes", 10_000_000n, 100);
  const second = quoteLmsrBuy(first.after, B, "yes", 10_000_000n, 100);
  assert.ok(first.afterYesProbability > first.beforeYesProbability);
  assert.ok(second.afterYesProbability > first.afterYesProbability);
  assert.ok(second.rawAmount > first.rawAmount);
});

test("an immediate round trip cannot profit", () => {
  const start = { yes: 0n, no: 0n };
  const buy = quoteLmsrBuy(start, B, "yes", 10_000_000n, 100);
  const sell = quoteLmsrSell(buy.after, B, "yes", 10_000_000n, 100);
  assert.deepEqual(sell.after, start);
  assert.ok(buy.totalAmount > sell.totalAmount);
  assert.ok(buy.rawAmount >= sell.rawAmount);
});

test("randomized buys and sells preserve collateral coverage", () => {
  let state: MarketQuantities = { yes: 0n, no: 0n };
  const positions: Record<OutcomeSide, bigint> = { yes: 0n, no: 0n };
  let vault = requiredLmsrSubsidy(B, 2n);
  let seed = 7n;
  const mask = (1n << 64n) - 1n;
  for (let index = 0; index < 5_000; index += 1) {
    seed = (seed * 6_364_136_223_846_793_005n + 1n) & mask;
    const side: OutcomeSide = (seed & 1n) === 0n ? "yes" : "no";
    const sell = (seed & 2n) !== 0n && positions[side] >= MIN_TRADE_SHARES;
    const maximum = sell && positions[side] < 2_000_000n ? positions[side] : 2_000_000n;
    const steps = maximum / MIN_TRADE_SHARES;
    const shares = ((seed % (steps > 0n ? steps : 1n)) + 1n) * MIN_TRADE_SHARES;
    const quote = sell
      ? quoteLmsrSell(state, B, side, shares, 100)
      : quoteLmsrBuy(state, B, side, shares, 100);
    if (sell) {
      positions[side] -= shares;
      vault -= quote.rawAmount;
    } else {
      positions[side] += shares;
      vault += quote.rawAmount;
    }
    state = quote.after;
    assert.equal(state.yes, positions.yes);
    assert.equal(state.no, positions.no);
    assert.ok(vault >= (state.yes > state.no ? state.yes : state.no));
  }
});

test("invalid size, fee, balance, and imbalance fail closed", () => {
  assert.throws(() => quoteLmsrBuy({ yes: 0n, no: 0n }, B, "yes", MIN_TRADE_SHARES - 1n, 0));
  assert.throws(() => quoteLmsrBuy({ yes: 0n, no: 0n }, B, "yes", MIN_TRADE_SHARES, MAX_TRADING_FEE_BPS + 1));
  assert.throws(() => quoteLmsrSell({ yes: 0n, no: 0n }, B, "yes", MIN_TRADE_SHARES, 0));
  assert.throws(() => lmsrYesProbability({ yes: B * MAX_IMBALANCE_MULTIPLIER + 1n, no: 0n }, B));
});

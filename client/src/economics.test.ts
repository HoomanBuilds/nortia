import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateSettlement,
  calculatePrivatePayout,
  formatUsdc,
  marketAction,
  parseUsdc,
} from "./economics.js";

test("private liquidity pool charges one percent once at settlement", () => {
  assert.deepEqual(calculateSettlement(63_000_000n, 42_000_000n, 100), {
    grossPool: 63_000_000n,
    protocolFee: 630_000n,
    keeperReward: 63_000n,
    treasuryFee: 567_000n,
    netPool: 62_370_000n,
  });
});

test("settlement validates boundaries and uses integer floor division", () => {
  assert.deepEqual(calculateSettlement(3n, 2n, 1), {
    grossPool: 3n,
    protocolFee: 0n,
    keeperReward: 0n,
    treasuryFee: 0n,
    netPool: 3n,
  });
  assert.throws(() => calculateSettlement(0n, 1n, 100), /positive/);
  assert.throws(() => calculateSettlement(3n, 0n, 100), /winning amount/);
  assert.throws(() => calculateSettlement(3n, 4n, 100), /winning amount/);
  assert.throws(() => calculateSettlement(3n, 2n, 301), /basis points/);
  assert.throws(() => calculateSettlement(3n, 2n, 100, 5_001), /keeper reward/);
});

test("private payout returns unused collateral and proportional winnings", () => {
  assert.deepEqual(calculatePrivatePayout(100_000_000n, 37_000_000n, true, 62_370_000n, 42_000_000n), {
    unusedCollateral: 63_000_000n,
    marketPayout: 54_945_000n,
    payoutAmount: 117_945_000n,
  });
  assert.deepEqual(calculatePrivatePayout(100_000_000n, 12_000_000n, false, 62_370_000n, 42_000_000n), {
    unusedCollateral: 88_000_000n,
    marketPayout: 0n,
    payoutAmount: 88_000_000n,
  });
  assert.throws(() => calculatePrivatePayout(100n, 101n, true, 100n, 50n), /within/);
});

test("USDC values never use scientific notation", () => {
  assert.equal(formatUsdc(0n), "0");
  assert.equal(formatUsdc(1n), "0.000001");
  assert.equal(formatUsdc(1_485_000n), "1.485");
  assert.equal(formatUsdc(123_456_789_000_001n), "123,456,789.000001");
  assert.equal(formatUsdc(-1_000_000n), "-1");
});

test("USDC parser accepts six decimals and rejects ambiguous forms", () => {
  assert.equal(parseUsdc("1"), 1_000_000n);
  assert.equal(parseUsdc("1.485"), 1_485_000n);
  assert.equal(parseUsdc("0.000001"), 1n);
  assert.throws(() => parseUsdc("01"));
  assert.throws(() => parseUsdc("1.0000001"));
  assert.throws(() => parseUsdc("1e6"));
  assert.throws(() => parseUsdc("-1"));
});

test("market actions map contract phases and lock boundary", () => {
  assert.equal(marketAction("open", 99, 100), "place");
  assert.equal(marketAction("open", 100, 100), "await-batch");
  assert.equal(marketAction("batched", 100, 100), "settle");
  assert.equal(marketAction("resolved", 100, 100), "claim");
  assert.equal(marketAction("refunding", 100, 100), "refund");
  assert.equal(marketAction("closed", 100, 100), "closed");
});

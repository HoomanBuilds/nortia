import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateSettlement,
  formatUsdc,
  marketAction,
  parseUsdc,
} from "./economics.js";

test("three-ticket pool charges one percent once at settlement", () => {
  assert.deepEqual(calculateSettlement(1_000_000n, 3, 2, 100), {
    grossPool: 3_000_000n,
    protocolFee: 30_000n,
    netPool: 2_970_000n,
    payoutPerWinner: 1_485_000n,
  });
});

test("settlement validates boundaries and uses integer floor division", () => {
  assert.deepEqual(calculateSettlement(1n, 3, 2, 1), {
    grossPool: 3n,
    protocolFee: 0n,
    netPool: 3n,
    payoutPerWinner: 1n,
  });
  assert.throws(() => calculateSettlement(0n, 3, 2, 100), /positive/);
  assert.throws(() => calculateSettlement(1n, 0, 1, 100), /order count/);
  assert.throws(() => calculateSettlement(1n, 3, 0, 100), /winner count/);
  assert.throws(() => calculateSettlement(1n, 3, 4, 100), /winner count/);
  assert.throws(() => calculateSettlement(1n, 3, 2, 301), /basis points/);
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

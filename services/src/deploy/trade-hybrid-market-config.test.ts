import assert from "node:assert/strict";
import test from "node:test";
import {
  resolveSlippageBps,
  resolveTradeDirection,
  resolveTradeShares,
  resolveTradeSide,
} from "./trade-hybrid-market-config.js";

test("hybrid trade configuration uses safe defaults", () => {
  assert.equal(resolveTradeDirection(undefined), "buy");
  assert.equal(resolveTradeSide(undefined), "yes");
  assert.equal(resolveTradeShares(undefined), 1_000_000n);
  assert.equal(resolveSlippageBps(undefined), 100);
});

test("hybrid trade configuration rejects ambiguous or unsafe values", () => {
  assert.throws(() => resolveTradeDirection("hold"), /buy or sell/);
  assert.throws(() => resolveTradeSide("maybe"), /yes or no/);
  assert.throws(() => resolveTradeShares("0.009999"), /at least/);
  assert.throws(() => resolveSlippageBps("0"), /1 to 1000/);
  assert.throws(() => resolveSlippageBps("1001"), /1 to 1000/);
});

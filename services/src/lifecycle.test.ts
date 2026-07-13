import assert from "node:assert/strict";
import test from "node:test";
import { planKeeperAction, type IndexedMarket } from "./lifecycle.js";

const base: IndexedMarket = {
  phase: "open",
  lockTs: 100,
  batchDeadlineTs: 200,
  resolutionDeadlineTs: 300,
};

test("open markets accept no keeper transition before lock", () => {
  assert.equal(planKeeperAction(base, 99), "none");
});

test("locked markets request batching through the inclusive deadline", () => {
  assert.equal(planKeeperAction(base, 100), "submit-batch");
  assert.equal(planKeeperAction(base, 200), "submit-batch");
});

test("missed batch and resolution deadlines open refunds", () => {
  assert.equal(planKeeperAction(base, 201), "begin-refund");
  assert.equal(planKeeperAction({ ...base, phase: "batched" }, 301), "begin-refund");
});

test("batched markets resolve before the deadline", () => {
  assert.equal(planKeeperAction({ ...base, phase: "batched" }, 300), "resolve");
});

test("terminal phases never produce keeper work", () => {
  for (const phase of ["resolved", "refunding", "closed"] as const) {
    assert.equal(planKeeperAction({ ...base, phase }, 1_000), "none");
  }
});

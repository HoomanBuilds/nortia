import assert from "node:assert/strict";
import test from "node:test";
import {
  planHybridKeeperAction,
  type HybridKeeperInput,
  type HybridResolver,
} from "./hybrid-lifecycle.js";
import { hybridPhaseName, oracleResolverName } from "./solana.js";

const base: HybridKeeperInput = {
  phase: "open",
  resolver: "pyth-price",
  lockTs: 100,
  resolveNotBeforeTs: 120,
  resolutionDeadlineTs: 200,
  proposal: null,
};

test("open LMSR markets lock before their resolution boundary", () => {
  assert.equal(planHybridKeeperAction(base, 99), "none");
  assert.equal(planHybridKeeperAction(base, 100), "lock");
  assert.equal(planHybridKeeperAction({ ...base, phase: "locked" }, 100), "none");
});

test("machine resolvers become actionable at the inclusive observation boundary", () => {
  const expected = new Map<HybridResolver, ReturnType<typeof planHybridKeeperAction>>([
    ["pyth-price", "resolve-pyth"],
    ["txline-stat", "resolve-txline"],
    ["switchboard-quote", "resolve-switchboard"],
    ["stork-price", "resolve-stork"],
  ]);
  for (const [resolver, action] of expected) {
    assert.equal(planHybridKeeperAction({ ...base, resolver }, 120), action);
    assert.equal(planHybridKeeperAction({ ...base, resolver, phase: "locked" }, 200), action);
  }
});

test("machine resolver timeout is strict and terminal states remain inert", () => {
  assert.equal(planHybridKeeperAction(base, 200), "resolve-pyth");
  assert.equal(planHybridKeeperAction(base, 201), "resolve-timeout");
  for (const phase of ["resolved", "closed"] as const) {
    assert.equal(planHybridKeeperAction({ ...base, phase }, 1_000), "none");
  }
});

test("optimistic assertions finalize only after their challenge window", () => {
  const optimistic: HybridKeeperInput = {
    ...base,
    resolver: "optimistic",
    phase: "resolving",
    proposal: { challengeDeadline: 150, challenged: false, finalized: false },
  };
  assert.equal(planHybridKeeperAction(optimistic, 150), "none");
  assert.equal(planHybridKeeperAction(optimistic, 151), "finalize-optimistic");
});

test("optimistic disputes wait for arbitration and timeout to invalid", () => {
  const disputed: HybridKeeperInput = {
    ...base,
    resolver: "optimistic",
    phase: "disputed",
    proposal: { challengeDeadline: 150, challenged: true, finalized: false },
  };
  assert.equal(planHybridKeeperAction(disputed, 200), "none");
  assert.equal(planHybridKeeperAction(disputed, 201), "timeout-optimistic-dispute");

  const unchallenged = {
    ...disputed,
    phase: "resolving" as const,
    proposal: { challengeDeadline: 150, challenged: false, finalized: false },
  };
  assert.equal(planHybridKeeperAction(unchallenged, 201), "finalize-optimistic");
});

test("optimistic markets without an assertion use generic hard timeout", () => {
  const optimistic = { ...base, resolver: "optimistic" as const };
  assert.equal(planHybridKeeperAction(optimistic, 120), "none");
  assert.equal(planHybridKeeperAction(optimistic, 201), "resolve-timeout");
});

test("disabled resolver variants never produce a settlement action", () => {
  for (const resolver of ["uma-wormhole", "chainlink-report"] as const) {
    assert.equal(planHybridKeeperAction({ ...base, resolver }, 120), "none");
    assert.equal(planHybridKeeperAction({ ...base, resolver }, 201), "resolve-timeout");
  }
});

test("Anchor enum objects map to the keeper's stable names", () => {
  assert.equal(hybridPhaseName({ open: {} }), "open");
  assert.equal(hybridPhaseName({ resolving: {} }), "resolving");
  assert.equal(oracleResolverName({ txlineStat: {} }), "txline-stat");
  assert.equal(oracleResolverName({ pythPrice: {} }), "pyth-price");
  assert.equal(oracleResolverName({ switchboardQuote: {} }), "switchboard-quote");
  assert.equal(oracleResolverName({ optimistic: {} }), "optimistic");
  assert.equal(oracleResolverName({ storkPrice: {} }), "stork-price");
  assert.throws(() => hybridPhaseName({ broken: {} }), /hybrid phase/);
  assert.throws(() => oracleResolverName({ broken: {} }), /oracle resolver/);
});

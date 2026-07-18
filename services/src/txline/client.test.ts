import assert from "node:assert/strict";
import test from "node:test";
import { isFinalScore, latestFinalScore } from "./client.js";
import { toBytes32, validationPayload } from "./validation.js";

test("final score selection requires final action, status, period, and positive sequence", () => {
  assert.equal(isFinalScore({ action: "game_finalised", statusId: 100, period: 100, seq: 7 }), true);
  assert.equal(isFinalScore({ action: "game_finalised", statusId: 100, period: 100, seq: 0 }), false);
  assert.equal(isFinalScore({ action: "score_update", statusId: 100, period: 100, seq: 7 }), false);
  assert.equal(latestFinalScore([
    { Action: "game_finalised", StatusId: 100, Period: 100, Seq: 4 },
    { action: "game_finalised", statusId: 100, period: 100, seq: 9 },
  ])?.seq, 9);
});

test("stat validation mapper preserves stat order and exact 32-byte proofs", () => {
  const zero = Array<number>(32).fill(0);
  const one = [...zero.slice(0, 31), 1];
  const payload = validationPayload({
    summary: {
      fixtureId: 18222446,
      updateStats: { updateCount: 2, minTimestamp: 1_000, maxTimestamp: 2_000 },
      eventStatsSubTreeRoot: zero,
    },
    subTreeProof: [{ hash: one, isRightSibling: true }],
    mainTreeProof: [],
    eventStatRoot: zero,
    statsToProve: [{ key: 1, value: 3, period: 100 }, { key: 2, value: 1, period: 100 }],
    statProofs: [[], [{ hash: one, isRightSibling: false }]],
  });
  assert.equal(payload.fixtureSummary.fixtureId.toString(), "18222446");
  assert.deepEqual(payload.stats.map((item) => item.stat.key), [1, 2]);
  assert.deepEqual(payload.stats[1]?.statProof[0]?.hash, one);
  assert.throws(() => toBytes32([1, 2, 3]), /32 bytes/);
});

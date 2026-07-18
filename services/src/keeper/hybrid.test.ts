import assert from "node:assert/strict";
import test from "node:test";
import { dailyScoresRoot, fixtureIdFromSource } from "./hybrid.js";

function sourceId(fixtureId: bigint): number[] {
  const bytes = Buffer.alloc(32);
  bytes.writeBigInt64LE(fixtureId);
  return Array.from(bytes);
}

test("TxLINE source ID decodes one canonical positive fixture", () => {
  assert.equal(fixtureIdFromSource(sourceId(42n)), 42);
  assert.throws(() => fixtureIdFromSource(sourceId(0n)), /supported range/);
  assert.throws(() => fixtureIdFromSource(sourceId(-1n)), /supported range/);
  const ambiguous = sourceId(42n);
  ambiguous[8] = 1;
  assert.throws(() => fixtureIdFromSource(ambiguous), /canonical/);
});

test("TxLINE daily root changes only at UTC epoch-day boundaries", () => {
  const first = dailyScoresRoot(86_400_000);
  const sameDay = dailyScoresRoot(86_400_000 * 2 - 1);
  const nextDay = dailyScoresRoot(86_400_000 * 2);
  assert.equal(first.toBase58(), sameDay.toBase58());
  assert.notEqual(first.toBase58(), nextDay.toBase58());
  assert.throws(() => dailyScoresRoot(-1), /epoch-day/);
});

import assert from "node:assert/strict";
import test from "node:test";
import { resolveMarketId, resolveObservationTimestamp } from "./v2-pyth-market-config.js";

test("V2 Pyth observation accepts the exact twenty-minute boundary", () => {
  const now = Date.parse("2026-07-20T10:00:00Z") / 1_000;
  assert.equal(
    resolveObservationTimestamp("2026-07-20T10:20:00Z", now),
    now + 20 * 60,
  );
});

test("V2 Pyth observation rejects missing, invalid, and early timestamps", () => {
  const now = Date.parse("2026-07-20T10:00:00Z") / 1_000;
  assert.throws(() => resolveObservationTimestamp(undefined, now), /required/);
  assert.throws(() => resolveObservationTimestamp("not-a-date", now), /valid ISO-8601/);
  assert.throws(() => resolveObservationTimestamp("2026-07-20T10:19:59Z", now), /20 minutes/);
});

test("V2 market ID defaults deterministically and accepts unsigned 64-bit bounds", () => {
  assert.equal(resolveMarketId(undefined, 1_753_000_000), 2_001_753_000_000n);
  assert.equal(resolveMarketId("1", 1_753_000_000), 1n);
  assert.equal(resolveMarketId("18446744073709551615", 1_753_000_000), (1n << 64n) - 1n);
});

test("V2 market ID rejects zero, overflow, negative, and malformed values", () => {
  for (const value of ["0", "-1", "18446744073709551616", "market-1"]) {
    assert.throws(() => resolveMarketId(value, 1_753_000_000), /unsigned 64-bit/);
  }
});

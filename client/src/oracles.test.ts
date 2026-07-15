import assert from "node:assert/strict";
import test from "node:test";
import {
  PYTH_PRICE_FEEDS,
  marketIdFromEntropy,
  oracleSourceIdBytes,
  parseDecimalAtExponent,
  txlineFixtureSourceId,
} from "./oracles.js";

test("curated Pyth feeds are exact unique 32-byte identifiers", () => {
  const ids = PYTH_PRICE_FEEDS.map((feed) => feed.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) {
    assert.match(id, /^[0-9a-f]{64}$/);
    assert.equal(oracleSourceIdBytes(id).length, 32);
  }
});

test("decimal thresholds convert exactly without floating point", () => {
  assert.equal(parseDecimalAtExponent("123456.78", -2), 12_345_678n);
  assert.equal(parseDecimalAtExponent("0.5", -2), 50n);
  assert.equal(parseDecimalAtExponent("-12.3400", -4), -123_400n);
  assert.equal(parseDecimalAtExponent("7", 0), 7n);
  assert.throws(() => parseDecimalAtExponent("1.001", -2), /decimal places/);
  assert.throws(() => parseDecimalAtExponent("1e3", -2), /plain decimal/);
  assert.throws(() => parseDecimalAtExponent(" 1", -2), /plain decimal/);
  assert.throws(() => parseDecimalAtExponent("1", 1), /exponent/);
});

test("TxLINE fixture IDs use canonical signed i64 little-endian bytes", () => {
  const source = txlineFixtureSourceId(18_222_446n);
  assert.equal(Buffer.from(source).readBigInt64LE(), 18_222_446n);
  assert.ok(source.slice(8).every((value) => value === 0));
  assert.throws(() => txlineFixtureSourceId(0n), /positive signed 64-bit/);
  assert.throws(() => txlineFixtureSourceId(1n << 63n), /positive signed 64-bit/);
});

test("market IDs consume exactly eight non-zero entropy bytes", () => {
  assert.equal(
    marketIdFromEntropy(Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8])),
    0x0807060504030201n,
  );
  assert.throws(() => marketIdFromEntropy(new Uint8Array(7)), /eight bytes/);
  assert.throws(() => marketIdFromEntropy(new Uint8Array(8)), /cannot be zero/);
});

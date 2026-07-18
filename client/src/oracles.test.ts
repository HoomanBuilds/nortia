import assert from "node:assert/strict";
import test from "node:test";
import {
  PYTH_PRICE_FEEDS,
  SPONSORED_PYTH_FEED_IDS,
  marketIdFromEntropy,
  normalizePythFeed,
  oracleSourceIdBytes,
  parseDecimalAtExponent,
  pythAssetCategory,
  searchPythFeeds,
  txlineFixtureSourceId,
} from "./oracles.js";

test("curated Pyth feeds are exact unique 32-byte identifiers", () => {
  const ids = PYTH_PRICE_FEEDS.map((feed) => feed.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) {
    assert.match(id, /^[0-9a-f]{64}$/);
    assert.equal(oracleSourceIdBytes(id).length, 32);
  }
  assert.equal(ids.length, 47);
  assert.equal(SPONSORED_PYTH_FEED_IDS.size, 47);
  assert.ok(PYTH_PRICE_FEEDS.every((feed) => feed.delivery === "sponsored-push"));
});

test("Hermes catalog normalization maps financial classes and rejects unsafe entries", () => {
  assert.equal(normalizePythFeed(null), null);
  assert.equal(normalizePythFeed("not-a-feed"), null);
  assert.equal(normalizePythFeed({ id: "a".repeat(64), attributes: null }), null);
  const equity = normalizePythFeed({
    id: "a".repeat(64),
    attributes: {
      asset_type: "Equity",
      base: "AAPL",
      quote_currency: "USD",
      display_symbol: "AAPL/USD",
      description: "APPLE INC / US DOLLAR",
      schedule: "America/New_York;0930-1600",
    },
  });
  assert.equal(equity?.category, "economics");
  assert.equal(equity?.delivery, "hermes-pull");
  assert.equal(pythAssetCategory("Crypto NAV"), "crypto");
  assert.equal(pythAssetCategory("Commodities"), "economics");
  assert.equal(normalizePythFeed({
    id: "b".repeat(64),
    attributes: {
      asset_type: "Crypto",
      base: "OLD",
      quote_currency: "USD",
      display_symbol: "OLD/USD",
      description: "DEPRECATED FEED",
    },
  }), null);
  assert.equal(normalizePythFeed({
    id: "c".repeat(64),
    attributes: {
      asset_type: "Kalshi",
      base: "EVENT",
      quote_currency: "USD",
      display_symbol: "EVENT/USD",
      description: "MARKET-DERIVED PROBABILITY",
    },
  }), null);
});

test("Pyth feed search deduplicates, filters categories, and prefers sponsored push", () => {
  const sponsored = PYTH_PRICE_FEEDS[0];
  const values = [
    {
      id: "d".repeat(64),
      attributes: {
        asset_type: "Equity",
        base: "ACME",
        quote_currency: "USD",
        display_symbol: "ACME/USD",
        description: "ACME CORP / US DOLLAR",
      },
    },
    {
      id: sponsored.id,
      attributes: {
        asset_type: sponsored.assetType,
        base: sponsored.base,
        quote_currency: sponsored.quoteCurrency,
        display_symbol: sponsored.symbol,
        description: sponsored.description,
      },
    },
    {
      id: sponsored.id,
      attributes: {
        asset_type: sponsored.assetType,
        base: sponsored.base,
        quote_currency: sponsored.quoteCurrency,
        display_symbol: sponsored.symbol,
        description: sponsored.description,
      },
    },
  ];
  assert.deepEqual(searchPythFeeds(values).map((feed) => feed.symbol), [sponsored.symbol, "ACME/USD"]);
  assert.deepEqual(searchPythFeeds(values, { category: "economics" }).map((feed) => feed.symbol), ["ACME/USD"]);
  assert.deepEqual(searchPythFeeds(values, { query: "acme" }).map((feed) => feed.symbol), ["ACME/USD"]);
});

test("decimal thresholds convert exactly without floating point", () => {
  assert.equal(parseDecimalAtExponent("123456.78", -2), 12_345_678n);
  assert.equal(parseDecimalAtExponent("0.5", -2), 50n);
  assert.equal(parseDecimalAtExponent("-12.3400", -4), -123_400n);
  assert.equal(parseDecimalAtExponent("7", 0), 7n);
  assert.equal(parseDecimalAtExponent("0.00000001", -8), 1n);
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

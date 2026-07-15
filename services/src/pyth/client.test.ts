import assert from "node:assert/strict";
import test from "node:test";
import type { PriceUpdate } from "@pythnetwork/hermes-client";
import { PythClient, type HermesPriceApi } from "./client.js";

const FEED = "e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43";

function response(overrides: Partial<PriceUpdate> = {}): PriceUpdate {
  return {
    binary: { encoding: "base64", data: ["dXBkYXRl"] },
    parsed: [
      {
        id: FEED,
        price: { price: "7100000000000", conf: "1000000", expo: -8, publish_time: 1_001 },
        ema_price: { price: "7090000000000", conf: "1100000", expo: -8, publish_time: 1_001 },
        metadata: { prev_publish_time: 999, slot: 123 },
      },
    ],
    ...overrides,
  };
}

function api(value: PriceUpdate) {
  const calls: unknown[][] = [];
  const mock: HermesPriceApi = {
    async getPriceUpdatesAtTimestamp(...args) {
      calls.push(args);
      return value;
    },
    async getLatestPriceUpdates(...args) {
      calls.push(args);
      return value;
    },
  };
  return { mock, calls };
}

test("settlement update brackets the exact target timestamp", async () => {
  const { mock, calls } = api(response());
  const update = await new PythClient(mock).settlementUpdate(FEED, 1_000, 5);
  assert.deepEqual(update.data, ["dXBkYXRl"]);
  assert.equal(update.feedId, FEED);
  assert.equal(update.previousPublishTime, 999);
  assert.equal(update.publishTime, 1_001);
  assert.equal(update.price, 7_100_000_000_000n);
  assert.deepEqual(calls, [
    [1_000, [`0x${FEED}`], { encoding: "base64", parsed: true }],
  ]);
});

test("settlement update rejects feed, interval, lag, and payload mismatches", async () => {
  const wrongFeed = response();
  wrongFeed.parsed![0]!.id = "01".repeat(32);
  await assert.rejects(() => new PythClient(api(wrongFeed).mock).settlementUpdate(FEED, 1_000, 5), /feed/);

  const nonBracketing = response();
  nonBracketing.parsed![0]!.metadata.prev_publish_time = 1_000;
  await assert.rejects(
    () => new PythClient(api(nonBracketing).mock).settlementUpdate(FEED, 1_000, 5),
    /bracket/,
  );

  const stale = response();
  stale.parsed![0]!.price.publish_time = 1_006;
  await assert.rejects(() => new PythClient(api(stale).mock).settlementUpdate(FEED, 1_000, 5), /lag/);

  await assert.rejects(
    () =>
      new PythClient(api(response({ binary: { encoding: "base64", data: [] } })).mock)
        .settlementUpdate(FEED, 1_000, 5),
    /binary/,
  );
});

test("latest update is display-only and still validates the requested feed", async () => {
  const { mock, calls } = api(response());
  const update = await new PythClient(mock).latestUpdate(`0x${FEED}`);
  assert.equal(update.publishTime, 1_001);
  assert.deepEqual(calls, [[[`0x${FEED}`], { encoding: "base64", parsed: true }]]);
});

test("invalid timestamp and staleness bounds fail before a Hermes request", async () => {
  const { mock, calls } = api(response());
  const client = new PythClient(mock);
  await assert.rejects(() => client.settlementUpdate(FEED, 0, 5), /timestamp/);
  await assert.rejects(() => client.settlementUpdate(FEED, 1_000, 0), /staleness/);
  assert.equal(calls.length, 0);
});

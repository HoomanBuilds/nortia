import assert from "node:assert/strict";
import test from "node:test";
import type { PriceUpdate } from "@pythnetwork/hermes-client";
import receiverSdk from "@pythnetwork/pyth-solana-receiver";
import { PublicKey } from "@solana/web3.js";
import { PythClient, type HermesPriceApi } from "./client.js";
import { pythPushFeedAccount } from "./settlement.js";

const FEED = "e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43";

test("Pyth receiver SDK is importable and pinned to the onchain program", () => {
  assert.equal(
    receiverSdk.DEFAULT_RECEIVER_PROGRAM_ID.toBase58(),
    "rec5EKMGg6MxZYaMdyBfgwp4d5rB9T1VQH5pJv5LtFJ",
  );
  assert.equal(typeof receiverSdk.PythSolanaReceiver, "function");
  const expected = receiverSdk.getPriceFeedAccountForProgram(
    0,
    FEED,
    new PublicKey("pythWSnswVUd12oZpeFP8e9CVaEqJg25g1Vtc2biRsT"),
  );
  assert.equal(pythPushFeedAccount(FEED).toBase58(), expected.toBase58());
});

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

test("free-profile pacing serializes public Hermes requests", async () => {
  const { mock, calls } = api(response());
  let now = 100;
  const waits: number[] = [];
  const client = new PythClient(mock, {
    minimumRequestIntervalMs: 1_100,
    now: () => now,
    wait: async (milliseconds) => {
      waits.push(milliseconds);
      now += milliseconds;
    },
  });
  await client.latestUpdate(FEED);
  await client.latestUpdate(FEED);
  assert.equal(calls.length, 2);
  assert.deepEqual(waits, [1_100]);
});

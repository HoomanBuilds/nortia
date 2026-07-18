import assert from "node:assert/strict";
import test from "node:test";
import { PublicKey } from "@solana/web3.js";
import {
  SWITCHBOARD_DEVNET_QUEUE_ADDRESS,
  SWITCHBOARD_QUOTE_PROGRAM_ADDRESS,
} from "nortia-client/oracles";
import {
  normalizeSwitchboardFeedHash,
  switchboardQuoteAccount,
  validateStoredSwitchboardFeed,
} from "./managed.js";

const FEED_HASH = "4cd1cad962425681af07b9254b7d804de3ca3446fbfd1371bb258d2c75059812";

test("Switchboard hash and canonical quote address are deterministic", () => {
  const queue = new PublicKey(SWITCHBOARD_DEVNET_QUEUE_ADDRESS);
  const quote = switchboardQuoteAccount(queue, `0x${FEED_HASH}`);
  const expected = PublicKey.findProgramAddressSync(
    [queue.toBuffer(), Buffer.from(FEED_HASH, "hex")],
    new PublicKey(SWITCHBOARD_QUOTE_PROGRAM_ADDRESS),
  )[0];
  assert.equal(quote.toBase58(), expected.toBase58());
  assert.equal(normalizeSwitchboardFeedHash(` 0x${FEED_HASH.toUpperCase()} `), FEED_HASH);
  assert.throws(() => normalizeSwitchboardFeedHash("abc"), /32-byte/);
});

test("stored Switchboard feed validation rejects incomplete definitions", async () => {
  const valid = await validateStoredSwitchboardFeed({
    async fetchOracleFeed() {
      return { cid: "bafy-feed", data: "encoded", size: 128, version: "2" };
    },
  }, FEED_HASH);
  assert.equal(valid.feedHash, FEED_HASH);
  await assert.rejects(() => validateStoredSwitchboardFeed({
    async fetchOracleFeed() {
      return { cid: "", data: "", size: 0, version: "" };
    },
  }, FEED_HASH), /incomplete/);
});

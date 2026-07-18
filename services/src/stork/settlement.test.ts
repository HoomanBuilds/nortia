import assert from "node:assert/strict";
import test from "node:test";
import { PublicKey } from "@solana/web3.js";
import { STORK_ORACLE_PROGRAM_ADDRESS } from "nortia-client/oracles";
import { storkFeedAccount } from "./settlement.js";

test("Stork feed account uses the pinned canonical PDA", () => {
  const feedId = Array(32).fill(7);
  const expected = PublicKey.findProgramAddressSync(
    [Buffer.from("stork_feed"), Buffer.from(feedId)],
    new PublicKey(STORK_ORACLE_PROGRAM_ADDRESS),
  )[0];
  assert.equal(storkFeedAccount(feedId).toBase58(), expected.toBase58());
  assert.throws(() => storkFeedAccount([1]), /32 bytes/);
});

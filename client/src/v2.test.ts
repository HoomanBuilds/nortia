import assert from "node:assert/strict";
import test from "node:test";
import { PublicKey } from "@solana/web3.js";
import {
  NORTIA_PROGRAM_ID,
  enginePda,
  hybridMarketPda,
  hybridVaultPda,
  normalizeFeedId,
  optimisticBondVaultPda,
  optimisticProposalPda,
  oracleConfigPda,
  positionPda,
  resolutionReceiptPda,
  u64Le,
} from "./v2.js";

const creator = new PublicKey("9xQeWvG816bUx9EPjHmaT23yvVMiDq4AmgxJYuqz8rKP");
const owner = new PublicKey("Vote111111111111111111111111111111111111111");

test("V2 PDA derivation is stable for the canonical program", () => {
  const market = hybridMarketPda(creator, 42n);
  assert.equal(enginePda().toBase58(), "8B9mT96Zryy4PpcQDFToKPjBa2BunjxfwASWDGPFCYid");
  assert.equal(market.toBase58(), "6VymaMxxXEEcxhXKd5Snrqdw1T8w8Qb6mkC6Kqytwz2v");
  assert.equal(hybridVaultPda(market).toBase58(), "DtQgaafLaV1SX5DCxcVfU3zArHxvYvusK2cmhRj4NVCX");
  assert.equal(oracleConfigPda(market).toBase58(), "Hwcw8PwTuDkMbQMB1pA8HUfPA4wMpSNUDTphPYDAfnqJ");
  assert.equal(positionPda(market, owner).toBase58(), "EZ7XNZazKeYq2diUwNrQAVjA6QaToH7KA6WjdtuXGqwg");
  assert.equal(
    resolutionReceiptPda(market).toBase58(),
    "9Safr47wQ7g8meZjwcXSBqTVjhdjsZVqaEVJ9Z9eCBM1",
  );
  assert.equal(
    optimisticProposalPda(market).toBase58(),
    "2zRnhvf9UByoBNP5mAv7C96wBL4Kv3W49VDDaw582o1f",
  );
  assert.equal(
    optimisticBondVaultPda(market).toBase58(),
    "2AGKmb74DnvPBZWS3e4DJaDYPpV4zh4Z3Rk3Y6qfgkMe",
  );
  assert.equal(NORTIA_PROGRAM_ID.toBase58(), "4S2EvdGrbKJ9zazvB4gtR83crTrVJWqqwoVVvEQy8VE9");
});

test("u64 seeds reject negative and overflowing market IDs", () => {
  assert.deepEqual(u64Le(42n), Buffer.from([42, 0, 0, 0, 0, 0, 0, 0]));
  assert.throws(() => u64Le(-1n), /unsigned 64-bit/);
  assert.throws(() => u64Le(1n << 64n), /unsigned 64-bit/);
});

test("Pyth feed IDs normalize to an exact 32-byte lowercase hex value", () => {
  const feed = "0xE62DF6C8B4A85FE1A67DB44DC12DE5DB330F7AC66B72DC658AFEDF0F4A415B43";
  assert.equal(
    normalizeFeedId(feed),
    "e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
  );
  assert.throws(() => normalizeFeedId("0x01"), /32-byte/);
  assert.throws(() => normalizeFeedId("z".repeat(64)), /32-byte/);
});

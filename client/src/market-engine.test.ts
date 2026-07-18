import assert from "node:assert/strict";
import test from "node:test";
import { PublicKey } from "@solana/web3.js";
import {
  NORTIA_PROGRAM_ID,
  enginePda,
  hybridMarketPda,
  hybridMetadataPda,
  hybridVaultPda,
  normalizeFeedId,
  optimisticBondVaultPda,
  optimisticProposalPda,
  oracleConfigPda,
  positionPda,
  resolutionReceiptPda,
  u64Le,
} from "./market-engine.js";

const creator = new PublicKey("9xQeWvG816bUx9EPjHmaT23yvVMiDq4AmgxJYuqz8rKP");
const owner = new PublicKey("Vote111111111111111111111111111111111111111");

test("market engine PDA derivation is stable for the canonical program", () => {
  const market = hybridMarketPda(creator, 42n);
  assert.equal(enginePda().toBase58(), "EWgvZgWZNc1m2yunKonZwavnPgY6n6T2BbwXFC6kdRpf");
  assert.equal(market.toBase58(), "BxtdMB5c7EXPp798hvV4mCPX67he4oyGSL9nGCaK88cp");
  assert.equal(hybridVaultPda(market).toBase58(), "FuixLDnoTKPESWJ3xyUk1hWTQFaLapxETScwVmh3FQSV");
  assert.equal(oracleConfigPda(market).toBase58(), "3juvg7QqrzSR2yBV65SzGR86NNjKXKmvkCCzWp3iyGK3");
  assert.equal(positionPda(market, owner).toBase58(), "zcZS7FFsreNinaFo3oyVrkRh3gja8qfcEc3Rdc6rK9u");
  assert.equal(
    resolutionReceiptPda(market).toBase58(),
    "8BA6eP5HVLw3hnwNtr5qmqrP6TZrLsLi78w4R3C5FHET",
  );
  assert.equal(
    optimisticProposalPda(market).toBase58(),
    "2YeQztxCPNLXnG3TYVQCZgL84hpHqv7yUXEq8QvHnqCE",
  );
  assert.equal(
    optimisticBondVaultPda(market).toBase58(),
    "4BccYofYDZEf6gdBf16WtYU1AsRphG9Toz1ZuvYXhrGx",
  );
  assert.equal(
    hybridMetadataPda(market).toBase58(),
    "3DnxWuALwpqquHa13dX3mXLNtSRs5681weXMcGyfMsd3",
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

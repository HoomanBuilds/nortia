import assert from "node:assert/strict";
import test from "node:test";

import {
  TREE_DEPTH,
  fieldHex,
  merkleRoot,
  orderCommitment,
  poseidonHash,
} from "./commitments.js";

test("matches Solana's BN254 Poseidon parameters", () => {
  assert.equal(
    fieldHex(poseidonHash(1n, 2n)),
    "0x115cc0f5e7d690413df64c6b9662e9cf2a3617f2743245519e19607a4417189a",
  );
});

test("order commitments bind the side", () => {
  const yes = orderCommitment(42n, 1_000_000n, true, 11n, 12n);
  const no = orderCommitment(42n, 1_000_000n, false, 11n, 12n);
  assert.notEqual(yes, no);
});

test("Merkle path direction changes the root", () => {
  const siblings = Array<bigint>(TREE_DEPTH).fill(0n);
  const leftPath = Array<boolean>(TREE_DEPTH).fill(false);
  const rightPath = [...leftPath];
  rightPath[0] = true;
  assert.notEqual(
    merkleRoot(7n, leftPath, siblings),
    merkleRoot(7n, rightPath, siblings),
  );
});

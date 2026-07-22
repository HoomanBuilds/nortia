import assert from "node:assert/strict";
import test from "node:test";
import { Keypair } from "@solana/web3.js";
import { TREE_DEPTH } from "nortia-client/commitments";
import { checkedPlace, checkedRedeem } from "./requests.js";

const field = (value: bigint) => `0x${value.toString(16).padStart(64, "0")}`;

function placement() {
  return {
    marketId: "1",
    ticketAmount: "1000000",
    payer: Keypair.generate().publicKey.toBase58(),
    side: true,
    secret: field(1n),
    nullifier: field(2n),
    coefficient: field(3n),
    salts: [field(4n), field(5n), field(6n)],
  };
}

test("placement accepts explicit browser-owned witness fields", () => {
  const request = checkedPlace(placement());
  assert.equal(request.secret, field(1n));
  assert.equal(request.salts.length, 3);
});

test("placement rejects zero, malformed, and overflowing witness fields", () => {
  assert.throws(() => checkedPlace({ ...placement(), secret: field(0n) }), /non-zero/);
  assert.throws(() => checkedPlace({ ...placement(), salts: [field(1n)] }), /three fields/);
  assert.throws(() => checkedPlace({ ...placement(), coefficient: "7" }), /32-byte field/);
  assert.throws(() => checkedPlace({ ...placement(), marketId: "18446744073709551616" }), /u64/);
});

test("redemption rejects losing, incomplete, and zero-payout requests", () => {
  const request = {
    marketId: "1",
    ticketAmount: "1000000",
    commitmentRoot: field(1n),
    outcome: true,
    recipient: Keypair.generate().publicKey.toBase58(),
    payoutAmount: "1",
    side: true,
    secret: field(2n),
    nullifier: field(3n),
    pathBits: Array<boolean>(TREE_DEPTH).fill(false),
    siblings: Array<string>(TREE_DEPTH).fill(field(0n)),
  };
  assert.equal(checkedRedeem(request).siblings.length, TREE_DEPTH);
  assert.throws(() => checkedRedeem({ ...request, side: false }), /losing/);
  assert.throws(() => checkedRedeem({ ...request, payoutAmount: "0" }), /positive/);
  assert.throws(() => checkedRedeem({ ...request, siblings: [] }), /siblings/);
});

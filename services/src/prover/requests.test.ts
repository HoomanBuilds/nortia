import assert from "node:assert/strict";
import test from "node:test";
import { Keypair, PublicKey } from "@solana/web3.js";
import { TREE_DEPTH } from "nortia-client/commitments";
import { checkedPlace, checkedRedeem } from "./requests.js";

const field = (value: bigint) => `0x${value.toString(16).padStart(64, "0")}`;

function placement() {
  return {
    marketId: "1",
    stakeAmount: "100000000",
    amount: "37000000",
    payer: Keypair.generate().publicKey.toBase58(),
    side: true,
    secret: field(1n),
    nullifier: field(2n),
    sideCoefficient: field(3n),
    yesAmountCoefficient: field(4n),
    totalAmountCoefficient: field(5n),
    salts: [field(6n), field(7n), field(8n)],
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
  assert.throws(() => checkedPlace({ ...placement(), sideCoefficient: "7" }), /32-byte field/);
  assert.throws(() => checkedPlace({ ...placement(), amount: "999999" }), /between 1 USDC/);
  assert.throws(() => checkedPlace({ ...placement(), amount: "100000001" }), /stakeAmount/);
  assert.throws(() => checkedPlace({ ...placement(), marketId: "18446744073709551616" }), /u64/);
});

test("redemption accepts winner and loser settlements and rejects wrong payouts", () => {
  const request = {
    marketId: "1",
    stakeAmount: "100000000",
    amount: "37000000",
    commitmentRoot: field(1n),
    outcome: true,
    recipient: Keypair.generate().publicKey.toBase58(),
    payoutAmount: "117945000",
    netPool: "62370000",
    winningAmount: "42000000",
    side: true,
    secret: field(2n),
    nullifier: field(3n),
    pathBits: Array<boolean>(TREE_DEPTH).fill(false),
    siblings: Array<string>(TREE_DEPTH).fill(field(0n)),
  };
  assert.equal(checkedRedeem(request).siblings.length, TREE_DEPTH);
  assert.equal(checkedRedeem({ ...request, side: false, payoutAmount: "63000000" }).side, false);
  assert.throws(() => checkedRedeem({ ...request, payoutAmount: "1" }), /does not match/);
  assert.throws(() => checkedRedeem({ ...request, secret: field(0n) }), /non-zero/);
  const [pda] = PublicKey.findProgramAddressSync([Buffer.from("recipient")], Keypair.generate().publicKey);
  assert.throws(() => checkedRedeem({ ...request, recipient: pda.toBase58() }), /wallet address/);
  assert.throws(() => checkedRedeem({ ...request, siblings: [] }), /siblings/);
});

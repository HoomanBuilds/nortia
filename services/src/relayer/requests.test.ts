import assert from "node:assert/strict";
import test from "node:test";
import { Keypair, PublicKey } from "@solana/web3.js";
import { checkedRelayRedeem } from "./requests.js";

function request() {
  return {
    market: Keypair.generate().publicKey.toBase58(),
    recipient: Keypair.generate().publicKey.toBase58(),
    nullifierHash: `0x${"12".repeat(32)}`,
    payoutAmount: "117945000",
    proof: Buffer.alloc(388, 1).toString("base64"),
    publicWitness: Buffer.alloc(300, 2).toString("base64"),
  };
}

test("accepts a canonical public redemption payload", () => {
  const value = request();
  assert.deepEqual(checkedRelayRedeem(value), value);
});

test("rejects malformed proof encodings and lengths", () => {
  assert.throws(() => checkedRelayRedeem({ ...request(), proof: Buffer.alloc(387).toString("base64") }), /invalid length/);
  assert.throws(() => checkedRelayRedeem({ ...request(), publicWitness: "not base64" }), /must be base64/);
});

test("rejects malformed or overflowing payout amounts", () => {
  assert.throws(() => checkedRelayRedeem({ ...request(), payoutAmount: "1.5" }), /decimal u64/);
  assert.throws(() => checkedRelayRedeem({ ...request(), payoutAmount: "18446744073709551616" }), /exceeds u64/);
});

test("rejects PDA recipients that cannot control a wallet", () => {
  const [pda] = PublicKey.findProgramAddressSync([Buffer.from("recipient")], Keypair.generate().publicKey);
  assert.throws(() => checkedRelayRedeem({ ...request(), recipient: pda.toBase58() }), /wallet address/);
});

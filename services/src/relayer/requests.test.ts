import assert from "node:assert/strict";
import test from "node:test";
import { Keypair, PublicKey } from "@solana/web3.js";
import { checkedRelayRedeem } from "./requests.js";

function request() {
  return {
    market: Keypair.generate().publicKey.toBase58(),
    recipient: Keypair.generate().publicKey.toBase58(),
    nullifierHash: `0x${"12".repeat(32)}`,
    proof: Buffer.alloc(324, 1).toString("base64"),
    publicWitness: Buffer.alloc(236, 2).toString("base64"),
  };
}

test("accepts a canonical public redemption payload", () => {
  const value = request();
  assert.deepEqual(checkedRelayRedeem(value), value);
});

test("rejects malformed proof encodings and lengths", () => {
  assert.throws(() => checkedRelayRedeem({ ...request(), proof: Buffer.alloc(323).toString("base64") }), /invalid length/);
  assert.throws(() => checkedRelayRedeem({ ...request(), publicWitness: "not base64" }), /must be base64/);
});

test("rejects PDA recipients that cannot control a wallet", () => {
  const [pda] = PublicKey.findProgramAddressSync([Buffer.from("recipient")], Keypair.generate().publicKey);
  assert.throws(() => checkedRelayRedeem({ ...request(), recipient: pda.toBase58() }), /wallet address/);
});

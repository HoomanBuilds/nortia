import assert from "node:assert/strict";
import test from "node:test";
import { PublicKey } from "@solana/web3.js";
import { normalizeEvidenceUri, optimisticEvidenceHash } from "./optimistic.js";

function hex(value: Uint8Array): string {
  return Buffer.from(value).toString("hex");
}

test("optimistic evidence hash matches the Solana SHA-256 vector", async () => {
  const market = new PublicKey(new Uint8Array(32));
  assert.equal(
    hex(await optimisticEvidenceHash("assertion", market, 1, "https://example.com/final-result")),
    "07f9aed92b70676680b53e40263415a19bdc2f6404b3f1b3878e0ce91f2e41ef",
  );
});

test("evidence hashes bind role, market, outcome, and URI", async () => {
  const market = PublicKey.unique();
  const assertion = hex(await optimisticEvidenceHash("assertion", market, 1, "ipfs://bafy-result"));
  assert.notEqual(assertion, hex(await optimisticEvidenceHash("challenge", market, 1, "ipfs://bafy-result")));
  assert.notEqual(assertion, hex(await optimisticEvidenceHash("assertion", PublicKey.unique(), 1, "ipfs://bafy-result")));
  assert.notEqual(assertion, hex(await optimisticEvidenceHash("assertion", market, 0, "ipfs://bafy-result")));
  assert.notEqual(assertion, hex(await optimisticEvidenceHash("assertion", market, 1, "ipfs://bafy-other")));
});

test("evidence URI validation rejects hidden or ambiguous content", () => {
  assert.equal(normalizeEvidenceUri("https://example.com/result"), "https://example.com/result");
  assert.equal(normalizeEvidenceUri("ipfs://bafy-result"), "ipfs://bafy-result");
  assert.equal(normalizeEvidenceUri("ar://transaction-id"), "ar://transaction-id");
  assert.throws(() => normalizeEvidenceUri(" https://example.com/result"), /canonical/);
  assert.throws(() => normalizeEvidenceUri("javascript:alert(1)"), /scheme/);
  assert.throws(() => normalizeEvidenceUri(`https://example.com/${"x".repeat(150)}`), /160 bytes/);
  assert.throws(() => normalizeEvidenceUri("https://example.com/result\nother"), /control/);
  assert.throws(() => normalizeEvidenceUri("https://example.com/résultat"), /ASCII/);
});

import assert from "node:assert/strict";
import test from "node:test";
import { generateCommitteeEncryptionKey, openCommitteeShare, sealCommitteeShare } from "./encryption.js";

test("committee envelopes hide shares from the routing layer", async () => {
  const keys = await generateCommitteeEncryptionKey(1);
  const share = { memberIndex: 1, share: "123456789", salt: "987654321" };
  const envelope = await sealCommitteeShare(share, keys.publicKey, 1);
  assert.equal(JSON.stringify(envelope).includes(share.share), false);
  assert.deepEqual(await openCommitteeShare(envelope, keys.privateKey, 1), share);
});

test("committee envelopes are bound to their member and authenticated", async () => {
  const keys = await generateCommitteeEncryptionKey(2);
  const envelope = await sealCommitteeShare({ memberIndex: 2, share: "42" }, keys.publicKey, 2);
  await assert.rejects(() => openCommitteeShare(envelope, keys.privateKey, 1), /wrong committee member/);
  const bytes = Buffer.from(envelope.ciphertext, "base64");
  bytes[0] = (bytes[0] ?? 0) ^ 1;
  await assert.rejects(() => openCommitteeShare({ ...envelope, ciphertext: bytes.toString("base64") }, keys.privateKey, 2));
});

import assert from "node:assert/strict";
import test from "node:test";
import { openCommitteeState, sealCommitteeState } from "./state.js";

const key = "11".repeat(32);

test("committee state is encrypted and authenticated per member", () => {
  const privateShare = { market: "market", share: "123456789" };
  const sealed = sealCommitteeState([privateShare], key, 1);
  assert.equal(sealed.includes(privateShare.share), false);
  assert.deepEqual(openCommitteeState(sealed, key, 1), { value: [privateShare], legacy: false });
  assert.throws(() => openCommitteeState(sealed, key, 2));
  assert.throws(() => openCommitteeState(sealed, "22".repeat(32), 1));
});

test("legacy plaintext state is identified for one-time migration", () => {
  assert.deepEqual(openCommitteeState('[{"share":"1"}]', key, 3), {
    value: [{ share: "1" }],
    legacy: true,
  });
});

import assert from "node:assert/strict";
import test from "node:test";
import { checkedCommitteeApiTokens } from "./auth.js";

const tokens = ["a".repeat(32), "b".repeat(32), "c".repeat(32)];

test("accepts three distinct committee API tokens", () => {
  assert.deepEqual(checkedCommitteeApiTokens(tokens), tokens);
});

test("rejects missing, short, and reused committee API tokens", () => {
  assert.throws(() => checkedCommitteeApiTokens(tokens.slice(0, 2)), /three long tokens/);
  assert.throws(() => checkedCommitteeApiTokens([tokens[0]!, "short", tokens[2]!]), /three long tokens/);
  assert.throws(() => checkedCommitteeApiTokens([tokens[0]!, tokens[0]!, tokens[2]!]), /distinct/);
});

import assert from "node:assert/strict";
import test from "node:test";
import { parseTxlineResponse } from "./txline.js";

test("TxLINE parser preserves ordinary JSON responses", () => {
  assert.deepEqual(parseTxlineResponse('[{"Seq":1}]'), [{ Seq: 1 }]);
  assert.deepEqual(parseTxlineResponse('{"records":[{"Seq":2}]}'), {
    records: [{ Seq: 2 }],
  });
});

test("TxLINE parser collects SSE replay records", () => {
  const response = [
    "event: score",
    'data: {"Seq":1,"Action":"score_update"}',
    "",
    "event: score",
    'data: [{"Seq":2},{"Seq":3}]',
    "",
    "data: [DONE]",
  ].join("\n");
  assert.deepEqual(parseTxlineResponse(response), [
    { Seq: 1, Action: "score_update" },
    { Seq: 2 },
    { Seq: 3 },
  ]);
});

test("TxLINE parser rejects malformed authenticated responses", () => {
  assert.throws(() => parseTxlineResponse("data: not-json"), SyntaxError);
  assert.deepEqual(parseTxlineResponse("\n"), []);
});

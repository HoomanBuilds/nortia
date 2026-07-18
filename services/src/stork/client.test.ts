import assert from "node:assert/strict";
import test from "node:test";
import { StorkClient } from "./client.js";

const FEED_ID = "7404e3d104ea7841c3d9e6fd20adfe99b4ad586bc08d8f3bd3afef894cf184de";

function response(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
}

test("Stork client keeps Basic credentials server-side and validates assets", async () => {
  const calls: Array<{ url: string; authorization: string | null }> = [];
  const client = new StorkClient("https://rest.dev.stork-oracle.network/", "secret", async (url, init) => {
    calls.push({
      url: String(url),
      authorization: new Headers(init?.headers).get("authorization"),
    });
    if (String(url).endsWith("/assets")) return response({ data: ["ETHUSD", "bad value", "BTCUSD"] });
    return response({
      data: {
        value: {
          BTCUSD: {
            asset_id: "BTCUSD",
            price: "93034248063749982000000",
            timestamp: "1745436557621941000",
            stork_signed_price: { encoded_asset_id: `0x${FEED_ID}` },
          },
        },
      },
    });
  });
  assert.deepEqual(await client.assets(), ["BTCUSD", "ETHUSD"]);
  const asset = await client.asset("BTCUSD");
  assert.equal(asset.feedId, FEED_ID);
  assert.equal(asset.price, 93_034_248_063_749_982_000_000n);
  assert.ok(calls.every((call) => call.authorization === "Basic secret"));
  assert.ok(calls.every((call) => !call.url.includes("secret")));
});

test("Stork client rejects missing access, mismatches, and non-positive values", async () => {
  assert.throws(() => new StorkClient("http://example.com", "token"), /HTTPS/);
  assert.throws(() => new StorkClient("https://example.com", ""), /token/);
  const mismatch = new StorkClient("https://example.com", "token", async () => response({
    data: {
      value: {
        BTCUSD: {
          asset_id: "ETHUSD",
          price: "1",
          timestamp: "1",
          stork_signed_price: { encoded_asset_id: `0x${FEED_ID}` },
        },
      },
    },
  }));
  await assert.rejects(() => mismatch.asset("BTCUSD"), /different asset/);
});

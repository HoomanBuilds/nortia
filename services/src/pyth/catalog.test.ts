import assert from "node:assert/strict";
import test from "node:test";
import { PYTH_PRICE_FEEDS } from "nortia-client/oracles";
import { fetchPythCatalog } from "./catalog.js";

test("catalog keeps sponsored feeds first and filters unsupported metadata", async () => {
  const sponsored = PYTH_PRICE_FEEDS[0];
  const feeds = await fetchPythCatalog({
    async getPriceFeeds() {
      return [
        {
          id: "a".repeat(64),
          attributes: {
            asset_type: "Equity",
            base: "ACME",
            quote_currency: "USD",
            display_symbol: "ACME/USD",
            description: "ACME CORP / US DOLLAR",
          },
        },
        {
          id: sponsored.id,
          attributes: {
            asset_type: sponsored.assetType,
            base: sponsored.base,
            quote_currency: sponsored.quoteCurrency,
            display_symbol: sponsored.symbol,
            description: sponsored.description,
          },
        },
      ];
    },
  } as never);
  assert.deepEqual(feeds.map((feed) => feed.symbol), [sponsored.symbol, "ACME/USD"]);
});

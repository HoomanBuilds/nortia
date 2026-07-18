import type { HermesClient, PriceFeedMetadata } from "@pythnetwork/hermes-client";
import { searchPythFeeds, type PythFeed } from "nortia-client/oracles";

type PythCatalogApi = Pick<HermesClient, "getPriceFeeds">;

export async function fetchPythCatalog(
  api: PythCatalogApi,
  input: { query?: string; category?: "all" | "crypto" | "economics"; limit?: number } = {},
): Promise<PythFeed[]> {
  const values = await api.getPriceFeeds(input.query ? { query: input.query } : undefined);
  return searchPythFeeds(values as PriceFeedMetadata[], input);
}

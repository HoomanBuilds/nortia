import { normalizeFeedId } from "nortia-client/market-engine";

type Fetch = typeof fetch;

export type StorkAsset = {
  assetId: string;
  feedId: string;
  price: bigint;
  timestampNs: bigint;
};

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} is not an object`);
  }
  return value as Record<string, unknown>;
}

export class StorkClient {
  readonly #origin: string;
  readonly #token: string;
  readonly #fetch: Fetch;

  constructor(origin: string, token: string, fetchImplementation: Fetch = fetch) {
    this.#origin = origin.replace(/\/+$/, "");
    this.#token = token.trim();
    this.#fetch = fetchImplementation;
    if (!this.#origin.startsWith("https://") || !this.#token) {
      throw new Error("Stork requires an HTTPS origin and API token");
    }
  }

  async #get(path: string): Promise<unknown> {
    const response = await this.#fetch(`${this.#origin}${path}`, {
      headers: { Authorization: `Basic ${this.#token}`, Accept: "application/json" },
    });
    if (!response.ok) throw new Error(`Stork request failed with status ${response.status}`);
    return response.json();
  }

  async assets(): Promise<string[]> {
    const response = object(await this.#get("/v1/prices/assets"), "Stork response");
    if (!Array.isArray(response.data)) throw new Error("Stork asset response is missing data");
    return response.data
      .filter((value): value is string => typeof value === "string" && /^[A-Z0-9_.-]{2,80}$/.test(value))
      .sort();
  }

  async asset(assetId: string): Promise<StorkAsset> {
    if (!/^[A-Z0-9_.-]{2,80}$/.test(assetId)) throw new Error("Stork asset ID is invalid");
    const response = object(
      await this.#get(`/v1/prices/latest?assets=${encodeURIComponent(assetId)}`),
      "Stork response",
    );
    const data = object(response.data, "Stork data");
    const values = object(data.value, "Stork values");
    const value = object(values[assetId], "Stork asset value");
    const signed = object(value.stork_signed_price, "Stork signed price");
    const returnedAssetId = value.asset_id;
    if (returnedAssetId !== assetId) throw new Error("Stork returned a different asset ID");
    const feedId = normalizeFeedId(String(signed.encoded_asset_id ?? ""));
    const price = BigInt(String(value.price ?? ""));
    const timestampNs = BigInt(String(value.timestamp ?? ""));
    if (price <= 0n || timestampNs <= 0n) throw new Error("Stork returned a non-positive price or timestamp");
    return { assetId, feedId, price, timestampNs };
  }
}

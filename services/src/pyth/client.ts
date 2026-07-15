import { HermesClient, type PriceUpdate } from "@pythnetwork/hermes-client";
import { normalizeFeedId } from "nortia-client/v2";

export type HermesPriceApi = Pick<
  HermesClient,
  "getLatestPriceUpdates" | "getPriceUpdatesAtTimestamp"
>;

export type VerifiedHermesUpdate = {
  data: string[];
  feedId: string;
  price: bigint;
  confidence: bigint;
  exponent: number;
  previousPublishTime: number | null;
  publishTime: number;
  slot: number | null;
};

function positiveSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive safe integer`);
  }
}

function verifiedUpdate(response: PriceUpdate, feedId: string): VerifiedHermesUpdate {
  if (response.binary.encoding !== "base64" || response.binary.data.length === 0) {
    throw new Error("Hermes response is missing base64 binary update data");
  }
  if (response.binary.data.some((data) => typeof data !== "string" || data.length === 0)) {
    throw new Error("Hermes response contains an empty binary update");
  }
  if (!response.parsed || response.parsed.length !== 1) {
    throw new Error("Hermes response must contain exactly one parsed price feed");
  }
  const parsed = response.parsed[0];
  if (!parsed || normalizeFeedId(parsed.id) !== feedId) {
    throw new Error("Hermes response does not match the requested Pyth feed");
  }
  const previousPublishTime = parsed.metadata.prev_publish_time ?? null;
  const slot = parsed.metadata.slot ?? null;
  return {
    data: response.binary.data,
    feedId,
    price: BigInt(parsed.price.price),
    confidence: BigInt(parsed.price.conf),
    exponent: parsed.price.expo,
    previousPublishTime,
    publishTime: parsed.price.publish_time,
    slot,
  };
}

export class PythClient {
  readonly #api: HermesPriceApi;

  constructor(api: HermesPriceApi) {
    this.#api = api;
  }

  async settlementUpdate(
    requestedFeedId: string,
    targetTimestamp: number,
    maxStalenessSeconds: number,
  ): Promise<VerifiedHermesUpdate> {
    const feedId = normalizeFeedId(requestedFeedId);
    positiveSafeInteger(targetTimestamp, "target timestamp");
    positiveSafeInteger(maxStalenessSeconds, "maximum staleness");
    const response = await this.#api.getPriceUpdatesAtTimestamp(
      targetTimestamp,
      [`0x${feedId}`],
      { encoding: "base64", parsed: true },
    );
    const update = verifiedUpdate(response, feedId);
    if (
      update.previousPublishTime === null
      || update.previousPublishTime >= targetTimestamp
      || update.publishTime < targetTimestamp
    ) {
      throw new Error("Pyth update does not uniquely bracket the target timestamp");
    }
    if (update.publishTime - targetTimestamp > maxStalenessSeconds) {
      throw new Error("Pyth update publish lag exceeds the market staleness limit");
    }
    return update;
  }

  async latestUpdate(requestedFeedId: string): Promise<VerifiedHermesUpdate> {
    const feedId = normalizeFeedId(requestedFeedId);
    const response = await this.#api.getLatestPriceUpdates([`0x${feedId}`], {
      encoding: "base64",
      parsed: true,
    });
    return verifiedUpdate(response, feedId);
  }
}

export function createPythClient(endpoint: string, apiKey: string | null): PythClient {
  const headers = apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined;
  return new PythClient(new HermesClient(endpoint, { headers }));
}

const U64_MAX = (1n << 64n) - 1n;

export function resolveObservationTimestamp(raw: string | undefined, nowSeconds: number): number {
  if (!raw) throw new Error("NORTIA_PYTH_OBSERVATION_AT is required as an ISO-8601 timestamp");
  const milliseconds = Date.parse(raw);
  if (!Number.isFinite(milliseconds)) {
    throw new Error("NORTIA_PYTH_OBSERVATION_AT must be a valid ISO-8601 timestamp");
  }
  const value = Math.floor(milliseconds / 1_000);
  if (value < nowSeconds + 20 * 60) {
    throw new Error("NORTIA_PYTH_OBSERVATION_AT must be at least 20 minutes in the future");
  }
  return value;
}

export function resolveMarketId(raw: string | undefined, observationTs: number): bigint {
  let value: bigint;
  try {
    value = raw ? BigInt(raw) : 2_000_000_000_000n + BigInt(observationTs);
  } catch {
    throw new Error("NORTIA_PYTH_MARKET_ID must fit a non-zero unsigned 64-bit integer");
  }
  if (value <= 0n || value > U64_MAX) {
    throw new Error("NORTIA_PYTH_MARKET_ID must fit a non-zero unsigned 64-bit integer");
  }
  return value;
}

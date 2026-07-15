export const PYTH_PRICE_FEEDS = [
  {
    symbol: "BTC/USD",
    id: "e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
  },
  {
    symbol: "ETH/USD",
    id: "ff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",
  },
  {
    symbol: "SOL/USD",
    id: "ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d",
  },
] as const;

const I64_MAX = (1n << 63n) - 1n;
const I128_MIN = -(1n << 127n);
const I128_MAX = (1n << 127n) - 1n;

export function oracleSourceIdBytes(value: string): number[] {
  const normalized = value.toLowerCase().replace(/^0x/, "");
  if (!/^[0-9a-f]{64}$/.test(normalized)) {
    throw new Error("Oracle source ID must be an exact 32-byte hexadecimal value");
  }
  return Array.from(Buffer.from(normalized, "hex"));
}

export function txlineFixtureSourceId(fixtureId: bigint): number[] {
  if (fixtureId <= 0n || fixtureId > I64_MAX) {
    throw new Error("TxLINE fixture ID must fit a positive signed 64-bit integer");
  }
  const bytes = Buffer.alloc(32);
  bytes.writeBigInt64LE(fixtureId);
  return Array.from(bytes);
}

export function parseDecimalAtExponent(value: string, exponent: number): bigint {
  if (!Number.isSafeInteger(exponent) || exponent > 0 || exponent < -18) {
    throw new Error("Oracle exponent must be an integer from -18 through 0");
  }
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(value);
  if (!match) throw new Error("Oracle threshold must be a plain decimal number");
  const precision = -exponent;
  const fraction = match[3] ?? "";
  if (fraction.length > precision) {
    throw new Error(`Oracle threshold supports at most ${precision} decimal places`);
  }
  const magnitude = BigInt(`${match[2]}${fraction.padEnd(precision, "0")}`);
  const result = match[1] === "-" ? -magnitude : magnitude;
  if (result < I128_MIN || result > I128_MAX) {
    throw new Error("Oracle threshold exceeds the signed 128-bit range");
  }
  return result;
}

export function marketIdFromEntropy(entropy: Uint8Array): bigint {
  if (entropy.length !== 8) throw new Error("Market ID entropy must contain exactly eight bytes");
  const marketId = Buffer.from(entropy).readBigUInt64LE();
  if (marketId === 0n) throw new Error("Market ID cannot be zero");
  return marketId;
}

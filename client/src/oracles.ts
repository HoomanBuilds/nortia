export const PYTH_RECEIVER_PROGRAM_ADDRESS = "rec5EKMGg6MxZYaMdyBfgwp4d5rB9T1VQH5pJv5LtFJ";
export const PYTH_PUSH_ORACLE_PROGRAM_ADDRESS = "pythWSnswVUd12oZpeFP8e9CVaEqJg25g1Vtc2biRsT";
export const SWITCHBOARD_QUOTE_PROGRAM_ADDRESS = "orac1eFjzWL5R3RbbdMV68K9H6TaCVVcL6LjvQQWAbz";
export const SWITCHBOARD_DEVNET_QUEUE_ADDRESS = "EYiAmGSdsQTuCw413V5BzaruWuCCSDgTPtBGvLkXHbe7";
export const STORK_ORACLE_PROGRAM_ADDRESS = "stork1JUZMKYgjNagHiK2KdMmb42iTnYe9bYUCDUk8n";

export type OracleMarketCategory =
  | "sports"
  | "crypto"
  | "economics"
  | "politics"
  | "technology"
  | "culture"
  | "science"
  | "other";

export type PythAssetType =
  | "Crypto"
  | "Crypto Redemption Rate"
  | "Crypto Index"
  | "Crypto NAV"
  | "Equity"
  | "FX"
  | "Metal"
  | "Rates"
  | "Commodities"
  | "ECO";

export type PythFeed = {
  id: string;
  symbol: string;
  base: string;
  quoteCurrency: string;
  description: string;
  schedule: string | null;
  assetType: PythAssetType;
  category: "crypto" | "economics";
  delivery: "sponsored-push" | "hermes-pull";
  heartbeatSeconds: number | null;
};

type HermesFeed = {
  id?: unknown;
  attributes?: Record<string, unknown>;
};

const SPONSORED_PYTH_FEEDS = [
  ["BTC/USD", "e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43", 60],
  ["ETH/USD", "ff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace", 60],
  ["SOL/USD", "ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d", 60],
  ["MSOL/USD", "c2289a6a43d2ce91c6f55caec370f4acc38a2ed477f58813334c6d03749ff2a4", 60],
  ["BSOL/USD", "89875379e70f8fbadc17aef315adf3a8d5d160b811435537e03c97e8aac97d9c", 60],
  ["SSOL/SOL", "add6499a420f809bbebc0b22fbf68acb8c119023897f6ea801688e0d6e391af4", 60],
  ["BONK/USD", "72b021217ca3fe68922a19aaf990109cb9d84e9ad004b4d2025ad6f529314419", 60],
  ["W/USD", "eff7446475e218517566ea99e72a4abec2e1bd8498b43b7d8331e29dcb059389", 60],
  ["MEW/USD", "514aed52ca5294177f20187ae883cec4a018619772ddce41efcc36a6448f5d5d", 60],
  ["USDC/USD", "eaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a", 60],
  ["USDT/USD", "2b89b9dc8fdf9f34709a5b106b472f0f39bb6ca9ce04b0fd7f2e971688e2e53b", 60],
  ["JUP/USD", "0a0408d619e9380abad35060f9192039ed5042fa6f82301d0e48bb52be830996", 60],
  ["PYTH/USD", "0bbf28e9a841a1cc788f6a361b17ca072d0ea3098a1e5df1c3922d06719579ff", 60],
  ["HNT/USD", "649fdd7ec08e8e2a20f425729854e90293dcbe2376abc47197a14da6ff339756", 60],
  ["ORCA/USD", "37505261e557e251290b8c8899453064e8d760ed5c65a779726f2490980da74c", 60],
  ["SAMO/USD", "49601625e1a342c1f90c3fe6a03ae0251991a1d76e480d2741524c29037be28a", 60],
  ["WIF/USD", "4ca4beeca86f0d164160323817a4e42b10010a724c2217c6ee41b54cd4cc61fc", 60],
  ["INF/USD", "f51570985c642c49c2d6e50156390fdba80bb6d5f7fa389d2f012ced4f7d208f", 60],
  ["MNDE/USD", "3607bf4d7b78666bd3736c7aacaf2fd2bc56caa8667d3224971ebe3c0623292a", 60],
  ["NEON/USD", "d82183dd487bef3208a227bb25d748930db58862c5121198e723ed0976eb92b7", 60],
  ["JLP/USD", "c811abc82b4bad1f9bd711a2773ccaa935b03ecef974236942cec5e0eb845a3a", 60],
  ["WBTC/USD", "c9d8b075a5c69303365ae23633d4e085199bf5c520a3b90fed1322a0342ffc33", 60],
  ["PENGU/USD", "bed3097008b9b5e3c93bec20be79cb43986b85a996475589351a21e67bae9b61", 60],
  ["TRUMP/USD", "879551021853eec7a7dc827578e8e69da7e4fa8148339aa0d3d5296405be4b1a", 60],
  ["FARTCOIN/USD", "58cd29ef0e714c5affc44f269b2c1899a52da4169d7acc147b9da692e6953608", 60],
  ["ACRED/USD", "40ac3329933a6b5b65cf31496018c5764ac0567316146f7d0de00095886b480d", 60],
  ["PUMP/USD", "7a01fca212788bba7c5bf8c9efd576a8a722f070d2c17596ff7bb609b8d5c3b9", 60],
  ["JUPSOL/SOL.RR", "f8d8d6b6c866c8b2624fb5b679ae846738725e5fc887fa8e927c8d8645018a2b", 60],
  ["NAV.USTB/USD", "dea78edd10cd7ae4524cc1744216788746306623bc3553014eeab6062860795d", 60],
  ["NAV.USCC/USD", "5d73a5953dc86c4773adc778c30e8a6dfc94c5c3a74d7ebb56dd5e70350f044a", 60],
  ["ZBTC/USD", "3d824c7f7c26ed1c85421ecec8c754e6b52d66a4e45de20a9c9ea91de8b396f9", 60],
  ["LBTC/USD", "8f257aab6e7698bb92b15511915e593d6f8eae914452f781874754b03d0c612b", 60],
  ["INF/SOL.RR", "3e9961b890c4e77e9009c1a6d81dc556e24a3c190b02d1682c8f545c53b1d4a2", 60],
  ["INDEX.FORD/USD", "84d8c84bfbe6f71af527493f9aaee09950ee3e09c8460b2b781ce65ea341c10a", 60],
  ["INDEX.GLXY/USD", "c59735498fa594a63e36382c12656e4313a7269ea1a1ed8fa583008e277f9cdb", 60],
  ["SYRUPUSDC/USDC.RR", "2ad31d1c4a85fbf2156ce57fab4104124c5ef76a6386375ecfc8da1ed5ce1486", 60],
  ["ORE/USD", "142b804c658e14ff60886783e46e5a51bdf398b4871d9d8f7c28aa1585cad504", 60],
  ["NOPAL/USD.RR", "8858dfaa8998ff44681aa145a8aa5b7772979b1d044a1bbf3cf5d971168baa85", 60],
  ["NTBILL/USD.RR", "f03015f29e6c90d5fe62da7d1a13c912c8bf7523d90c981387f82ee0c83332bd", 60],
  ["NBASIS/USD.RR", "fd9397e6dfc968ff8eaa652c6e4b7dfdeb6fdc940afe90c23ca5acfa45d408e1", 60],
  ["NWISDOM/USD.RR", "384986c9655ec6887dbd7f7430d864992f872db2c77ba5781a26b78dad277adc", 60],
  ["NALPHA/USD.RR", "57d1e11bea1316c2f7263a39c2780685691585aae34eff39300f5db564501b17", 60],
  ["NFALCON/USD.RR", "323647322045edff1a0928dca6628169a57afdea43a5f0d948115e3dcae9c1fb", 60],
  ["CASH/RD.RR", "64c74ffd61574170cfaee65c54c8810adcf83f6c31f3c256d9a290dcbf4ff1a9", 30],
  ["CASH/USD", "df3320ef0f4617337b8dbb924f2aaa4f9db08f522a5435b44f9066c1ac4c7f95", 30],
  ["PST/USDC.RR", "675e36f84a6be779ed793c71eb5c03151e1866c125767f46933626e0610af84d", 240],
  ["JUPUSD/USD", "8ed858a2214e892c9371694fb6c8a9037b6ed4052c4edf209f8cb988484e81d9", 60],
] as const;

export const SPONSORED_PYTH_FEED_IDS = new Set<string>(
  SPONSORED_PYTH_FEEDS.map(([, id]) => id),
);

export const PYTH_PRICE_FEEDS: readonly PythFeed[] = SPONSORED_PYTH_FEEDS.map(
  ([symbol, id, heartbeatSeconds]) => {
    const [base, quote = "USD"] = symbol.split("/");
    const assetType: PythAssetType = symbol.includes(".RR")
      ? "Crypto Redemption Rate"
      : symbol.startsWith("NAV.")
        ? "Crypto NAV"
        : symbol.startsWith("INDEX.")
          ? "Crypto Index"
          : "Crypto";
    return {
      id,
      symbol,
      base,
      quoteCurrency: quote.replace(/\.RR$/, ""),
      description: `${symbol} sponsored Solana price feed`,
      schedule: null,
      assetType,
      category: "crypto",
      delivery: "sponsored-push",
      heartbeatSeconds,
    };
  },
);

const PYTH_ASSET_TYPES = new Set<PythAssetType>([
  "Crypto",
  "Crypto Redemption Rate",
  "Crypto Index",
  "Crypto NAV",
  "Equity",
  "FX",
  "Metal",
  "Rates",
  "Commodities",
  "ECO",
]);

export function pythAssetCategory(assetType: PythAssetType): "crypto" | "economics" {
  return assetType.startsWith("Crypto") ? "crypto" : "economics";
}

function stringAttribute(attributes: Record<string, unknown>, key: string): string {
  const value = attributes[key];
  return typeof value === "string" ? value.trim() : "";
}

export function normalizePythFeed(feed: HermesFeed): PythFeed | null {
  const id = typeof feed.id === "string" ? feed.id.toLowerCase().replace(/^0x/, "") : "";
  const attributes = feed.attributes ?? {};
  const assetType = stringAttribute(attributes, "asset_type") as PythAssetType;
  const symbol = stringAttribute(attributes, "display_symbol");
  const base = stringAttribute(attributes, "base");
  const quoteCurrency = stringAttribute(attributes, "quote_currency");
  const description = stringAttribute(attributes, "description");
  const schedule = stringAttribute(attributes, "schedule") || null;
  if (
    !/^[0-9a-f]{64}$/.test(id)
    || !PYTH_ASSET_TYPES.has(assetType)
    || !symbol
    || !base
    || !quoteCurrency
    || !description
    || /deprecated/i.test(`${symbol} ${description}`)
  ) return null;
  const sponsored = SPONSORED_PYTH_FEED_IDS.has(id);
  const fallback = sponsored ? PYTH_PRICE_FEEDS.find((item) => item.id === id) : null;
  return {
    id,
    symbol,
    base,
    quoteCurrency,
    description,
    schedule,
    assetType,
    category: pythAssetCategory(assetType),
    delivery: sponsored ? "sponsored-push" : "hermes-pull",
    heartbeatSeconds: fallback?.heartbeatSeconds ?? null,
  };
}

export function searchPythFeeds(
  values: readonly HermesFeed[],
  input: { query?: string; category?: "all" | "crypto" | "economics"; limit?: number } = {},
): PythFeed[] {
  const query = input.query?.trim().toLowerCase() ?? "";
  const category = input.category ?? "all";
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 100);
  const seen = new Set<string>();
  return values
    .map(normalizePythFeed)
    .filter((feed): feed is PythFeed => Boolean(feed))
    .filter((feed) => {
      if (seen.has(feed.id)) return false;
      seen.add(feed.id);
      return category === "all" || feed.category === category;
    })
    .filter((feed) => !query || `${feed.symbol} ${feed.description} ${feed.assetType}`.toLowerCase().includes(query))
    .sort((left, right) => {
      if (left.delivery !== right.delivery) return left.delivery === "sponsored-push" ? -1 : 1;
      return left.symbol.localeCompare(right.symbol);
    })
    .slice(0, limit);
}

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

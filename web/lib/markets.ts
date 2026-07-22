export type MarketStatus = "live" | "upcoming" | "settled";
export type TradingState = "open" | "locked" | "batched" | "resolving" | "disputed" | "resolved" | "refunding" | "closed";
export type MarketCategory = "Sports" | "Crypto" | "Economics" | "Politics" | "Technology" | "Culture" | "Science" | "Other";

export type MarketActivity = {
  signature: string;
  slot: number;
  timestamp: number | null;
  kind: "trade" | "lifecycle" | "resolution" | "settlement" | "liquidity";
  title: string;
  detail: string;
  account: string | null;
  yesProbability: number | null;
};

export type HybridOracleDetails = {
  sourceProgram: string;
  sourceQueue: string;
  sourceId: string;
  comparator: "greater-than" | "greater-than-or-equal" | "less-than" | "less-than-or-equal" | "equal";
  threshold: string;
  thresholdExponent: number;
  observationAt: string;
  observationWindowSecs: number;
  maxStalenessSecs: number;
  maxStalenessSlots: string;
  maxConfidenceBps: number;
  minSamples: number;
  challengePeriodSecs: number;
  bondAmount: string;
  consumed: boolean;
};

export type HybridResolutionReceipt = {
  outcome: "no" | "yes" | "invalid";
  observationValue: string;
  observationExponent: number;
  observationAt: string;
  observationSlot: string;
  confidence: string;
  sampleCount: number;
  sourceAccount: string;
  evidenceHash: string;
  finalizedAt: string;
};

export type HybridMarketDetails = {
  creator: string;
  liquidityOwner: string;
  treasuryOwner: string;
  collateralMint: string;
  oracleConfig: string;
  resolverId: "txline-stat" | "pyth-price" | "switchboard-quote" | "optimistic" | "uma-wormhole" | "chainlink-report" | "stork-price";
  metadataPublished: boolean;
  rules: string | null;
  yesLabel: string;
  noLabel: string;
  referenceUrl: string | null;
  questionHash: string;
  rulesHash: string;
  liquidityParameter: string;
  yesQuantity: string;
  noQuantity: string;
  maxTradeShares: string;
  tradeFeeBps: number;
  treasuryFeeShareBps: number;
  openAt: string;
  resolveNotBefore: string;
  resolutionDeadline: string;
  settlementEvidenceHash: string;
  outcome: "no" | "yes" | "invalid" | "unset";
  oracle: HybridOracleDetails;
  receipt: HybridResolutionReceipt | null;
};

export type Market = {
  id: string;
  address?: string;
  marketId?: string;
  fixtureId: number;
  category: MarketCategory;
  resolver: string;
  competition: string;
  question: string;
  shortQuestion: string;
  home: string;
  homeCode: string;
  away: string;
  awayCode: string;
  kickoff: string;
  lockAt: string;
  status: MarketStatus;
  tradingState: TradingState;
  minute?: number;
  score?: [number, number];
  yes: number;
  volume: number;
  liquidity: number;
  traders: number;
  privateStakeAmount?: string;
  featured?: boolean;
  replay: boolean;
  points: number[];
  hybrid?: HybridMarketDetails;
  activity?: MarketActivity[];
};

export type ReplayEvent = {
  minute: number;
  label: string;
  detail: string;
  score: [number, number];
  probability: number;
  sequence: number;
};

export const NORTIA_PROGRAM_ID = "4S2EvdGrbKJ9zazvB4gtR83crTrVJWqqwoVVvEQy8VE9";
export const TXLINE_PROGRAM_ID = "6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J";
export const DEVNET_USDC_MINT = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";

export const replayEvents: ReplayEvent[] = [
  { minute: 0, label: "Kickoff", detail: "Simulated TxLINE-format event", score: [0, 0], probability: 48, sequence: 1 },
  { minute: 24, label: "Score update", detail: "Participant 1 total goals changed", score: [1, 0], probability: 58, sequence: 22 },
  { minute: 53, label: "Score update", detail: "Participant 1 total goals changed", score: [2, 0], probability: 74, sequence: 49 },
  { minute: 71, label: "Score update", detail: "Participant 2 total goals changed", score: [2, 1], probability: 100, sequence: 65 },
  { minute: 84, label: "Score update", detail: "Participant 1 total goals changed", score: [3, 1], probability: 100, sequence: 76 },
  { minute: 90, label: "Game finalised", detail: "Final score record, period 100", score: [3, 1], probability: 100, sequence: 81 },
];

export const markets: Market[] = [
  {
    id: "demo-txline-replay",
    fixtureId: 18222446,
    category: "Sports",
    resolver: "TxLINE",
    competition: "World Cup Quarter-final",
    question: "Will Argentina vs Switzerland finish with over 2.5 goals?",
    shortQuestion: "Over 2.5 total goals",
    home: "Argentina",
    homeCode: "ARG",
    away: "Switzerland",
    awayCode: "SUI",
    kickoff: "Final score replay",
    lockAt: "2026-07-12T01:00:00Z",
    status: "settled",
    tradingState: "resolved",
    minute: 90,
    score: [3, 1],
    yes: 100,
    volume: 63,
    liquidity: 62.37,
    traders: 4,
    privateStakeAmount: "100000000",
    featured: true,
    replay: true,
    points: [48, 49, 47, 51, 54, 58, 61, 66, 74, 82, 100, 100],
  },
  {
    id: "spain-argentina-final-total",
    fixtureId: 18257739,
    category: "Sports",
    resolver: "TxLINE",
    competition: "World Cup Final",
    question: "Will Spain vs Argentina finish with over 2.5 goals?",
    shortQuestion: "Over 2.5 total goals",
    home: "Spain",
    homeCode: "ESP",
    away: "Argentina",
    awayCode: "ARG",
    kickoff: "Jul 19, 19:00 UTC",
    lockAt: "2026-07-19T19:00:00Z",
    status: "upcoming",
    tradingState: "open",
    yes: 52,
    volume: 0,
    liquidity: 0,
    traders: 0,
    replay: false,
    points: [50, 51, 50, 52, 51, 52],
  },
  {
    id: "france-morocco-quarter-final",
    fixtureId: 18209181,
    category: "Sports",
    resolver: "TxLINE",
    competition: "World Cup Quarter-final",
    question: "Did France vs Morocco finish with over 2.5 goals?",
    shortQuestion: "Over 2.5 total goals",
    home: "France",
    homeCode: "FRA",
    away: "Morocco",
    awayCode: "MAR",
    kickoff: "Final score replay",
    lockAt: "2026-07-09T20:00:00Z",
    status: "settled",
    tradingState: "resolved",
    minute: 90,
    score: [2, 0],
    yes: 0,
    volume: 0,
    liquidity: 0,
    traders: 0,
    replay: true,
    points: [46, 44, 41, 37, 30, 18, 0],
  },
  {
    id: "spain-belgium-quarter-final",
    fixtureId: 18218149,
    category: "Sports",
    resolver: "TxLINE",
    competition: "World Cup Quarter-final",
    question: "Did Spain vs Belgium finish with over 2.5 goals?",
    shortQuestion: "Over 2.5 total goals",
    home: "Spain",
    homeCode: "ESP",
    away: "Belgium",
    awayCode: "BEL",
    kickoff: "Final score replay",
    lockAt: "2026-07-10T19:00:00Z",
    status: "settled",
    tradingState: "resolved",
    minute: 90,
    score: [2, 1],
    yes: 100,
    volume: 0,
    liquidity: 0,
    traders: 0,
    replay: true,
    points: [48, 50, 53, 58, 67, 76, 100],
  },
  {
    id: "norway-england-quarter-final",
    fixtureId: 18213979,
    category: "Sports",
    resolver: "TxLINE",
    competition: "World Cup Quarter-final",
    question: "Did Norway vs England finish with over 2.5 goals?",
    shortQuestion: "Over 2.5 total goals",
    home: "Norway",
    homeCode: "NOR",
    away: "England",
    awayCode: "ENG",
    kickoff: "Final score replay",
    lockAt: "2026-07-11T21:00:00Z",
    status: "settled",
    tradingState: "resolved",
    minute: 90,
    score: [1, 2],
    yes: 100,
    volume: 0,
    liquidity: 0,
    traders: 0,
    replay: true,
    points: [49, 51, 48, 57, 64, 79, 100],
  },
];

export const featuredMarket = markets[0]!;

export const demoPool = {
  stakeUsdc: 100,
  orderCount: 4,
  yesCount: 2,
  noCount: 2,
  yesAmount: 42,
  noAmount: 21,
  grossPool: 63,
  fee: 0.63,
  keeperReward: 0.063,
  treasuryRevenue: 0.567,
  netPool: 62.37,
  exampleWinningWager: 37,
  examplePayout: 117.945,
  feeBps: 100,
};

export function formatCompactUsd(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: value >= 1_000 ? "compact" : "standard",
    minimumFractionDigits: value < 10 ? 2 : 0,
    maximumFractionDigits: value < 10 ? 2 : 1,
  }).format(value);
}

export function getMarket(id: string) {
  return markets.find((market) => market.id === id);
}

export function canPlaceOrder(market: Market, now = Date.now()) {
  return market.tradingState === "open" && now < Date.parse(market.lockAt);
}

export function tradingStateLabel(market: Market, now = Date.now()) {
  if (market.tradingState === "open" && now >= Date.parse(market.lockAt)) return "Locked";
  return market.tradingState.charAt(0).toUpperCase() + market.tradingState.slice(1);
}

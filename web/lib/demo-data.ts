export type ReplayEvent = {
  minute: number;
  label: string;
  scoreA: number;
  scoreB: number;
  overProbability: number;
  sequence: number;
};

export const DEMO_MARKET_ADDRESS = "demo-txline-replay";
export const NORTIA_PROGRAM_ID = "4S2EvdGrbKJ9zazvB4gtR83crTrVJWqqwoVVvEQy8VE9";
export const TXLINE_PROGRAM_ID = "6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J";
export const DEVNET_USDC_MINT = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";

export const replayEvents: readonly ReplayEvent[] = [
  { minute: 0, label: "Kickoff", scoreA: 0, scoreB: 0, overProbability: 48, sequence: 1 },
  { minute: 19, label: "Brazil goal", scoreA: 1, scoreB: 0, overProbability: 61, sequence: 18 },
  { minute: 44, label: "France goal", scoreA: 1, scoreB: 1, overProbability: 76, sequence: 39 },
  { minute: 68, label: "Brazil goal", scoreA: 2, scoreB: 1, overProbability: 100, sequence: 62 },
  { minute: 90, label: "Game finalised", scoreA: 2, scoreB: 1, overProbability: 100, sequence: 81 },
] as const;

export const demoPool = {
  ticketAmount: 1_000_000n,
  orderCount: 3,
  yesCount: 2,
  noCount: 1,
  grossPool: 3_000_000n,
  protocolFee: 30_000n,
  netPool: 2_970_000n,
  payoutAmount: 1_485_000n,
  feeBps: 100,
} as const;

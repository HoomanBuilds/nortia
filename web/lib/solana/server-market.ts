import "server-only";
import { BorshAccountsCoder, type Idl } from "@anchor-lang/core";
import { Connection, PublicKey } from "@solana/web3.js";
import idl from "@/lib/solana/idl/nortia.json";
import { NORTIA_PROGRAM_KEY } from "@/lib/solana/constants";
import { markets, type Market, type TradingState } from "@/lib/markets";

type MarketAccount = {
  marketId: { toString(): string };
  authority: PublicKey;
  fixtureId: { toNumber(): number };
  marketMode: Record<string, unknown>;
  fixtureStartTs: { toNumber(): number };
  totalGoalsThreshold: number;
  ticketAmount: { toNumber(): number };
  lockTs: { toNumber(): number };
  phase: Record<string, unknown>;
  orderCount: number;
  outcome: number;
  grossPool: { toNumber(): number };
  netPool: { toNumber(): number };
  scoreA: number;
  scoreB: number;
};

function phase(value: Record<string, unknown>): TradingState | null {
  const name = Object.keys(value)[0];
  return name === "open" || name === "batched" || name === "resolved" || name === "refunding" || name === "closed" ? name : null;
}

export async function getOnchainMarket(value: string): Promise<Market | null> {
  let address: PublicKey;
  try {
    address = new PublicKey(value);
  } catch {
    return null;
  }
  const connection = new Connection(process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? "https://api.devnet.solana.com", "confirmed");
  const info = await connection.getAccountInfo(address, "confirmed");
  if (!info || !info.owner.equals(NORTIA_PROGRAM_KEY)) return null;
  let account: MarketAccount;
  try {
    account = new BorshAccountsCoder(idl as Idl).decode("market", info.data) as MarketAccount;
  } catch {
    return null;
  }
  const tradingState = phase(account.phase);
  if (!tradingState) return null;
  const fixtureId = account.fixtureId.toNumber();
  const template = markets.find((market) => market.fixtureId === fixtureId);
  const threshold = account.totalGoalsThreshold + 0.5;
  const resolved = tradingState === "resolved" || tradingState === "closed";
  const replay = "replay" in account.marketMode;
  const home = template?.home ?? "Participant one";
  const away = template?.away ?? "Participant two";
  const lockAt = new Date(account.lockTs.toNumber() * 1_000).toISOString();
  return {
    id: value,
    address: value,
    marketId: account.marketId.toString(),
    fixtureId,
    category: "Sports",
    resolver: "TxLINE",
    competition: template?.competition ?? "TxLINE covered fixture",
    question: `Will ${home} vs ${away} finish with over ${threshold} goals?`,
    shortQuestion: `Over ${threshold} total goals`,
    home,
    homeCode: template?.homeCode ?? "ONE",
    away,
    awayCode: template?.awayCode ?? "TWO",
    kickoff: template?.kickoff ?? new Date(account.fixtureStartTs.toNumber() * 1_000).toLocaleString("en-US", { timeZone: "UTC" }),
    lockAt,
    status: resolved ? "settled" : Date.now() < account.lockTs.toNumber() * 1_000 ? "upcoming" : "live",
    tradingState,
    score: resolved ? [account.scoreA, account.scoreB] : undefined,
    yes: resolved ? account.outcome * 100 : 50,
    volume: account.grossPool.toNumber() > 0 ? account.grossPool.toNumber() / 1_000_000 : account.orderCount * account.ticketAmount.toNumber() / 1_000_000,
    liquidity: account.netPool.toNumber() / 1_000_000,
    traders: account.orderCount,
    replay,
    points: [50, 50],
  };
}

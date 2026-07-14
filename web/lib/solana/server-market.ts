import "server-only";
import { BorshAccountsCoder, type Idl } from "@anchor-lang/core";
import { Connection, PublicKey } from "@solana/web3.js";
import idl from "@/lib/solana/idl/nortia.json";
import { NORTIA_PROGRAM_KEY } from "@/lib/solana/constants";
import { markets, type Market, type TradingState } from "@/lib/markets";

type MarketAccount = {
  market_id: { toString(): string };
  authority: PublicKey;
  fixture_id: { toNumber(): number };
  market_mode: Record<string, unknown>;
  fixture_start_ts: { toNumber(): number };
  total_goals_threshold: number;
  ticket_amount: { toNumber(): number };
  lock_ts: { toNumber(): number };
  phase: Record<string, unknown>;
  order_count: number;
  outcome: number;
  gross_pool: { toNumber(): number };
  net_pool: { toNumber(): number };
  score_a: number;
  score_b: number;
};

function phase(value: Record<string, unknown>): TradingState | null {
  const name = Object.keys(value)[0]?.toLowerCase();
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
    account = new BorshAccountsCoder(idl as Idl).decode("Market", info.data) as MarketAccount;
  } catch {
    return null;
  }
  const tradingState = phase(account.phase);
  if (!tradingState) return null;
  const fixtureId = account.fixture_id.toNumber();
  const template = markets.find((market) => market.fixtureId === fixtureId);
  const threshold = account.total_goals_threshold + 0.5;
  const resolved = tradingState === "resolved" || tradingState === "closed";
  const replay = Object.keys(account.market_mode)[0]?.toLowerCase() === "replay";
  const home = template?.home ?? "Participant one";
  const away = template?.away ?? "Participant two";
  const lockAt = new Date(account.lock_ts.toNumber() * 1_000).toISOString();
  return {
    id: value,
    address: value,
    marketId: account.market_id.toString(),
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
    kickoff: template?.kickoff ?? new Date(account.fixture_start_ts.toNumber() * 1_000).toLocaleString("en-US", { timeZone: "UTC" }),
    lockAt,
    status: resolved ? "settled" : Date.now() < account.lock_ts.toNumber() * 1_000 ? "upcoming" : "live",
    tradingState,
    score: resolved ? [account.score_a, account.score_b] : undefined,
    yes: resolved ? account.outcome * 100 : 50,
    volume: account.gross_pool.toNumber() > 0 ? account.gross_pool.toNumber() / 1_000_000 : account.order_count * account.ticket_amount.toNumber() / 1_000_000,
    liquidity: account.net_pool.toNumber() / 1_000_000,
    traders: account.order_count,
    replay,
    points: [50, 50],
  };
}

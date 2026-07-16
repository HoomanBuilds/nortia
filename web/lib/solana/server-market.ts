import "server-only";
import { createHash } from "node:crypto";
import { BorshAccountsCoder, type Idl } from "@anchor-lang/core";
import { Connection, PublicKey } from "@solana/web3.js";
import { lmsrYesProbability } from "nortia-client/lmsr";
import { hybridVaultPda } from "nortia-client/v2";
import idl from "@/lib/solana/idl/nortia.json";
import { NORTIA_PROGRAM_KEY } from "@/lib/solana/constants";
import {
  markets,
  type HybridMarketDetails,
  type Market,
  type MarketCategory,
  type TradingState,
} from "@/lib/markets";

type IntegerLike = { toString(): string; toNumber(): number };

type MarketAccount = {
  market_id: IntegerLike;
  authority: PublicKey;
  fixture_id: IntegerLike;
  market_mode: Record<string, unknown>;
  fixture_start_ts: IntegerLike;
  total_goals_threshold: number;
  ticket_amount: IntegerLike;
  lock_ts: IntegerLike;
  phase: Record<string, unknown>;
  order_count: number;
  outcome: number;
  gross_pool: IntegerLike;
  net_pool: IntegerLike;
  score_a: number;
  score_b: number;
};

type HybridMarketAccount = {
  market_id: IntegerLike;
  creator: PublicKey;
  liquidity_owner: PublicKey;
  category: Record<string, unknown>;
  question_hash: number[];
  rules_hash: number[];
  collateral_mint: PublicKey;
  treasury_owner: PublicKey;
  oracle_config: PublicKey;
  liquidity_parameter: IntegerLike;
  max_trade_shares: IntegerLike;
  yes_quantity: IntegerLike;
  no_quantity: IntegerLike;
  trade_fee_bps: number;
  treasury_fee_share_bps: number;
  open_ts: IntegerLike;
  lock_ts: IntegerLike;
  resolve_not_before_ts: IntegerLike;
  resolution_deadline_ts: IntegerLike;
  phase: Record<string, unknown>;
  outcome: number;
  trade_count: IntegerLike;
  volume: IntegerLike;
};

type OracleConfigAccount = {
  market: PublicKey;
  resolver: Record<string, unknown>;
};

function enumKey(value: Record<string, unknown>): string {
  return (Object.keys(value)[0] ?? "").replaceAll("_", "").toLowerCase();
}

function legacyPhase(value: Record<string, unknown>): TradingState | null {
  const name = enumKey(value);
  return name === "open" || name === "batched" || name === "resolved" || name === "refunding" || name === "closed" ? name : null;
}

function hybridPhase(value: Record<string, unknown>): TradingState | null {
  const name = enumKey(value);
  return name === "open" || name === "locked" || name === "resolving" || name === "disputed" || name === "resolved" || name === "closed" ? name : null;
}

function categoryName(value: Record<string, unknown>): MarketCategory | null {
  const names: Readonly<Record<string, MarketCategory>> = {
    sports: "Sports",
    crypto: "Crypto",
    politics: "Politics",
    technology: "Technology",
    culture: "Culture",
    other: "Other",
  };
  return names[enumKey(value)] ?? null;
}

function resolverName(value: Record<string, unknown>): Pick<HybridMarketDetails, "resolverId"> & { label: string } | null {
  const names: Readonly<Record<string, Pick<HybridMarketDetails, "resolverId"> & { label: string }>> = {
    txlinestatv2: { resolverId: "txline-stat-v2", label: "TxLINE" },
    pythpricev2: { resolverId: "pyth-price-v2", label: "Pyth" },
    switchboardquotev1: { resolverId: "switchboard-quote-v1", label: "Switchboard" },
    optimisticv1: { resolverId: "optimistic-v1", label: "Bonded" },
    umawormholev1: { resolverId: "uma-wormhole-v1", label: "UMA" },
    chainlinkreportv1: { resolverId: "chainlink-report-v1", label: "Chainlink" },
  };
  return names[enumKey(value)] ?? null;
}

function verifiedQuestion(candidate: string | undefined, hash: number[]): string | null {
  if (!candidate) return null;
  const actual = createHash("sha256").update(candidate, "utf8").digest();
  return actual.equals(Buffer.from(hash)) ? candidate : null;
}

function outcomeName(value: number): HybridMarketDetails["outcome"] | null {
  return (["no", "yes", "invalid", "unset"] as const)[value] ?? null;
}

function categoryCode(category: MarketCategory): string {
  const codes: Readonly<Record<MarketCategory, string>> = {
    Sports: "SPT",
    Crypto: "CRY",
    Politics: "POL",
    Technology: "TEC",
    Culture: "CUL",
    Other: "MKT",
  };
  return codes[category];
}

function buildLegacyMarket(value: string, account: MarketAccount): Market | null {
  const tradingState = legacyPhase(account.phase);
  if (!tradingState) return null;
  const fixtureId = account.fixture_id.toNumber();
  const template = markets.find((market) => market.fixtureId === fixtureId);
  const threshold = account.total_goals_threshold + 0.5;
  const resolved = tradingState === "resolved" || tradingState === "closed";
  const replay = enumKey(account.market_mode) === "replay";
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

async function buildHybridMarket(
  connection: Connection,
  coder: BorshAccountsCoder,
  address: PublicKey,
  account: HybridMarketAccount,
  questionCandidate?: string,
): Promise<Market | null> {
  const tradingState = hybridPhase(account.phase);
  const category = categoryName(account.category);
  const outcome = outcomeName(account.outcome);
  if (!tradingState || !category || !outcome) return null;
  const oracleInfo = await connection.getAccountInfo(account.oracle_config, "confirmed");
  if (!oracleInfo || !oracleInfo.owner.equals(NORTIA_PROGRAM_KEY)) return null;
  let oracle: OracleConfigAccount;
  try {
    oracle = coder.decode("OracleConfig", oracleInfo.data) as OracleConfigAccount;
  } catch {
    return null;
  }
  if (!oracle.market.equals(address)) return null;
  const resolver = resolverName(oracle.resolver);
  if (!resolver) return null;
  const yesQuantity = BigInt(account.yes_quantity.toString());
  const noQuantity = BigInt(account.no_quantity.toString());
  const liquidityParameter = BigInt(account.liquidity_parameter.toString());
  const probability = lmsrYesProbability(
    { yes: yesQuantity, no: noQuantity },
    liquidityParameter,
  );
  const vault = hybridVaultPda(address);
  const vaultBalance = await connection.getTokenAccountBalance(vault, "confirmed").catch(() => null);
  const questionHash = Buffer.from(account.question_hash).toString("hex");
  const question = verifiedQuestion(questionCandidate, account.question_hash)
    ?? `Verified market ${questionHash.slice(0, 8)}`;
  const yes = Math.round(Number(probability) / 10_000);
  const lockAt = new Date(account.lock_ts.toNumber() * 1_000).toISOString();
  const resolved = tradingState === "resolved" || tradingState === "closed";
  const details: HybridMarketDetails = {
    creator: account.creator.toBase58(),
    liquidityOwner: account.liquidity_owner.toBase58(),
    treasuryOwner: account.treasury_owner.toBase58(),
    collateralMint: account.collateral_mint.toBase58(),
    oracleConfig: account.oracle_config.toBase58(),
    resolverId: resolver.resolverId,
    questionHash,
    rulesHash: Buffer.from(account.rules_hash).toString("hex"),
    liquidityParameter: liquidityParameter.toString(),
    yesQuantity: yesQuantity.toString(),
    noQuantity: noQuantity.toString(),
    maxTradeShares: account.max_trade_shares.toString(),
    tradeFeeBps: account.trade_fee_bps,
    treasuryFeeShareBps: account.treasury_fee_share_bps,
    resolutionDeadline: new Date(account.resolution_deadline_ts.toNumber() * 1_000).toISOString(),
    outcome,
  };
  return {
    id: address.toBase58(),
    address: address.toBase58(),
    marketId: account.market_id.toString(),
    fixtureId: 0,
    category,
    resolver: resolver.label,
    competition: `${category} continuous market`,
    question,
    shortQuestion: question,
    home: category,
    homeCode: categoryCode(category),
    away: resolver.label,
    awayCode: resolver.label.slice(0, 3).toUpperCase(),
    kickoff: `Resolves ${new Date(account.resolve_not_before_ts.toNumber() * 1_000).toLocaleString("en-US", { timeZone: "UTC", timeZoneName: "short" })}`,
    lockAt,
    status: resolved ? "settled" : Date.now() < account.open_ts.toNumber() * 1_000 ? "upcoming" : "live",
    tradingState,
    yes,
    volume: account.volume.toNumber() / 1_000_000,
    liquidity: Number(vaultBalance?.value.amount ?? "0") / 1_000_000,
    traders: account.trade_count.toNumber(),
    replay: false,
    points: yes === 50 ? [50, 50] : [50, yes],
    hybrid: details,
  };
}

export async function getOnchainMarket(value: string, questionCandidate?: string): Promise<Market | null> {
  let address: PublicKey;
  try {
    address = new PublicKey(value);
  } catch {
    return null;
  }
  const connection = new Connection(
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? "https://api.devnet.solana.com",
    "confirmed",
  );
  const info = await connection.getAccountInfo(address, "confirmed");
  if (!info || !info.owner.equals(NORTIA_PROGRAM_KEY)) return null;
  const coder = new BorshAccountsCoder(idl as Idl);
  try {
    return buildLegacyMarket(value, coder.decode("Market", info.data) as MarketAccount);
  } catch {
    try {
      const account = coder.decode("HybridMarket", info.data) as HybridMarketAccount;
      return await buildHybridMarket(connection, coder, address, account, questionCandidate);
    } catch {
      return null;
    }
  }
}

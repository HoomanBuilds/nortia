import "server-only";
import { createHash } from "node:crypto";
import { BorshAccountsCoder, BorshEventCoder, type Idl } from "@anchor-lang/core";
import { AccountLayout } from "@solana/spl-token";
import { Connection, PublicKey, type AccountInfo } from "@solana/web3.js";
import { formatUsdc } from "nortia-client/economics";
import { lmsrYesProbability } from "nortia-client/lmsr";
import {
  hybridMetadataPda,
  hybridVaultPda,
  resolutionReceiptPda,
} from "nortia-client/market-engine";
import idl from "@/lib/solana/idl/nortia.json";
import { NORTIA_PROGRAM_KEY } from "@/lib/solana/constants";
import {
  markets,
  type HybridMarketDetails,
  type Market,
  type MarketActivity,
  type MarketCategory,
  type TradingState,
} from "@/lib/markets";

type IntegerLike = number | bigint | { toString(): string };
type EnumLike = Record<string, unknown>;

type MarketAccount = {
  market_id: IntegerLike;
  authority: PublicKey;
  fixture_id: IntegerLike;
  market_mode: EnumLike;
  fixture_start_ts: IntegerLike;
  total_goals_threshold: number;
  ticket_amount: IntegerLike;
  lock_ts: IntegerLike;
  phase: EnumLike;
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
  category: EnumLike;
  question_hash: number[];
  rules_hash: number[];
  outcome_labels_hash: number[];
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
  phase: EnumLike;
  outcome: number;
  trade_count: IntegerLike;
  volume: IntegerLike;
  settlement_evidence_hash: number[];
};

type OracleConfigAccount = {
  market: PublicKey;
  resolver: EnumLike;
  source_program: PublicKey;
  source_queue: PublicKey;
  source_id: number[];
  comparator: EnumLike;
  threshold: IntegerLike;
  threshold_exponent: number;
  observation_ts: IntegerLike;
  observation_window_secs: number;
  max_staleness_secs: number;
  max_staleness_slots: IntegerLike;
  max_confidence_bps: number;
  min_samples: number;
  challenge_period_secs: number;
  bond_amount: IntegerLike;
  consumed: boolean;
};

type HybridMetadataAccount = {
  market: PublicKey;
  creator: PublicKey;
  question: string;
  rules: string;
  yes_label: string;
  no_label: string;
  reference_url: string;
};

type ResolutionReceiptAccount = {
  market: PublicKey;
  outcome: number;
  observation_value: IntegerLike;
  observation_exponent: number;
  observation_ts: IntegerLike;
  observation_slot: IntegerLike;
  confidence: IntegerLike;
  sample_count: number;
  source_account: PublicKey;
  evidence_hash: number[];
  finalized_at: IntegerLike;
};

type PositionAccount = {
  market: PublicKey;
  owner: PublicKey;
};

type HybridSupportAccounts = {
  oracle: AccountInfo<Buffer> | null;
  metadata: AccountInfo<Buffer> | null;
  receipt: AccountInfo<Buffer> | null;
  vault: AccountInfo<Buffer> | null;
};

const ZERO_ADDRESS = PublicKey.default.toBase58();

function connection(): Connection {
  return new Connection(
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? "https://api.devnet.solana.com",
    "confirmed",
  );
}

function integer(value: IntegerLike): bigint {
  return BigInt(value.toString());
}

function safeNumber(value: IntegerLike, label: string): number {
  const parsed = Number(integer(value));
  if (!Number.isSafeInteger(parsed)) throw new Error(`${label} exceeds the safe integer range`);
  return parsed;
}

function tokenNumber(value: IntegerLike): number {
  return Number(integer(value)) / 1_000_000;
}

function dateFromSeconds(value: IntegerLike): string {
  return new Date(safeNumber(value, "timestamp") * 1_000).toISOString();
}

function bytesHex(value: number[]): string {
  return Buffer.from(value).toString("hex");
}

function enumKey(value: EnumLike): string {
  return (Object.keys(value)[0] ?? "").replaceAll("_", "").toLowerCase();
}

function privatePoolPhase(value: EnumLike): TradingState | null {
  const name = enumKey(value);
  return name === "open" || name === "batched" || name === "resolved" || name === "refunding" || name === "closed" ? name : null;
}

function hybridPhase(value: EnumLike): TradingState | null {
  const name = enumKey(value);
  return name === "open" || name === "locked" || name === "resolving" || name === "disputed" || name === "resolved" || name === "closed" ? name : null;
}

function categoryName(value: EnumLike): MarketCategory | null {
  const names: Readonly<Record<string, MarketCategory>> = {
    sports: "Sports",
    crypto: "Crypto",
    politics: "Politics",
    technology: "Technology",
    culture: "Culture",
    other: "Other",
    economics: "Economics",
    science: "Science",
  };
  return names[enumKey(value)] ?? null;
}

function resolverName(value: EnumLike): Pick<HybridMarketDetails, "resolverId"> & { label: string } | null {
  const names: Readonly<Record<string, Pick<HybridMarketDetails, "resolverId"> & { label: string }>> = {
    txlinestat: { resolverId: "txline-stat", label: "TxLINE" },
    pythprice: { resolverId: "pyth-price", label: "Pyth" },
    switchboardquote: { resolverId: "switchboard-quote", label: "Switchboard" },
    storkprice: { resolverId: "stork-price", label: "Stork" },
    optimistic: { resolverId: "optimistic", label: "Bonded" },
    umawormhole: { resolverId: "uma-wormhole", label: "UMA" },
    chainlinkreport: { resolverId: "chainlink-report", label: "Chainlink" },
  };
  return names[enumKey(value)] ?? null;
}

function comparatorName(value: EnumLike): HybridMarketDetails["oracle"]["comparator"] | null {
  const names = {
    greaterthan: "greater-than",
    greaterthanorequal: "greater-than-or-equal",
    lessthan: "less-than",
    lessthanorequal: "less-than-or-equal",
    equal: "equal",
  } as const;
  return names[enumKey(value) as keyof typeof names] ?? null;
}

function verifiedQuestion(candidate: string | undefined, hash: number[]): string | null {
  if (!candidate) return null;
  const actual = createHash("sha256").update(candidate, "utf8").digest();
  return actual.equals(Buffer.from(hash)) ? candidate : null;
}

function verifiedMetadata(
  account: HybridMetadataAccount,
  market: HybridMarketAccount,
  address: PublicKey,
): HybridMetadataAccount | null {
  if (!account.market.equals(address) || !account.creator.equals(market.creator)) return null;
  const questionHash = createHash("sha256").update(account.question, "utf8").digest();
  const rulesHash = createHash("sha256").update(account.rules, "utf8").digest();
  const labelsHash = createHash("sha256")
    .update(`${account.yes_label}\n${account.no_label}`, "utf8")
    .digest();
  return questionHash.equals(Buffer.from(market.question_hash))
    && rulesHash.equals(Buffer.from(market.rules_hash))
    && labelsHash.equals(Buffer.from(market.outcome_labels_hash))
    ? account
    : null;
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
    Economics: "ECO",
    Science: "SCI",
  };
  return codes[category];
}

function decodeAccount<T>(
  coder: BorshAccountsCoder,
  name: string,
  info: AccountInfo<Buffer> | null,
): T | null {
  if (!info?.owner.equals(NORTIA_PROGRAM_KEY)) return null;
  try {
    return coder.decode(name, info.data) as T;
  } catch {
    return null;
  }
}

function vaultBalance(info: AccountInfo<Buffer> | null): bigint {
  if (!info || info.data.length < AccountLayout.span) return 0n;
  try {
    return BigInt(AccountLayout.decode(info.data).amount.toString());
  } catch {
    return 0n;
  }
}

function buildPrivateMarket(value: string, account: MarketAccount): Market | null {
  const tradingState = privatePoolPhase(account.phase);
  if (!tradingState) return null;
  const fixtureId = safeNumber(account.fixture_id, "fixture ID");
  const template = markets.find((market) => market.fixtureId === fixtureId);
  const threshold = account.total_goals_threshold + 0.5;
  const resolved = tradingState === "resolved" || tradingState === "closed";
  const replay = enumKey(account.market_mode) === "replay";
  const home = template?.home ?? "Participant one";
  const away = template?.away ?? "Participant two";
  const lockAt = dateFromSeconds(account.lock_ts);
  const effectiveTradingState = tradingState === "open" && Date.now() >= Date.parse(lockAt)
    ? "locked"
    : tradingState;
  const grossPool = integer(account.gross_pool);
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
    kickoff: template?.kickoff ?? new Date(safeNumber(account.fixture_start_ts, "fixture start") * 1_000).toLocaleString("en-US", { timeZone: "UTC" }),
    lockAt,
    status: resolved ? "settled" : Date.now() < Date.parse(lockAt) ? "upcoming" : "live",
    tradingState: effectiveTradingState,
    score: resolved ? [account.score_a, account.score_b] : undefined,
    yes: resolved ? account.outcome * 100 : 50,
    volume: grossPool > 0n ? tokenNumber(grossPool) : account.order_count * tokenNumber(account.ticket_amount),
    liquidity: tokenNumber(account.net_pool),
    traders: account.order_count,
    replay,
    points: [50, 50],
  };
}

function buildHybridMarket(input: {
  coder: BorshAccountsCoder;
  address: PublicKey;
  account: HybridMarketAccount;
  support: HybridSupportAccounts;
  traderCount: number;
  questionCandidate?: string;
}): Market | null {
  const { coder, address, account, support, traderCount, questionCandidate } = input;
  const tradingState = hybridPhase(account.phase);
  const category = categoryName(account.category);
  const outcome = outcomeName(account.outcome);
  if (!tradingState || !category || !outcome) return null;
  const oracle = decodeAccount<OracleConfigAccount>(coder, "OracleConfig", support.oracle);
  if (!oracle?.market.equals(address)) return null;
  const resolver = resolverName(oracle.resolver);
  const comparator = comparatorName(oracle.comparator);
  if (!resolver || !comparator) return null;

  const decodedMetadata = decodeAccount<HybridMetadataAccount>(
    coder,
    "HybridMarketMetadata",
    support.metadata,
  );
  const metadata = decodedMetadata
    ? verifiedMetadata(decodedMetadata, account, address)
    : null;
  const decodedReceipt = decodeAccount<ResolutionReceiptAccount>(
    coder,
    "ResolutionReceipt",
    support.receipt,
  );
  const receipt = decodedReceipt?.market.equals(address) ? decodedReceipt : null;
  const receiptOutcome = receipt ? outcomeName(receipt.outcome) : null;

  const yesQuantity = integer(account.yes_quantity);
  const noQuantity = integer(account.no_quantity);
  const liquidityParameter = integer(account.liquidity_parameter);
  const probability = lmsrYesProbability(
    { yes: yesQuantity, no: noQuantity },
    liquidityParameter,
  );
  const questionHash = bytesHex(account.question_hash);
  const question = metadata?.question
    ?? verifiedQuestion(questionCandidate, account.question_hash)
    ?? `Verified market ${questionHash.slice(0, 8)}`;
  const yes = Math.round(Number(probability) / 10_000);
  const lockAt = dateFromSeconds(account.lock_ts);
  const effectiveTradingState = tradingState === "open" && Date.now() >= Date.parse(lockAt)
    ? "locked"
    : tradingState;
  const resolved = tradingState === "resolved" || tradingState === "closed";
  const details: HybridMarketDetails = {
    creator: account.creator.toBase58(),
    liquidityOwner: account.liquidity_owner.toBase58(),
    treasuryOwner: account.treasury_owner.toBase58(),
    collateralMint: account.collateral_mint.toBase58(),
    oracleConfig: account.oracle_config.toBase58(),
    resolverId: resolver.resolverId,
    metadataPublished: metadata !== null,
    rules: metadata?.rules ?? null,
    yesLabel: metadata?.yes_label ?? "YES",
    noLabel: metadata?.no_label ?? "NO",
    referenceUrl: metadata?.reference_url || null,
    questionHash,
    rulesHash: bytesHex(account.rules_hash),
    liquidityParameter: liquidityParameter.toString(),
    yesQuantity: yesQuantity.toString(),
    noQuantity: noQuantity.toString(),
    maxTradeShares: account.max_trade_shares.toString(),
    tradeFeeBps: account.trade_fee_bps,
    treasuryFeeShareBps: account.treasury_fee_share_bps,
    openAt: dateFromSeconds(account.open_ts),
    resolveNotBefore: dateFromSeconds(account.resolve_not_before_ts),
    resolutionDeadline: dateFromSeconds(account.resolution_deadline_ts),
    settlementEvidenceHash: bytesHex(account.settlement_evidence_hash),
    outcome,
    oracle: {
      sourceProgram: oracle.source_program.toBase58(),
      sourceQueue: oracle.source_queue.toBase58(),
      sourceId: bytesHex(oracle.source_id),
      comparator,
      threshold: oracle.threshold.toString(),
      thresholdExponent: oracle.threshold_exponent,
      observationAt: dateFromSeconds(oracle.observation_ts),
      observationWindowSecs: oracle.observation_window_secs,
      maxStalenessSecs: oracle.max_staleness_secs,
      maxStalenessSlots: oracle.max_staleness_slots.toString(),
      maxConfidenceBps: oracle.max_confidence_bps,
      minSamples: oracle.min_samples,
      challengePeriodSecs: oracle.challenge_period_secs,
      bondAmount: oracle.bond_amount.toString(),
      consumed: oracle.consumed,
    },
    receipt: receipt && receiptOutcome && receiptOutcome !== "unset" ? {
      outcome: receiptOutcome,
      observationValue: receipt.observation_value.toString(),
      observationExponent: receipt.observation_exponent,
      observationAt: dateFromSeconds(receipt.observation_ts),
      observationSlot: receipt.observation_slot.toString(),
      confidence: receipt.confidence.toString(),
      sampleCount: receipt.sample_count,
      sourceAccount: receipt.source_account.toBase58(),
      evidenceHash: bytesHex(receipt.evidence_hash),
      finalizedAt: dateFromSeconds(receipt.finalized_at),
    } : null,
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
    kickoff: `Resolves ${new Date(details.resolveNotBefore).toLocaleString("en-US", { timeZone: "UTC", timeZoneName: "short" })}`,
    lockAt,
    status: resolved ? "settled" : Date.now() < Date.parse(details.openAt) ? "upcoming" : "live",
    tradingState: effectiveTradingState,
    yes,
    volume: tokenNumber(account.volume),
    liquidity: tokenNumber(vaultBalance(support.vault)),
    traders: traderCount,
    replay: false,
    points: yes === 50 ? [50, 50] : [50, yes],
    hybrid: details,
  };
}

async function getAccountMap(
  rpc: Connection,
  addresses: PublicKey[],
): Promise<Map<string, AccountInfo<Buffer> | null>> {
  const unique = [...new Map(addresses.map((address) => [address.toBase58(), address])).values()];
  const result = new Map<string, AccountInfo<Buffer> | null>();
  for (let offset = 0; offset < unique.length; offset += 100) {
    const batch = unique.slice(offset, offset + 100);
    const infos = await rpc.getMultipleAccountsInfo(batch, "confirmed");
    batch.forEach((address, index) => result.set(address.toBase58(), infos[index] ?? null));
  }
  return result;
}

function supportFromMap(
  accountMap: Map<string, AccountInfo<Buffer> | null>,
  address: PublicKey,
  oracle: PublicKey,
): HybridSupportAccounts {
  return {
    oracle: accountMap.get(oracle.toBase58()) ?? null,
    metadata: accountMap.get(hybridMetadataPda(address).toBase58()) ?? null,
    receipt: accountMap.get(resolutionReceiptPda(address).toBase58()) ?? null,
    vault: accountMap.get(hybridVaultPda(address).toBase58()) ?? null,
  };
}

export async function getOnchainMarkets(): Promise<Market[]> {
  const rpc = connection();
  const coder = new BorshAccountsCoder(idl as Idl);
  const programRows = await rpc.getProgramAccounts(NORTIA_PROGRAM_KEY, {
    commitment: "confirmed",
  });
  const decodedPrivate = programRows.flatMap(({ pubkey, account }) => {
    try {
      return [{ address: pubkey, account: coder.decode("Market", account.data) as MarketAccount }];
    } catch {
      return [];
    }
  });
  const decodedHybrid = programRows.flatMap(({ pubkey, account }) => {
    try {
      return [{ address: pubkey, account: coder.decode("HybridMarket", account.data) as HybridMarketAccount }];
    } catch {
      return [];
    }
  });
  const decodedPositions = programRows.flatMap(({ account }) => {
    try {
      return [coder.decode("Position", account.data) as PositionAccount];
    } catch {
      return [];
    }
  });
  const accountMap = new Map<string, AccountInfo<Buffer> | null>(
    programRows.map(({ pubkey, account }) => [pubkey.toBase58(), account]),
  );
  const vaults = decodedHybrid.map(({ address }) => hybridVaultPda(address));
  const vaultMap = await getAccountMap(rpc, vaults);
  for (const [address, account] of vaultMap) accountMap.set(address, account);
  const traderCounts = new Map<string, Set<string>>();
  for (const position of decodedPositions) {
    const key = position.market.toBase58();
    const owners = traderCounts.get(key) ?? new Set<string>();
    owners.add(position.owner.toBase58());
    traderCounts.set(key, owners);
  }

  const publicMarkets = decodedHybrid.flatMap(({ address, account }) => {
    const market = buildHybridMarket({
      coder,
      address,
      account,
      support: supportFromMap(accountMap, address, account.oracle_config),
      traderCount: traderCounts.get(address.toBase58())?.size ?? 0,
    });
    return market ? [market] : [];
  });
  const privateMarkets = decodedPrivate.flatMap(({ address, account }) => {
    const market = buildPrivateMarket(address.toBase58(), account);
    return market ? [market] : [];
  });
  const phaseRank: Readonly<Record<TradingState, number>> = {
    open: 0,
    locked: 1,
    resolving: 2,
    disputed: 3,
    batched: 4,
    refunding: 5,
    resolved: 6,
    closed: 7,
  };
  return [...publicMarkets, ...privateMarkets].sort((left, right) =>
    phaseRank[left.tradingState] - phaseRank[right.tradingState]
      || right.volume - left.volume,
  );
}

async function getHybridSupport(
  rpc: Connection,
  address: PublicKey,
  oracle: PublicKey,
): Promise<HybridSupportAccounts> {
  const addresses = [
    oracle,
    hybridMetadataPda(address),
    resolutionReceiptPda(address),
    hybridVaultPda(address),
  ];
  const infos = await rpc.getMultipleAccountsInfo(addresses, "confirmed");
  return {
    oracle: infos[0] ?? null,
    metadata: infos[1] ?? null,
    receipt: infos[2] ?? null,
    vault: infos[3] ?? null,
  };
}

async function hybridTraderCount(
  rpc: Connection,
  coder: BorshAccountsCoder,
  address: PublicKey,
): Promise<number> {
  const accounts = await rpc.getProgramAccounts(NORTIA_PROGRAM_KEY, {
    commitment: "confirmed",
    dataSlice: { offset: 0, length: 0 },
    filters: [
      { memcmp: coder.memcmp("Position") },
      { memcmp: { offset: 10, bytes: address.toBase58() } },
    ],
  });
  return accounts.length;
}

export async function getOnchainMarket(value: string, questionCandidate?: string): Promise<Market | null> {
  let address: PublicKey;
  try {
    address = new PublicKey(value);
  } catch {
    return null;
  }
  const rpc = connection();
  const info = await rpc.getAccountInfo(address, "confirmed");
  if (!info?.owner.equals(NORTIA_PROGRAM_KEY)) return null;
  const coder = new BorshAccountsCoder(idl as Idl);
  try {
    return buildPrivateMarket(value, coder.decode("Market", info.data) as MarketAccount);
  } catch {
    try {
      const account = coder.decode("HybridMarket", info.data) as HybridMarketAccount;
      const [support, traderCount] = await Promise.all([
        getHybridSupport(rpc, address, account.oracle_config),
        hybridTraderCount(rpc, coder, address),
      ]);
      return buildHybridMarket({
        coder,
        address,
        account,
        support,
        traderCount,
        questionCandidate,
      });
    } catch {
      return null;
    }
  }
}

function eventField(data: Record<string, unknown>, name: string): unknown {
  const camel = name.replace(/_([a-z])/g, (_, character: string) => character.toUpperCase());
  return data[name] ?? data[camel];
}

function eventInteger(data: Record<string, unknown>, name: string): bigint {
  const value = eventField(data, name);
  if (typeof value !== "number" && typeof value !== "bigint" && (typeof value !== "object" || value === null || !("toString" in value))) {
    throw new Error(`Missing integer event field ${name}`);
  }
  return BigInt(value.toString());
}

function eventAddress(data: Record<string, unknown>, name: string): string | null {
  const value = eventField(data, name);
  return value && typeof value === "object" && "toBase58" in value
    ? (value as { toBase58(): string }).toBase58()
    : null;
}

function eventMatchesMarket(data: Record<string, unknown>, market: PublicKey): boolean {
  return eventAddress(data, "market") === market.toBase58();
}

function outcomeLabel(value: bigint): string {
  return value === 1n ? "YES" : value === 0n ? "NO" : "INVALID";
}

function activityFromEvent(input: {
  name: string;
  data: Record<string, unknown>;
  signature: string;
  slot: number;
  timestamp: number | null;
}): MarketActivity | null {
  const { name, data, signature, slot, timestamp } = input;
  const base = { signature, slot, timestamp, account: null, yesProbability: null };
  if (name === "HybridTradeExecuted") {
    const direction = eventInteger(data, "direction") === 0n ? "Bought" : "Sold";
    const side = eventInteger(data, "side") === 1n ? "YES" : "NO";
    const shares = eventInteger(data, "shares");
    const total = eventInteger(data, "total_amount");
    const fee = eventInteger(data, "fee_amount");
    return {
      ...base,
      kind: "trade",
      title: `${direction} ${side}`,
      detail: `${formatUsdc(shares)} shares for ${formatUsdc(total)} USDC, ${formatUsdc(fee)} fee`,
      account: eventAddress(data, "owner"),
      yesProbability: Number(eventInteger(data, "after_yes_probability")) / 10_000,
    };
  }
  if (name === "HybridMarketCreated") {
    return {
      ...base,
      kind: "lifecycle",
      title: "Market opened",
      detail: `${formatUsdc(eventInteger(data, "initial_subsidy"))} USDC maker subsidy funded`,
      account: eventAddress(data, "creator"),
      yesProbability: 50,
    };
  }
  if (name === "HybridMarketLocked") {
    return { ...base, kind: "lifecycle", title: "Trading locked", detail: "No further trades can execute", yesProbability: null };
  }
  if (name === "OptimisticResolutionProposed") {
    return {
      ...base,
      kind: "resolution",
      title: `${outcomeLabel(eventInteger(data, "outcome"))} proposed`,
      detail: `${formatUsdc(eventInteger(data, "bond_amount"))} USDC assertion bond`,
      account: eventAddress(data, "proposer"),
    };
  }
  if (name === "OptimisticResolutionChallenged") {
    return {
      ...base,
      kind: "resolution",
      title: "Resolution challenged",
      detail: `${outcomeLabel(eventInteger(data, "outcome"))} submitted with a matching bond`,
      account: eventAddress(data, "challenger"),
    };
  }
  if (name === "HybridMarketResolved") {
    return {
      ...base,
      kind: "resolution",
      title: `${outcomeLabel(eventInteger(data, "outcome"))} finalized`,
      detail: `${formatUsdc(eventInteger(data, "outstanding_liability"))} USDC claim liability recorded`,
    };
  }
  if (name === "HybridPositionSettled") {
    return {
      ...base,
      kind: "settlement",
      title: "Position claimed",
      detail: `${formatUsdc(eventInteger(data, "amount"))} USDC paid`,
      account: eventAddress(data, "owner"),
    };
  }
  if (name === "HybridLiquidityWithdrawn") {
    return {
      ...base,
      kind: "liquidity",
      title: "Maker surplus withdrawn",
      detail: `${formatUsdc(eventInteger(data, "amount"))} USDC withdrawn above liability`,
      account: eventAddress(data, "liquidity_owner"),
    };
  }
  if (name === "HybridMarketClosed") {
    return { ...base, kind: "lifecycle", title: "Market closed", detail: "Vault and trader liabilities are fully drained" };
  }
  return null;
}

export async function getOnchainMarketActivity(
  value: string,
  limit = 100,
): Promise<MarketActivity[]> {
  let market: PublicKey;
  try {
    market = new PublicKey(value);
  } catch {
    return [];
  }
  const rpc = connection();
  const signatures = await rpc.getSignaturesForAddress(
    market,
    { limit: Math.min(Math.max(limit, 1), 200) },
    "confirmed",
  );
  if (signatures.length === 0) return [];
  const transactions = await rpc.getTransactions(
    signatures.map(({ signature }) => signature),
    { commitment: "confirmed", maxSupportedTransactionVersion: 0 },
  );
  const eventCoder = new BorshEventCoder(idl as Idl);
  const activity: MarketActivity[] = [];
  transactions.forEach((transaction, index) => {
    if (!transaction?.meta || transaction.meta.err) return;
    const signature = signatures[index];
    if (!signature) return;
    for (const log of transaction.meta.logMessages ?? []) {
      const prefix = log.startsWith("Program data: ")
        ? "Program data: "
        : log.startsWith("Program log: ")
          ? "Program log: "
          : null;
      if (!prefix) continue;
      const decoded = eventCoder.decode(log.slice(prefix.length));
      if (!decoded || !eventMatchesMarket(decoded.data as Record<string, unknown>, market)) continue;
      try {
        const item = activityFromEvent({
          name: decoded.name,
          data: decoded.data as Record<string, unknown>,
          signature: signature.signature,
          slot: signature.slot,
          timestamp: transaction.blockTime ?? signature.blockTime ?? null,
        });
        if (item) activity.push(item);
      } catch {
        continue;
      }
    }
  });
  return activity.sort((left, right) =>
    (right.timestamp ?? 0) - (left.timestamp ?? 0) || right.slot - left.slot,
  );
}

export function withMarketActivity(market: Market, activity: MarketActivity[]): Market {
  const history = activity
    .filter((item): item is MarketActivity & { yesProbability: number } => item.yesProbability !== null)
    .sort((left, right) => (left.timestamp ?? left.slot) - (right.timestamp ?? right.slot))
    .map((item) => item.yesProbability);
  return {
    ...market,
    activity,
    points: history.length === 0 ? market.points : history,
  };
}

export function isDefaultAddress(value: string): boolean {
  return value === ZERO_ADDRESS;
}

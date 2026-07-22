import { PublicKey } from "@solana/web3.js";
import { TREE_DEPTH } from "nortia-client/commitments";
import { calculatePrivatePayout } from "nortia-client/economics";

const SCALAR_MODULUS = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;

export type PlaceRequest = {
  marketId: string;
  stakeAmount: string;
  amount: string;
  payer: string;
  side: boolean;
  secret: string;
  nullifier: string;
  sideCoefficient: string;
  yesAmountCoefficient: string;
  totalAmountCoefficient: string;
  salts: [string, string, string];
};

export type RedeemRequest = {
  marketId: string;
  stakeAmount: string;
  amount: string;
  commitmentRoot: string;
  outcome: boolean;
  recipient: string;
  payoutAmount: string;
  netPool: string;
  winningAmount: string;
  side: boolean;
  secret: string;
  nullifier: string;
  pathBits: boolean[];
  siblings: string[];
};

export function field(value: unknown, name: string) {
  if (typeof value !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(value)) throw new Error(`${name} must be a 32-byte field`);
  const parsed = BigInt(value);
  if (parsed >= SCALAR_MODULUS) throw new Error(`${name} exceeds the BN254 scalar field`);
  return parsed;
}

function decimalU64(value: unknown, name: string) {
  if (typeof value !== "string" || !/^\d+$/.test(value)) throw new Error(`${name} must be a decimal integer`);
  const parsed = BigInt(value);
  if (parsed > 18_446_744_073_709_551_615n) throw new Error(`${name} is outside the u64 range`);
  return parsed;
}

function privateStake(value: unknown) {
  const parsed = decimalU64(value, "stakeAmount");
  if (![1n, 5n, 10n, 25n, 50n, 100n, 250n, 500n, 1_000n].some((tokens) => tokens * 1_000_000n === parsed)) {
    throw new Error("stakeAmount is not a supported private collateral ceiling");
  }
  return parsed;
}

export function checkedPlace(value: unknown): PlaceRequest {
  if (!value || typeof value !== "object") throw new Error("Invalid proof request");
  const input = value as Partial<PlaceRequest>;
  if (typeof input.marketId !== "string" || !/^\d+$/.test(input.marketId)) throw new Error("marketId must be a decimal integer");
  const stakeAmount = privateStake(input.stakeAmount);
  const amount = decimalU64(input.amount, "amount");
  if (amount < 1_000_000n || amount > stakeAmount) throw new Error("amount must be between 1 USDC and stakeAmount");
  if (typeof input.payer !== "string") throw new Error("payer is required");
  if (typeof input.side !== "boolean") throw new Error("side must be boolean");
  if (!Array.isArray(input.salts) || input.salts.length !== 3) throw new Error("salts must contain three fields");
  const marketId = BigInt(input.marketId);
  if (marketId <= 0n || marketId > 18_446_744_073_709_551_615n) throw new Error("marketId is outside the u64 range");
  new PublicKey(input.payer);
  for (const [name, item] of [
    ["secret", input.secret],
    ["nullifier", input.nullifier],
    ["sideCoefficient", input.sideCoefficient],
    ["yesAmountCoefficient", input.yesAmountCoefficient],
    ["totalAmountCoefficient", input.totalAmountCoefficient],
    ["salts[0]", input.salts[0]],
    ["salts[1]", input.salts[1]],
    ["salts[2]", input.salts[2]],
  ] as const) {
    if (field(item, name) === 0n) throw new Error(`${name} must be non-zero`);
  }
  return input as PlaceRequest;
}

export function checkedRedeem(value: unknown): RedeemRequest {
  if (!value || typeof value !== "object") throw new Error("Invalid redeem proof request");
  const input = value as Partial<RedeemRequest>;
  if (typeof input.marketId !== "string" || !/^\d+$/.test(input.marketId)) throw new Error("marketId must be a decimal integer");
  const stakeAmount = privateStake(input.stakeAmount);
  const amount = decimalU64(input.amount, "amount");
  const payoutAmount = decimalU64(input.payoutAmount, "payoutAmount");
  const netPool = decimalU64(input.netPool, "netPool");
  const winningAmount = decimalU64(input.winningAmount, "winningAmount");
  if (amount < 1_000_000n || amount > stakeAmount) throw new Error("amount must be between 1 USDC and stakeAmount");
  if (winningAmount === 0n) throw new Error("winningAmount must be positive");
  if (typeof input.recipient !== "string") throw new Error("recipient is required");
  if (typeof input.outcome !== "boolean" || typeof input.side !== "boolean") throw new Error("outcome and side must be boolean");
  const expectedPayout = calculatePrivatePayout(stakeAmount, amount, input.side === input.outcome, netPool, winningAmount).payoutAmount;
  if (payoutAmount !== expectedPayout) throw new Error("payoutAmount does not match the confidential position settlement");
  if (!Array.isArray(input.pathBits) || input.pathBits.length !== TREE_DEPTH || !input.pathBits.every((item) => typeof item === "boolean")) throw new Error(`pathBits must contain ${TREE_DEPTH} booleans`);
  if (!Array.isArray(input.siblings) || input.siblings.length !== TREE_DEPTH) throw new Error(`siblings must contain ${TREE_DEPTH} fields`);
  const marketId = BigInt(input.marketId);
  if (marketId <= 0n || marketId > 18_446_744_073_709_551_615n) throw new Error("marketId is outside the u64 range");
  const recipient = new PublicKey(input.recipient);
  if (!PublicKey.isOnCurve(recipient.toBytes())) throw new Error("recipient must be a wallet address");
  field(input.commitmentRoot, "commitmentRoot");
  if (field(input.secret, "secret") === 0n) throw new Error("secret must be non-zero");
  if (field(input.nullifier, "nullifier") === 0n) throw new Error("nullifier must be non-zero");
  input.siblings.forEach((item, index) => field(item, `siblings[${index}]`));
  return input as RedeemRequest;
}

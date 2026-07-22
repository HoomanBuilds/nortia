import { PublicKey } from "@solana/web3.js";
import { TREE_DEPTH } from "nortia-client/commitments";

const SCALAR_MODULUS = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;

export type PlaceRequest = {
  marketId: string;
  ticketAmount: string;
  payer: string;
  side: boolean;
  secret: string;
  nullifier: string;
  coefficient: string;
  salts: [string, string, string];
};

export type RedeemRequest = {
  marketId: string;
  ticketAmount: string;
  commitmentRoot: string;
  outcome: boolean;
  recipient: string;
  payoutAmount: string;
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

export function checkedPlace(value: unknown): PlaceRequest {
  if (!value || typeof value !== "object") throw new Error("Invalid proof request");
  const input = value as Partial<PlaceRequest>;
  if (typeof input.marketId !== "string" || !/^\d+$/.test(input.marketId)) throw new Error("marketId must be a decimal integer");
  if (input.ticketAmount !== "1000000") throw new Error("Only the fixed 1 USDC ticket is supported");
  if (typeof input.payer !== "string") throw new Error("payer is required");
  if (typeof input.side !== "boolean") throw new Error("side must be boolean");
  if (!Array.isArray(input.salts) || input.salts.length !== 3) throw new Error("salts must contain three fields");
  const marketId = BigInt(input.marketId);
  if (marketId <= 0n || marketId > 18_446_744_073_709_551_615n) throw new Error("marketId is outside the u64 range");
  new PublicKey(input.payer);
  for (const [name, item] of [
    ["secret", input.secret],
    ["nullifier", input.nullifier],
    ["coefficient", input.coefficient],
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
  if (input.ticketAmount !== "1000000") throw new Error("Only the fixed 1 USDC ticket is supported");
  if (typeof input.payoutAmount !== "string" || !/^\d+$/.test(input.payoutAmount) || BigInt(input.payoutAmount) <= 0n) throw new Error("payoutAmount must be positive");
  if (typeof input.recipient !== "string") throw new Error("recipient is required");
  if (typeof input.outcome !== "boolean" || typeof input.side !== "boolean") throw new Error("outcome and side must be boolean");
  if (input.side !== input.outcome) throw new Error("A losing position cannot generate a redeem proof");
  if (!Array.isArray(input.pathBits) || input.pathBits.length !== TREE_DEPTH || !input.pathBits.every((item) => typeof item === "boolean")) throw new Error(`pathBits must contain ${TREE_DEPTH} booleans`);
  if (!Array.isArray(input.siblings) || input.siblings.length !== TREE_DEPTH) throw new Error(`siblings must contain ${TREE_DEPTH} fields`);
  const marketId = BigInt(input.marketId);
  if (marketId <= 0n || marketId > 18_446_744_073_709_551_615n) throw new Error("marketId is outside the u64 range");
  new PublicKey(input.recipient);
  field(input.commitmentRoot, "commitmentRoot");
  field(input.secret, "secret");
  field(input.nullifier, "nullifier");
  input.siblings.forEach((item, index) => field(item, `siblings[${index}]`));
  return input as RedeemRequest;
}

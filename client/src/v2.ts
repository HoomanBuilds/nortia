import { PublicKey } from "@solana/web3.js";

export const NORTIA_PROGRAM_ID = new PublicKey("4S2EvdGrbKJ9zazvB4gtR83crTrVJWqqwoVVvEQy8VE9");

const U64_MAX = (1n << 64n) - 1n;

export function u64Le(value: bigint): Buffer {
  if (value < 0n || value > U64_MAX) {
    throw new Error("value must fit an unsigned 64-bit integer");
  }
  const bytes = Buffer.alloc(8);
  bytes.writeBigUInt64LE(value);
  return bytes;
}

function pda(seeds: readonly Buffer[], programId: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync([...seeds], programId)[0];
}

export function enginePda(programId = NORTIA_PROGRAM_ID): PublicKey {
  return pda([Buffer.from("engine-v2")], programId);
}

export function hybridMarketPda(
  creator: PublicKey,
  marketId: bigint,
  programId = NORTIA_PROGRAM_ID,
): PublicKey {
  return pda([Buffer.from("hybrid-market-v2"), creator.toBuffer(), u64Le(marketId)], programId);
}

export function hybridVaultPda(market: PublicKey, programId = NORTIA_PROGRAM_ID): PublicKey {
  return pda([Buffer.from("hybrid-vault-v2"), market.toBuffer()], programId);
}

export function oracleConfigPda(market: PublicKey, programId = NORTIA_PROGRAM_ID): PublicKey {
  return pda([Buffer.from("oracle-config-v2"), market.toBuffer()], programId);
}

export function positionPda(
  market: PublicKey,
  owner: PublicKey,
  programId = NORTIA_PROGRAM_ID,
): PublicKey {
  return pda([Buffer.from("position-v2"), market.toBuffer(), owner.toBuffer()], programId);
}

export function resolutionReceiptPda(
  market: PublicKey,
  programId = NORTIA_PROGRAM_ID,
): PublicKey {
  return pda([Buffer.from("resolution-receipt-v2"), market.toBuffer()], programId);
}

export function optimisticProposalPda(
  market: PublicKey,
  programId = NORTIA_PROGRAM_ID,
): PublicKey {
  return pda([Buffer.from("optimistic-proposal-v2"), market.toBuffer()], programId);
}

export function optimisticBondVaultPda(
  market: PublicKey,
  programId = NORTIA_PROGRAM_ID,
): PublicKey {
  return pda([Buffer.from("optimistic-bond-vault-v2"), market.toBuffer()], programId);
}

export function normalizeFeedId(feedId: string): string {
  const normalized = feedId.toLowerCase().replace(/^0x/, "");
  if (!/^[0-9a-f]{64}$/.test(normalized)) {
    throw new Error("Pyth feed ID must be an exact 32-byte hexadecimal value");
  }
  return normalized;
}

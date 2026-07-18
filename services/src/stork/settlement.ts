import { PublicKey, SystemProgram, type Keypair } from "@solana/web3.js";
import { STORK_ORACLE_PROGRAM_ADDRESS } from "nortia-client/oracles";
import {
  hybridVaultPda,
  oracleConfigPda,
  resolutionReceiptPda,
} from "nortia-client/v2";
import type { createProgram } from "../solana.js";

const STORK_ORACLE_PROGRAM = new PublicKey(STORK_ORACLE_PROGRAM_ADDRESS);

export function storkFeedAccount(feedId: number[]): PublicKey {
  const sourceId = Buffer.from(feedId);
  if (sourceId.length !== 32) throw new Error("Stork feed ID must contain exactly 32 bytes");
  return PublicKey.findProgramAddressSync(
    [Buffer.from("stork_feed"), sourceId],
    STORK_ORACLE_PROGRAM,
  )[0];
}

export async function resolveStorkHybridMarket(input: {
  keypair: Keypair;
  market: PublicKey;
  oracle: { sourceId: number[]; sourceProgram: PublicKey };
  program: ReturnType<typeof createProgram>;
}): Promise<string> {
  if (!input.oracle.sourceProgram.equals(STORK_ORACLE_PROGRAM)) {
    throw new Error("Stork market uses an unsupported oracle program");
  }
  return input.program.methods
    .resolveHybridWithStork()
    .accountsPartial({
      keeper: input.keypair.publicKey,
      market: input.market,
      oracleConfig: oracleConfigPda(input.market),
      receipt: resolutionReceiptPda(input.market),
      vault: hybridVaultPda(input.market),
      feedAccount: storkFeedAccount(input.oracle.sourceId),
      systemProgram: SystemProgram.programId,
    })
    .rpc();
}

import { Wallet as CoralWallet } from "@coral-xyz/anchor";
import receiverSdk from "@pythnetwork/pyth-solana-receiver";
import {
  PublicKey,
  SystemProgram,
  type Connection,
  type Keypair,
} from "@solana/web3.js";
import {
  PYTH_PUSH_ORACLE_PROGRAM_ADDRESS,
  PYTH_RECEIVER_PROGRAM_ADDRESS,
} from "nortia-client/oracles";
import {
  hybridVaultPda,
  normalizeFeedId,
  oracleConfigPda,
  resolutionReceiptPda,
} from "nortia-client/market-engine";
import type { createProgram } from "../solana.js";
import type { PythClient } from "./client.js";

type NortiaProgram = ReturnType<typeof createProgram>;

type PythOracleAccount = {
  sourceId: number[];
  sourceProgram: PublicKey;
  observationTs: { toNumber(): number };
  maxStalenessSecs: number;
};

const PYTH_RECEIVER_PROGRAM = new PublicKey(PYTH_RECEIVER_PROGRAM_ADDRESS);
const PYTH_PUSH_ORACLE_PROGRAM = new PublicKey(PYTH_PUSH_ORACLE_PROGRAM_ADDRESS);

export function pythPushFeedAccount(feedId: string): PublicKey {
  return receiverSdk.getPriceFeedAccountForProgram(
    0,
    normalizeFeedId(feedId),
    PYTH_PUSH_ORACLE_PROGRAM,
  );
}

export async function resolvePythHybridMarket(input: {
  connection: Connection;
  keypair: Keypair;
  market: PublicKey;
  oracle: PythOracleAccount;
  program: NortiaProgram;
  pyth: PythClient;
  computeUnitPriceMicroLamports: number;
}): Promise<string[]> {
  const feedId = normalizeFeedId(Buffer.from(input.oracle.sourceId).toString("hex"));
  if (input.oracle.sourceProgram.equals(PYTH_PUSH_ORACLE_PROGRAM)) {
    const signature = await input.program.methods
      .resolveHybridWithPyth()
      .accountsPartial({
        keeper: input.keypair.publicKey,
        market: input.market,
        oracleConfig: oracleConfigPda(input.market),
        receipt: resolutionReceiptPda(input.market),
        priceUpdate: pythPushFeedAccount(feedId),
        vault: hybridVaultPda(input.market),
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    return [signature];
  }
  if (!input.oracle.sourceProgram.equals(PYTH_RECEIVER_PROGRAM)) {
    throw new Error("Pyth market uses an unsupported source program");
  }
  const update = await input.pyth.settlementUpdate(
    feedId,
    input.oracle.observationTs.toNumber(),
    input.oracle.maxStalenessSecs,
  );
  const receiver = new receiverSdk.PythSolanaReceiver({
    connection: input.connection,
    wallet: new CoralWallet(input.keypair),
  });
  const builder = receiver.newTransactionBuilder({ closeUpdateAccounts: true });
  await builder.addPostPriceUpdates(update.data);
  await builder.addPriceConsumerInstructions(async (getPriceUpdateAccount) => [
    {
      instruction: await input.program.methods
        .resolveHybridWithPyth()
        .accountsPartial({
          keeper: input.keypair.publicKey,
          market: input.market,
          oracleConfig: oracleConfigPda(input.market),
          receipt: resolutionReceiptPda(input.market),
          priceUpdate: getPriceUpdateAccount(`0x${feedId}`),
          vault: hybridVaultPda(input.market),
          systemProgram: SystemProgram.programId,
        })
        .instruction(),
      signers: [],
    },
  ]);
  return receiver.provider.sendAll(
    await builder.buildVersionedTransactions({
      computeUnitPriceMicroLamports: input.computeUnitPriceMicroLamports,
      tightComputeBudget: true,
    }),
    { skipPreflight: false },
  );
}

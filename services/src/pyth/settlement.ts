import { Wallet as CoralWallet } from "@coral-xyz/anchor";
import receiverSdk from "@pythnetwork/pyth-solana-receiver";
import {
  PublicKey,
  SystemProgram,
  type Connection,
  type Keypair,
} from "@solana/web3.js";
import {
  hybridVaultPda,
  normalizeFeedId,
  oracleConfigPda,
  resolutionReceiptPda,
} from "nortia-client/v2";
import type { createProgram } from "../solana.js";
import type { PythClient } from "./client.js";

type NortiaProgram = ReturnType<typeof createProgram>;

type PythOracleAccount = {
  sourceId: number[];
  observationTs: { toNumber(): number };
  maxStalenessSecs: number;
};

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

import { CrossbarClient } from "@switchboard-xyz/common";
import {
  OracleQuote,
  asV0Tx,
  getDefaultDevnetQueue,
} from "@switchboard-xyz/on-demand";
import { PublicKey, SystemProgram, type Connection, type Keypair } from "@solana/web3.js";
import {
  SWITCHBOARD_QUOTE_PROGRAM_ADDRESS,
} from "nortia-client/oracles";
import {
  hybridVaultPda,
  oracleConfigPda,
  resolutionReceiptPda,
} from "nortia-client/v2";
import type { createProgram } from "../solana.js";

const SWITCHBOARD_QUOTE_PROGRAM = new PublicKey(SWITCHBOARD_QUOTE_PROGRAM_ADDRESS);

type NortiaProgram = ReturnType<typeof createProgram>;

export function normalizeSwitchboardFeedHash(value: string): string {
  const normalized = value.trim().toLowerCase().replace(/^0x/, "");
  if (!/^[0-9a-f]{64}$/.test(normalized)) {
    throw new Error("Switchboard feed hash must be an exact 32-byte hexadecimal value");
  }
  return normalized;
}

export function switchboardQuoteAccount(queue: PublicKey, feedHash: string): PublicKey {
  const normalized = normalizeSwitchboardFeedHash(feedHash);
  const sourceId = Buffer.from(normalized, "hex");
  const local = PublicKey.findProgramAddressSync(
    [queue.toBuffer(), sourceId],
    SWITCHBOARD_QUOTE_PROGRAM,
  )[0];
  const sdk = OracleQuote.getCanonicalPubkey(queue, [sourceId], SWITCHBOARD_QUOTE_PROGRAM)[0];
  if (!local.equals(sdk)) throw new Error("Switchboard canonical quote derivation mismatch");
  return local;
}

export async function validateStoredSwitchboardFeed(
  crossbar: Pick<CrossbarClient, "fetchOracleFeed">,
  feedHash: string,
) {
  const normalized = normalizeSwitchboardFeedHash(feedHash);
  const feed = await crossbar.fetchOracleFeed(normalized);
  if (!feed.cid || !feed.data || !Number.isSafeInteger(feed.size) || feed.size <= 0 || !feed.version) {
    throw new Error("Switchboard stored feed definition is incomplete");
  }
  return { feedHash: normalized, cid: feed.cid, size: feed.size, version: feed.version };
}

export async function resolveSwitchboardHybridMarket(input: {
  connection: Connection;
  keypair: Keypair;
  market: PublicKey;
  oracle: {
    sourceId: number[];
    sourceProgram: PublicKey;
    sourceQueue: PublicKey;
    minSamples: number;
  };
  program: NortiaProgram;
  crossbarOrigin: string;
  computeUnitPriceMicroLamports: number;
}): Promise<string> {
  if (!input.oracle.sourceProgram.equals(SWITCHBOARD_QUOTE_PROGRAM)) {
    throw new Error("Switchboard market uses an unsupported quote program");
  }
  if (input.oracle.minSamples < 2 || input.oracle.minSamples > 8) {
    throw new Error("Switchboard market requires two through eight oracle samples");
  }
  const feedHash = normalizeSwitchboardFeedHash(Buffer.from(input.oracle.sourceId).toString("hex"));
  const crossbar = new CrossbarClient(input.crossbarOrigin);
  await validateStoredSwitchboardFeed(crossbar, feedHash);
  const queue = await getDefaultDevnetQueue(input.connection.rpcEndpoint);
  if (!queue.pubkey.equals(input.oracle.sourceQueue)) {
    throw new Error("Switchboard default devnet queue does not match the market");
  }
  const quoteAccount = switchboardQuoteAccount(queue.pubkey, feedHash);
  const updateInstructions = await queue.fetchManagedUpdateIxs(crossbar, [feedHash], {
    payer: input.keypair.publicKey,
    numSignatures: input.oracle.minSamples,
  });
  if (updateInstructions.length === 0) {
    throw new Error("Switchboard did not return managed update instructions");
  }
  const resolutionInstruction = await input.program.methods
    .resolveHybridWithSwitchboard()
    .accountsPartial({
      keeper: input.keypair.publicKey,
      market: input.market,
      oracleConfig: oracleConfigPda(input.market),
      receipt: resolutionReceiptPda(input.market),
      vault: hybridVaultPda(input.market),
      quoteAccount,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
  const transaction = await asV0Tx({
    connection: input.connection,
    ixs: [...updateInstructions, resolutionInstruction],
    payer: input.keypair.publicKey,
    signers: [input.keypair],
    computeUnitPrice: input.computeUnitPriceMicroLamports,
    computeUnitLimitMultiple: 1.2,
  });
  const signature = await input.connection.sendTransaction(transaction, { skipPreflight: false });
  const confirmation = await input.connection.confirmTransaction(signature, "confirmed");
  if (confirmation.value.err) throw new Error("Switchboard resolution transaction failed");
  return signature;
}

import { setTimeout as delay } from "node:timers/promises";
import BN from "bn.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { ComputeBudgetProgram, Connection, PublicKey } from "@solana/web3.js";
import { config } from "../config.js";
import { createPythClient } from "../pyth/client.js";
import { planKeeperAction } from "../lifecycle.js";
import { createProgram, phaseName, readKeypair } from "../solana.js";
import { TxlineClient, latestFinalScore } from "../txline/client.js";
import { validationPayload } from "../txline/validation.js";
import { runHybridKeeperPass } from "./hybrid.js";

const TXLINE_PROGRAM = new PublicKey("6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J");

function vaultPda(programId: PublicKey, market: PublicKey) {
  return PublicKey.findProgramAddressSync([Buffer.from("vault"), market.toBuffer()], programId)[0];
}

function dailyScoresRoot(timestampMs: number) {
  const epochDay = Math.floor(timestampMs / 86_400_000);
  if (epochDay < 0 || epochDay > 65_535) throw new Error("TxLINE timestamp is outside the u16 epoch-day range");
  const bytes = new BN(epochDay).toArrayLike(Buffer, "le", 2);
  return PublicKey.findProgramAddressSync([Buffer.from("daily_scores_roots"), bytes], TXLINE_PROGRAM)[0];
}

function log(value: Record<string, unknown>) {
  process.stdout.write(`${JSON.stringify({ at: new Date().toISOString(), ...value })}\n`);
}

async function main() {
  if (!config.keypairPath) throw new Error("NORTIA_KEYPAIR_PATH is required for the keeper");
  const keypair = await readKeypair(config.keypairPath);
  const connection = new Connection(config.rpcUrl, "confirmed");
  const program = createProgram(connection, keypair);
  const pyth = createPythClient(config.pythHermesOrigin, config.pythApiKey);
  const txline = config.txlineJwt && config.txlineApiToken
    ? new TxlineClient({ origin: config.txlineOrigin, jwt: config.txlineJwt, apiToken: config.txlineApiToken })
    : null;

  for (;;) {
    const now = Math.floor(Date.now() / 1_000);
    const markets = await program.account.market.all();
    for (const { publicKey: marketAddress, account } of markets) {
      try {
        const action = planKeeperAction({
          phase: phaseName(account.phase),
          lockTs: account.lockTs.toNumber(),
          batchDeadlineTs: account.batchDeadlineTs.toNumber(),
          resolutionDeadlineTs: account.resolutionDeadlineTs.toNumber(),
        }, now);
        if (action === "none") continue;

        const context = { market: marketAddress.toBase58(), action };
        if (config.keeperDryRun) {
          log({ event: "keeper-dry-run", ...context });
          continue;
        }
        if (action === "submit-batch") {
          log({ event: "committee-batch-required", ...context });
          continue;
        }
        if (action === "begin-refund") {
          const signature = await program.methods
            .beginRefund()
            .accountsPartial({ market: marketAddress })
            .rpc();
          log({ event: "refunds-opened", signature, ...context });
          continue;
        }
        if (!txline) {
          log({
            event: "resolution-blocked",
            reason: "TxLINE credentials are not configured",
            ...context,
          });
          continue;
        }

        const fixtureId = account.fixtureId.toNumber();
        const finalRecord = latestFinalScore(await txline.historical(fixtureId));
        if (!finalRecord) {
          log({
            event: "resolution-waiting",
            reason: "No game_finalised record",
            fixtureId,
            ...context,
          });
          continue;
        }
        const seq = Number(finalRecord.seq ?? finalRecord.Seq);
        const proof = await txline.validationProof(fixtureId, seq, [
          account.scoreKeyA,
          account.scoreKeyB,
        ]);
        const payload = validationPayload(proof);
        const timestampMs = payload.ts.toNumber();
        const collateralMint = account.collateralMint;
        const keeperToken = getAssociatedTokenAddressSync(collateralMint, keypair.publicKey);
        const treasuryToken = getAssociatedTokenAddressSync(collateralMint, account.treasuryOwner);
        const setupInstructions = [
          createAssociatedTokenAccountIdempotentInstruction(
            keypair.publicKey,
            keeperToken,
            keypair.publicKey,
            collateralMint,
            TOKEN_PROGRAM_ID,
            ASSOCIATED_TOKEN_PROGRAM_ID,
          ),
          createAssociatedTokenAccountIdempotentInstruction(
            keypair.publicKey,
            treasuryToken,
            account.treasuryOwner,
            collateralMint,
            TOKEN_PROGRAM_ID,
            ASSOCIATED_TOKEN_PROGRAM_ID,
          ),
        ];
        const signature = await program.methods
          .resolveMarket(seq, payload)
          .accountsPartial({
            keeper: keypair.publicKey,
            market: marketAddress,
            collateralMint,
            vault: vaultPda(program.programId, marketAddress),
            treasuryToken,
            keeperToken,
            dailyScoresMerkleRoots: dailyScoresRoot(timestampMs),
            txlineProgram: TXLINE_PROGRAM,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .preInstructions([
            ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 }),
            ...setupInstructions,
          ])
          .rpc();
        log({ event: "market-resolved", signature, fixtureId, seq, ...context });
      } catch (error) {
        log({
          event: "legacy-keeper-error",
          market: marketAddress.toBase58(),
          reason: error instanceof Error ? error.message : String(error),
        });
      }
    }
    await runHybridKeeperPass({
      connection,
      keypair,
      program,
      pyth,
      txline,
      dryRun: config.keeperDryRun,
      now,
      log,
    });
    await delay(config.keeperIntervalMs);
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});

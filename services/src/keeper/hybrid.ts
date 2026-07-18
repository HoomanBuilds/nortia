import { PublicKey, SystemProgram, type Connection, type Keypair } from "@solana/web3.js";
import {
  hybridVaultPda,
  optimisticProposalPda,
  oracleConfigPda,
  resolutionReceiptPda,
} from "nortia-client/market-engine";
import { config } from "../config.js";
import { planHybridKeeperAction } from "../hybrid-lifecycle.js";
import { resolvePythHybridMarket } from "../pyth/settlement.js";
import type { PythClient } from "../pyth/client.js";
import {
  hybridPhaseName,
  oracleResolverName,
  type createProgram,
} from "../solana.js";
import { TxlineClient, latestFinalScore } from "../txline/client.js";
import { validationPayload } from "../txline/validation.js";
import { resolveStorkHybridMarket } from "../stork/settlement.js";
import { resolveSwitchboardHybridMarket } from "../switchboard/managed.js";

const TXLINE_PROGRAM = new PublicKey("6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J");
const PARTICIPANT_GOAL_KEYS = [1, 2] as const;

type NortiaProgram = ReturnType<typeof createProgram>;
type KeeperLog = (value: Record<string, unknown>) => void;

export function fixtureIdFromSource(sourceId: number[]): number {
  const bytes = Buffer.from(sourceId);
  if (bytes.length !== 32 || bytes.subarray(8).some((value) => value !== 0)) {
    throw new Error("TxLINE source ID is not a canonical fixture ID");
  }
  const fixtureId = bytes.readBigInt64LE(0);
  if (fixtureId <= 0n || fixtureId > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error("TxLINE fixture ID is outside the supported range");
  }
  return Number(fixtureId);
}

export function dailyScoresRoot(timestampMs: number): PublicKey {
  const epochDay = Math.floor(timestampMs / 86_400_000);
  if (epochDay < 0 || epochDay > 65_535) {
    throw new Error("TxLINE timestamp is outside the u16 epoch-day range");
  }
  const bytes = Buffer.alloc(2);
  bytes.writeUInt16LE(epochDay);
  return PublicKey.findProgramAddressSync(
    [Buffer.from("daily_scores_roots"), bytes],
    TXLINE_PROGRAM,
  )[0];
}

async function resolveTxline(input: {
  program: NortiaProgram;
  keypair: Keypair;
  market: PublicKey;
  sourceId: number[];
  txline: TxlineClient;
}): Promise<string | null> {
  const fixtureId = fixtureIdFromSource(input.sourceId);
  const finalRecord = latestFinalScore(await input.txline.historical(fixtureId));
  if (!finalRecord) return null;
  const seq = Number(finalRecord.seq ?? finalRecord.Seq);
  const proof = await input.txline.validationProof(
    fixtureId,
    seq,
    PARTICIPANT_GOAL_KEYS,
  );
  const payload = validationPayload(proof);
  return input.program.methods
    .resolveHybridWithTxline(payload)
    .accountsPartial({
      keeper: input.keypair.publicKey,
      market: input.market,
      oracleConfig: oracleConfigPda(input.market),
      receipt: resolutionReceiptPda(input.market),
      vault: hybridVaultPda(input.market),
      dailyScoresMerkleRoots: dailyScoresRoot(payload.ts.toNumber()),
      txlineProgram: TXLINE_PROGRAM,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
}

export async function runHybridKeeperPass(input: {
  connection: Connection;
  keypair: Keypair;
  program: NortiaProgram;
  pyth: PythClient;
  txline: TxlineClient | null;
  dryRun: boolean;
  now: number;
  log: KeeperLog;
}): Promise<void> {
  const markets = await input.program.account.hybridMarket.all();
  for (const { publicKey: marketAddress, account: market } of markets) {
    const context = { market: marketAddress.toBase58(), marketKind: "lmsr" };
    try {
      const oracle = await input.program.account.oracleConfig.fetch(market.oracleConfig);
      const resolver = oracleResolverName(oracle.resolver);
      const proposalAddress = oracle.optimisticProposal;
      const proposal = proposalAddress.equals(PublicKey.default)
        ? null
        : await input.program.account.optimisticProposal.fetch(proposalAddress);
      const action = planHybridKeeperAction(
        {
          phase: hybridPhaseName(market.phase),
          resolver,
          lockTs: market.lockTs.toNumber(),
          resolveNotBeforeTs: market.resolveNotBeforeTs.toNumber(),
          resolutionDeadlineTs: market.resolutionDeadlineTs.toNumber(),
          proposal: proposal
            ? {
                challengeDeadline: proposal.challengeDeadline.toNumber(),
                challenged: !proposal.challenger.equals(PublicKey.default),
                finalized: proposal.finalized,
              }
            : null,
        },
        input.now,
      );
      if (action === "none") continue;
      if (input.dryRun) {
        input.log({ event: "hybrid-keeper-dry-run", action, resolver, ...context });
        continue;
      }

      if (action === "lock") {
        const signature = await input.program.methods
          .lockHybridMarket()
          .accountsPartial({ market: marketAddress })
          .rpc();
        input.log({ event: "hybrid-market-locked", signature, ...context });
        continue;
      }
      if (action === "resolve-timeout") {
        const signature = await input.program.methods
          .resolveHybridTimeout()
          .accountsPartial({
            keeper: input.keypair.publicKey,
            market: marketAddress,
            oracleConfig: oracleConfigPda(marketAddress),
            receipt: resolutionReceiptPda(marketAddress),
            vault: hybridVaultPda(marketAddress),
            systemProgram: SystemProgram.programId,
          })
          .rpc();
        input.log({ event: "hybrid-market-invalidated", signature, ...context });
        continue;
      }
      if (action === "finalize-optimistic") {
        const signature = await input.program.methods
          .finalizeOptimisticResolution()
          .accountsPartial({
            keeper: input.keypair.publicKey,
            market: marketAddress,
            oracleConfig: oracleConfigPda(marketAddress),
            proposal: optimisticProposalPda(marketAddress),
            receipt: resolutionReceiptPda(marketAddress),
            vault: hybridVaultPda(marketAddress),
            systemProgram: SystemProgram.programId,
          })
          .rpc();
        input.log({ event: "optimistic-market-finalized", signature, ...context });
        continue;
      }
      if (action === "timeout-optimistic-dispute") {
        const signature = await input.program.methods
          .timeoutOptimisticDispute()
          .accountsPartial({
            keeper: input.keypair.publicKey,
            market: marketAddress,
            oracleConfig: oracleConfigPda(marketAddress),
            proposal: optimisticProposalPda(marketAddress),
            receipt: resolutionReceiptPda(marketAddress),
            vault: hybridVaultPda(marketAddress),
            systemProgram: SystemProgram.programId,
          })
          .rpc();
        input.log({ event: "optimistic-dispute-timed-out", signature, ...context });
        continue;
      }
      if (action === "resolve-pyth") {
        const signatures = await resolvePythHybridMarket({
          connection: input.connection,
          keypair: input.keypair,
          market: marketAddress,
          oracle,
          program: input.program,
          pyth: input.pyth,
          computeUnitPriceMicroLamports: config.pythComputeUnitPriceMicroLamports,
        });
        input.log({ event: "pyth-market-resolved", signatures, ...context });
        continue;
      }
      if (action === "resolve-txline") {
        if (!input.txline) {
          input.log({
            event: "hybrid-resolution-blocked",
            reason: "TxLINE credentials missing",
            ...context,
          });
          continue;
        }
        const signature = await resolveTxline({
          program: input.program,
          keypair: input.keypair,
          market: marketAddress,
          sourceId: oracle.sourceId,
          txline: input.txline,
        });
        input.log(
          signature
            ? { event: "txline-hybrid-market-resolved", signature, ...context }
            : {
                event: "hybrid-resolution-waiting",
                reason: "No final TxLINE score",
                ...context,
              },
        );
        continue;
      }
      if (action === "resolve-stork") {
        const signature = await resolveStorkHybridMarket({
          keypair: input.keypair,
          market: marketAddress,
          oracle,
          program: input.program,
        });
        input.log({ event: "stork-market-resolved", signature, ...context });
        continue;
      }
      if (action !== "resolve-switchboard") {
        throw new Error(`Unsupported hybrid keeper action: ${action}`);
      }
      const signature = await resolveSwitchboardHybridMarket({
        connection: input.connection,
        keypair: input.keypair,
        market: marketAddress,
        oracle,
        program: input.program,
        crossbarOrigin: config.switchboardCrossbarOrigin,
        computeUnitPriceMicroLamports: config.switchboardComputeUnitPriceMicroLamports,
      });
      input.log({ event: "switchboard-market-resolved", signature, ...context });
    } catch (error) {
      input.log({
        event: "hybrid-keeper-error",
        reason: error instanceof Error ? error.message : String(error),
        ...context,
      });
    }
  }
}

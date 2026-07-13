import { mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { Connection, Keypair } from "@solana/web3.js";
import { config } from "../config.js";
import { createProgram, phaseName } from "../solana.js";

async function main() {
  const connection = new Connection(config.rpcUrl, "confirmed");
  const program = createProgram(connection, Keypair.generate());
  const writeSnapshot = async () => {
    const markets = await program.account.market.all();
    const snapshot = {
      generatedAt: new Date().toISOString(),
      network: "solana-devnet",
      programId: program.programId.toBase58(),
      markets: markets.map(({ publicKey, account }) => ({
      address: publicKey.toBase58(),
      authority: account.authority.toBase58(),
      marketId: account.marketId.toString(),
      category: Object.keys(account.category)[0],
      resolverKind: Object.keys(account.resolverKind)[0],
      questionHash: Buffer.from(account.questionHash).toString("hex"),
      rulesHash: Buffer.from(account.rulesHash).toString("hex"),
      fixtureId: account.fixtureId.toString(),
      fixtureStartTs: account.fixtureStartTs.toString(),
      lockTs: account.lockTs.toString(),
      batchDeadlineTs: account.batchDeadlineTs.toString(),
      resolutionDeadlineTs: account.resolutionDeadlineTs.toString(),
      phase: phaseName(account.phase),
      orderCount: account.orderCount,
      yesCount: account.yesCount,
      noCount: account.noCount,
      outcome: account.outcome,
      grossPool: account.grossPool.toString(),
      protocolFee: account.protocolFee.toString(),
      keeperReward: account.keeperReward.toString(),
      treasuryFee: account.treasuryFee.toString(),
      payoutAmount: account.payoutAmount.toString(),
      payoutRemainder: account.payoutRemainder.toString(),
      settlementEvidenceHash: Buffer.from(account.settlementEvidenceHash).toString("hex"),
      })),
    };

    await mkdir(path.dirname(config.indexOutputPath), { recursive: true });
    const temporary = `${config.indexOutputPath}.tmp`;
    await writeFile(temporary, `${JSON.stringify(snapshot, null, 2)}\n`, { mode: 0o600 });
    await rename(temporary, config.indexOutputPath);
    process.stdout.write(`${JSON.stringify({ event: "index-complete", markets: markets.length, output: config.indexOutputPath })}\n`);
  };

  await writeSnapshot();
  if (config.indexOnce) return;

  let scheduled: ReturnType<typeof setTimeout> | null = null;
  const subscription = connection.onLogs(program.programId, () => {
    if (scheduled) clearTimeout(scheduled);
    scheduled = setTimeout(() => {
      scheduled = null;
      void writeSnapshot().catch((error) => process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`));
    }, 750);
  }, "confirmed");
  process.stdout.write(`${JSON.stringify({ event: "index-watching", programId: program.programId.toBase58() })}\n`);
  process.once("SIGINT", () => {
    void connection.removeOnLogsListener(subscription).finally(() => process.exit(0));
  });
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});

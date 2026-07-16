import { mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { AccountLayout } from "@solana/spl-token";
import { Connection, Keypair, type PublicKey } from "@solana/web3.js";
import { hybridVaultPda } from "nortia-client/v2";
import { config } from "../config.js";
import { createProgram, phaseName } from "../solana.js";
import { buildHybridMarketSnapshot } from "./snapshot.js";

async function vaultBalances(
  connection: Connection,
  addresses: PublicKey[],
): Promise<Map<string, bigint | null>> {
  const balances = new Map<string, bigint | null>();
  for (let offset = 0; offset < addresses.length; offset += 100) {
    const batch = addresses.slice(offset, offset + 100);
    const accounts = await connection.getMultipleAccountsInfo(batch, "confirmed");
    for (let index = 0; index < batch.length; index += 1) {
      const address = batch[index];
      const account = accounts[index];
      if (!address) continue;
      const amount = account && account.data.length >= AccountLayout.span
        ? AccountLayout.decode(account.data).amount
        : null;
      balances.set(address.toBase58(), amount);
    }
  }
  return balances;
}

async function main() {
  const connection = new Connection(config.rpcUrl, "confirmed");
  const program = createProgram(connection, Keypair.generate());
  const writeSnapshot = async () => {
    const [legacyRows, hybridRows, oracleRows, receiptRows, metadataRows, positionRows] = await Promise.all([
      program.account.market.all(),
      program.account.hybridMarket.all(),
      program.account.oracleConfig.all(),
      program.account.resolutionReceipt.all(),
      program.account.hybridMarketMetadata.all(),
      program.account.position.all(),
    ]);
    const oracles = new Map(
      oracleRows.map(({ publicKey, account }) => [publicKey.toBase58(), account]),
    );
    const receipts = new Map(
      receiptRows.map(({ account }) => [account.market.toBase58(), account]),
    );
    const metadata = new Map(
      metadataRows.map(({ account }) => [account.market.toBase58(), account]),
    );
    const traderCounts = new Map<string, number>();
    for (const { account } of positionRows) {
      const market = account.market.toBase58();
      traderCounts.set(market, (traderCounts.get(market) ?? 0) + 1);
    }
    const vaults = hybridRows.map(({ publicKey }) => hybridVaultPda(publicKey));
    const balances = await vaultBalances(connection, vaults);
    const now = Math.floor(Date.now() / 1_000);
    const hybridMarkets = hybridRows.map(({ publicKey, account }, index) => {
      const oracle = oracles.get(account.oracleConfig.toBase58());
      if (!oracle) throw new Error(`Missing oracle config for ${publicKey.toBase58()}`);
      const vault = vaults[index];
      if (!vault) throw new Error(`Missing vault derivation for ${publicKey.toBase58()}`);
      return buildHybridMarketSnapshot({
        address: publicKey,
        vault,
        vaultBalance: balances.get(vault.toBase58()) ?? null,
        market: account,
        oracle,
        receipt: receipts.get(publicKey.toBase58()) ?? null,
        metadata: metadata.get(publicKey.toBase58()) ?? null,
        traderCount: traderCounts.get(publicKey.toBase58()) ?? 0,
        now,
      });
    });
    const markets = legacyRows.map(({ publicKey, account }) => ({
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
    }));
    const snapshot = {
      schemaVersion: 2,
      generatedAt: new Date().toISOString(),
      network: "solana-devnet",
      programId: program.programId.toBase58(),
      markets,
      hybridMarkets,
    };

    await mkdir(path.dirname(config.indexOutputPath), { recursive: true });
    const temporary = `${config.indexOutputPath}.tmp`;
    await writeFile(temporary, `${JSON.stringify(snapshot, null, 2)}\n`, { mode: 0o600 });
    await rename(temporary, config.indexOutputPath);
    process.stdout.write(`${JSON.stringify({
      event: "index-complete",
      legacyMarkets: markets.length,
      hybridMarkets: hybridMarkets.length,
      output: config.indexOutputPath,
    })}\n`);
  };

  await writeSnapshot();
  if (config.indexOnce) return;

  let scheduled: ReturnType<typeof setTimeout> | null = null;
  const subscription = connection.onLogs(
    program.programId,
    () => {
      if (scheduled) clearTimeout(scheduled);
      scheduled = setTimeout(() => {
        scheduled = null;
        void writeSnapshot().catch((error) => {
          process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
        });
      }, 750);
    },
    "confirmed",
  );
  process.stdout.write(`${JSON.stringify({
    event: "index-watching",
    programId: program.programId.toBase58(),
  })}\n`);
  process.once("SIGINT", () => {
    void connection.removeOnLogsListener(subscription).finally(() => process.exit(0));
  });
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});

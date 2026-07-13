import { createHash } from "node:crypto";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { Connection, PublicKey, SystemProgram } from "@solana/web3.js";
import BN from "bn.js";
import { config } from "../config.js";
import { createProgram, readKeypair } from "../solana.js";

const fixture = {
  id: 18_222_446,
  start: "2026-07-12T01:00:00Z",
  question: "Will Argentina vs Switzerland finish with over 2.5 goals?",
  rules: "TxLINE participant-one goals plus participant-two goals for final period 100 must be greater than 2.",
} as const;

function hash(value: string) {
  return Array.from(createHash("sha256").update(value).digest());
}

function protocolPda(programId: PublicKey) {
  return PublicKey.findProgramAddressSync([Buffer.from("protocol")], programId)[0];
}

function marketPda(programId: PublicKey, creator: PublicKey, marketId: BN) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("market"), creator.toBuffer(), marketId.toArrayLike(Buffer, "le", 8)],
    programId,
  )[0];
}

function vaultPda(programId: PublicKey, market: PublicKey) {
  return PublicKey.findProgramAddressSync([Buffer.from("vault"), market.toBuffer()], programId)[0];
}

async function main() {
  if (!config.keypairPath) throw new Error("NORTIA_KEYPAIR_PATH is required");

  const creator = await readKeypair(config.keypairPath);
  const connection = new Connection(config.rpcUrl, "confirmed");
  const program = createProgram(connection, creator);
  const marketId = new BN(`${fixture.id}21`);
  const protocol = protocolPda(program.programId);
  const market = marketPda(program.programId, creator.publicKey, marketId);
  const vault = vaultPda(program.programId, market);

  if (await connection.getAccountInfo(market, "confirmed")) {
    process.stdout.write(`${JSON.stringify({ event: "market-exists", market: market.toBase58(), marketId: marketId.toString(), vault: vault.toBase58() })}\n`);
    return;
  }

  const now = Math.floor(Date.now() / 1_000);
  const fixtureStart = Math.floor(Date.parse(fixture.start) / 1_000);
  const lock = now + 2 * 60 * 60;
  const batchDeadline = lock + 15 * 60;
  const resolutionDeadline = Math.max(batchDeadline + 60 * 60, fixtureStart + 8 * 60 * 60);
  const signature = await program.methods.initializeMarket({
    marketId,
    category: { sports: {} },
    resolverKind: { txlineStatV2: {} },
    questionHash: hash(fixture.question),
    rulesHash: hash(fixture.rules),
    fixtureId: new BN(fixture.id),
    totalGoalsThreshold: 2,
    marketMode: { replay: {} },
    fixtureStartTs: new BN(fixtureStart),
    lockTs: new BN(lock),
    batchDeadlineTs: new BN(batchDeadline),
    resolutionDeadlineTs: new BN(resolutionDeadline),
  }).accountsPartial({
    creator: creator.publicKey,
    protocol,
    collateralMint: new PublicKey(config.collateralMint),
    market,
    vault,
    tokenProgram: TOKEN_PROGRAM_ID,
    systemProgram: SystemProgram.programId,
  }).rpc();

  process.stdout.write(`${JSON.stringify({
    event: "market-created",
    signature,
    market: market.toBase58(),
    marketId: marketId.toString(),
    vault: vault.toBase58(),
    lockTs: lock,
    batchDeadlineTs: batchDeadline,
    resolutionDeadlineTs: resolutionDeadline,
  })}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});

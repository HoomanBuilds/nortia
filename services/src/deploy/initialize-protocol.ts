import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { Connection, PublicKey, SystemProgram } from "@solana/web3.js";
import { config } from "../config.js";
import { createProgram, readKeypair } from "../solana.js";

function protocolPda(programId: PublicKey) {
  return PublicKey.findProgramAddressSync([Buffer.from("protocol")], programId)[0];
}

function enginePda(programId: PublicKey) {
  return PublicKey.findProgramAddressSync([Buffer.from("engine-v2")], programId)[0];
}

async function main() {
  if (!config.keypairPath) throw new Error("NORTIA_KEYPAIR_PATH is required");

  const authority = await readKeypair(config.keypairPath);
  const connection = new Connection(config.rpcUrl, "confirmed");
  const program = createProgram(connection, authority);
  const protocol = protocolPda(program.programId);
  const engine = enginePda(program.programId);
  const protocolAccount = await connection.getAccountInfo(protocol, "confirmed");
  if (protocolAccount) {
    process.stdout.write(`${JSON.stringify({ event: "protocol-exists", protocol: protocol.toBase58() })}\n`);
  } else {
    if (!config.treasuryOwner) throw new Error("NORTIA_TREASURY_OWNER is required for first initialization");
    if (config.committeePubkeys.length !== 3) {
      throw new Error("NORTIA_COMMITTEE_PUBKEYS must contain three comma-separated addresses for first initialization");
    }
    if (!config.placementVerifier || !config.redeemVerifier) {
      throw new Error("Both Nortia verifier addresses are required for first initialization");
    }
    const signature = await program.methods.initializeProtocol({
      treasuryOwner: new PublicKey(config.treasuryOwner),
      feeBps: 100,
      keeperRewardBps: 1_000,
      committee: config.committeePubkeys.map((value) => new PublicKey(value)) as [PublicKey, PublicKey, PublicKey],
      placementVerifier: new PublicKey(config.placementVerifier),
      redeemVerifier: new PublicKey(config.redeemVerifier),
    }).accountsPartial({
      authority: authority.publicKey,
      protocol,
      collateralMint: new PublicKey(config.collateralMint),
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    }).rpc();
    process.stdout.write(`${JSON.stringify({ event: "protocol-initialized", protocol: protocol.toBase58(), signature })}\n`);
  }

  if (await connection.getAccountInfo(engine, "confirmed")) {
    process.stdout.write(`${JSON.stringify({ event: "engine-exists", engine: engine.toBase58() })}\n`);
    return;
  }
  const signature = await program.methods.initializeEngine({
    treasuryFeeShareBps: config.treasuryFeeShareBps,
  }).accountsPartial({
    authority: authority.publicKey,
    protocol,
    engine,
    systemProgram: SystemProgram.programId,
  }).rpc();
  process.stdout.write(`${JSON.stringify({
    event: "engine-initialized",
    engine: engine.toBase58(),
    treasuryFeeShareBps: config.treasuryFeeShareBps,
    signature,
  })}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});

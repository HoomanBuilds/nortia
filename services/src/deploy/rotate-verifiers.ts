import { Connection, PublicKey } from "@solana/web3.js";
import { config } from "../config.js";
import { createProgram, readKeypair } from "../solana.js";

function protocolPda(programId: PublicKey) {
  return PublicKey.findProgramAddressSync([Buffer.from("protocol")], programId)[0];
}

function vaultPda(programId: PublicKey, market: PublicKey) {
  return PublicKey.findProgramAddressSync([Buffer.from("vault"), market.toBuffer()], programId)[0];
}

function syncMarkets() {
  return (process.env.NORTIA_SYNC_PRIVATE_MARKETS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => new PublicKey(value));
}

async function main() {
  if (!config.keypairPath) throw new Error("NORTIA_KEYPAIR_PATH is required");
  if (!config.placementVerifier || !config.redeemVerifier) {
    throw new Error("NORTIA_PLACEMENT_VERIFIER and NORTIA_REDEEM_VERIFIER are required");
  }

  const authority = await readKeypair(config.keypairPath);
  const connection = new Connection(config.rpcUrl, "confirmed");
  const program = createProgram(connection, authority);
  const protocol = protocolPda(program.programId);
  const placementVerifier = new PublicKey(config.placementVerifier);
  const redeemVerifier = new PublicKey(config.redeemVerifier);
  if (placementVerifier.equals(redeemVerifier)) throw new Error("Verifier programs must be distinct");

  const protocolAccount = await program.account.protocolConfig.fetch(protocol);
  if (
    protocolAccount.placementVerifier.equals(placementVerifier)
    && protocolAccount.redeemVerifier.equals(redeemVerifier)
  ) {
    process.stdout.write(`${JSON.stringify({ event: "verifiers-current", protocol: protocol.toBase58() })}\n`);
  } else {
    const signature = await program.methods.rotateVerifiers().accountsPartial({
      authority: authority.publicKey,
      protocol,
      placementVerifier,
      redeemVerifier,
    }).rpc();
    process.stdout.write(`${JSON.stringify({
      event: "verifiers-rotated",
      protocol: protocol.toBase58(),
      placementVerifier: placementVerifier.toBase58(),
      redeemVerifier: redeemVerifier.toBase58(),
      signature,
    })}\n`);
  }

  for (const market of syncMarkets()) {
    const marketAccount = await program.account.market.fetch(market);
    if (
      marketAccount.placementVerifier.equals(placementVerifier)
      && marketAccount.redeemVerifier.equals(redeemVerifier)
    ) {
      process.stdout.write(`${JSON.stringify({ event: "market-verifiers-current", market: market.toBase58() })}\n`);
      continue;
    }
    const signature = await program.methods.syncMarketVerifiers().accountsPartial({
      authority: authority.publicKey,
      protocol,
      market,
      vault: vaultPda(program.programId, market),
    }).rpc();
    process.stdout.write(`${JSON.stringify({
      event: "market-verifiers-synced",
      market: market.toBase58(),
      placementVerifier: placementVerifier.toBase58(),
      redeemVerifier: redeemVerifier.toBase58(),
      signature,
    })}\n`);
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});

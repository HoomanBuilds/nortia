import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { Connection, PublicKey } from "@solana/web3.js";
import { formatUsdc } from "nortia-client/economics";
import { hybridVaultPda, positionPda } from "nortia-client/market-engine";
import { config } from "../config.js";
import { createProgram, hybridPhaseName, readKeypair } from "../solana.js";

const DEVNET_GENESIS_HASH = "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG";

async function main() {
  if (!config.keypairPath) throw new Error("NORTIA_KEYPAIR_PATH is required");
  const marketInput = process.env.NORTIA_HYBRID_MARKET?.trim();
  if (!marketInput) throw new Error("NORTIA_HYBRID_MARKET is required");
  const marketAddress = new PublicKey(marketInput);
  const owner = await readKeypair(config.keypairPath);
  const connection = new Connection(config.rpcUrl, "confirmed");
  if (await connection.getGenesisHash() !== DEVNET_GENESIS_HASH) {
    throw new Error("The hybrid settlement command is restricted to Solana devnet");
  }
  const program = createProgram(connection, owner);
  let market = await program.account.hybridMarket.fetch(marketAddress);
  if (hybridPhaseName(market.phase) !== "resolved") {
    throw new Error("The market is not resolved");
  }

  const ownerToken = getAssociatedTokenAddressSync(market.collateralMint, owner.publicKey);
  const setup = createAssociatedTokenAccountIdempotentInstruction(
    owner.publicKey,
    ownerToken,
    owner.publicKey,
    market.collateralMint,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );
  const position = positionPda(marketAddress, owner.publicKey);
  const positionAccount = await program.account.position.fetchNullable(position);
  let claimSignature: string | null = null;
  if (positionAccount && !positionAccount.settled) {
    claimSignature = await program.methods.settleHybridPosition().accountsPartial({
      owner: owner.publicKey,
      market: marketAddress,
      position,
      collateralMint: market.collateralMint,
      vault: hybridVaultPda(marketAddress),
      ownerToken,
      tokenProgram: TOKEN_PROGRAM_ID,
    }).preInstructions([setup]).rpc();
  }

  market = await program.account.hybridMarket.fetch(marketAddress);
  const vault = hybridVaultPda(marketAddress);
  const vaultBalance = BigInt((await connection.getTokenAccountBalance(vault)).value.amount);
  const liability = BigInt(market.outstandingLiability.toString());
  const withdrawable = vaultBalance - liability;
  let withdrawSignature: string | null = null;
  if (market.liquidityOwner.equals(owner.publicKey) && withdrawable > 0n) {
    withdrawSignature = await program.methods.withdrawHybridLiquidity().accountsPartial({
      liquidityOwner: owner.publicKey,
      market: marketAddress,
      collateralMint: market.collateralMint,
      vault,
      liquidityToken: ownerToken,
      tokenProgram: TOKEN_PROGRAM_ID,
    }).preInstructions([setup]).rpc();
  }

  const finalPosition = await program.account.position.fetchNullable(position);
  process.stdout.write(`${JSON.stringify({
    event: "hybrid-settlement-complete",
    market: marketAddress.toBase58(),
    owner: owner.publicKey.toBase58(),
    position: position.toBase58(),
    claimAmount: finalPosition ? formatUsdc(BigInt(finalPosition.settledAmount.toString())) : "0",
    liquidityWithdrawn: withdrawSignature ? formatUsdc(withdrawable) : "0",
    claimSignature,
    withdrawSignature,
  })}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});

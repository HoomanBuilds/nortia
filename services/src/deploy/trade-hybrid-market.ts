import BN from "bn.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { Connection, PublicKey, SystemProgram } from "@solana/web3.js";
import { formatUsdc } from "nortia-client/economics";
import { quoteLmsrBuy, quoteLmsrSell } from "nortia-client/lmsr";
import { hybridVaultPda, positionPda } from "nortia-client/market-engine";
import { config } from "../config.js";
import { createProgram, readKeypair } from "../solana.js";
import {
  resolveSlippageBps,
  resolveTradeDirection,
  resolveTradeShares,
  resolveTradeSide,
} from "./trade-hybrid-market-config.js";

const DEVNET_GENESIS_HASH = "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG";

function amountGuard(amount: bigint, direction: "buy" | "sell", slippageBps: number): bigint {
  return direction === "buy"
    ? (amount * BigInt(10_000 + slippageBps) + 9_999n) / 10_000n
    : amount * BigInt(10_000 - slippageBps) / 10_000n;
}

async function main() {
  if (!config.keypairPath) throw new Error("NORTIA_KEYPAIR_PATH is required");
  const marketInput = process.env.NORTIA_HYBRID_MARKET?.trim();
  if (!marketInput) throw new Error("NORTIA_HYBRID_MARKET is required");
  const market = new PublicKey(marketInput);
  const direction = resolveTradeDirection(process.env.NORTIA_TRADE_DIRECTION);
  const side = resolveTradeSide(process.env.NORTIA_TRADE_SIDE);
  const shares = resolveTradeShares(process.env.NORTIA_TRADE_SHARES);
  const slippageBps = resolveSlippageBps(process.env.NORTIA_TRADE_SLIPPAGE_BPS);
  const owner = await readKeypair(config.keypairPath);
  const connection = new Connection(config.rpcUrl, "confirmed");
  if (await connection.getGenesisHash() !== DEVNET_GENESIS_HASH) {
    throw new Error("The hybrid trade command is restricted to Solana devnet");
  }
  const program = createProgram(connection, owner);
  const account = await program.account.hybridMarket.fetch(market);
  const phase = (Object.keys(account.phase)[0] ?? "").replaceAll("_", "").toLowerCase();
  if (phase !== "open" || Math.floor(Date.now() / 1_000) >= account.lockTs.toNumber()) {
    throw new Error("The market is not open for trading");
  }
  if (shares > BigInt(account.maxTradeShares.toString())) {
    throw new Error("Trade size exceeds the immutable market limit");
  }
  const quantities = {
    yes: BigInt(account.yesQuantity.toString()),
    no: BigInt(account.noQuantity.toString()),
  };
  const liquidity = BigInt(account.liquidityParameter.toString());
  const quote = direction === "buy"
    ? quoteLmsrBuy(quantities, liquidity, side, shares, account.tradeFeeBps)
    : quoteLmsrSell(quantities, liquidity, side, shares, account.tradeFeeBps);
  const position = positionPda(market, owner.publicKey);
  const positionAccount = await program.account.position.fetchNullable(position);
  if (direction === "sell") {
    const available = side === "yes"
      ? BigInt(positionAccount?.yesShares.toString() ?? "0")
      : BigInt(positionAccount?.noShares.toString() ?? "0");
    if (available < shares) throw new Error("The position does not contain enough shares");
  }

  const ownerToken = getAssociatedTokenAddressSync(account.collateralMint, owner.publicKey);
  const treasuryToken = getAssociatedTokenAddressSync(account.collateralMint, account.treasuryOwner);
  const liquidityToken = getAssociatedTokenAddressSync(account.collateralMint, account.liquidityOwner);
  const owners = new Map([
    [ownerToken.toBase58(), { token: ownerToken, owner: owner.publicKey }],
    [treasuryToken.toBase58(), { token: treasuryToken, owner: account.treasuryOwner }],
    [liquidityToken.toBase58(), { token: liquidityToken, owner: account.liquidityOwner }],
  ]);
  const setup = [...owners.values()].map(({ token, owner: tokenOwner }) =>
    createAssociatedTokenAccountIdempotentInstruction(
      owner.publicKey,
      token,
      tokenOwner,
      account.collateralMint,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID,
    ),
  );
  if (!positionAccount) {
    setup.push(await program.methods.initializePosition().accountsPartial({
      owner: owner.publicKey,
      market,
      position,
      systemProgram: SystemProgram.programId,
    }).instruction());
  }
  const args = {
    side: side === "yes" ? 1 : 0,
    shares: new BN(shares.toString()),
    amountGuard: new BN(amountGuard(quote.totalAmount, direction, slippageBps).toString()),
    deadlineTs: new BN(Math.floor(Date.now() / 1_000) + 120),
  };
  const builder = direction === "buy"
    ? program.methods.buyHybridShares(args)
    : program.methods.sellHybridShares(args);
  const signature = await builder.accountsPartial({
    owner: owner.publicKey,
    market,
    position,
    collateralMint: account.collateralMint,
    ownerToken,
    vault: hybridVaultPda(market),
    treasuryToken,
    liquidityToken,
    tokenProgram: TOKEN_PROGRAM_ID,
  }).preInstructions(setup).rpc();

  process.stdout.write(`${JSON.stringify({
    event: "hybrid-trade-confirmed",
    market: market.toBase58(),
    owner: owner.publicKey.toBase58(),
    position: position.toBase58(),
    direction,
    side,
    shares: shares.toString(),
    amount: quote.totalAmount.toString(),
    amountFormatted: formatUsdc(quote.totalAmount),
    fee: quote.feeAmount.toString(),
    beforeYesProbabilityPpm: quote.beforeYesProbability.toString(),
    afterYesProbabilityPpm: quote.afterYesProbability.toString(),
    signature,
  })}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});

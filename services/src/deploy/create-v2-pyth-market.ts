import { createHash } from "node:crypto";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { Connection, PublicKey, SystemProgram } from "@solana/web3.js";
import BN from "bn.js";
import { formatUsdc } from "nortia-client/economics";
import { requiredLmsrSubsidy } from "nortia-client/lmsr";
import { oracleSourceIdBytes, parseDecimalAtExponent } from "nortia-client/oracles";
import {
  enginePda,
  hybridMarketPda,
  hybridMetadataPda,
  hybridVaultPda,
  oracleConfigPda,
} from "nortia-client/v2";
import { config } from "../config.js";
import { createProgram, readKeypair } from "../solana.js";
import { resolveMarketId, resolveObservationTimestamp } from "./v2-pyth-market-config.js";

const PYTH_RECEIVER_PROGRAM = new PublicKey("rec5EKMGg6MxZYaMdyBfgwp4d5rB9T1VQH5pJv5LtFJ");
const DEVNET_GENESIS_HASH = "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG";
const DEVNET_USDC_MINT = new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");
const BTC_USD_FEED = "e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43";
const LIQUIDITY_PARAMETER = 10_000_000n;
const ROUNDING_RESERVE = 2n;
const MAX_TRADE_SHARES = 10_000_000n;
const TRADE_FEE_BPS = 100;

function hash(value: string) {
  return Array.from(createHash("sha256").update(value).digest());
}

async function main() {
  if (!config.keypairPath) throw new Error("NORTIA_KEYPAIR_PATH is required");
  const creator = await readKeypair(config.keypairPath);
  const connection = new Connection(config.rpcUrl, "confirmed");
  const genesisHash = await connection.getGenesisHash();
  if (genesisHash !== DEVNET_GENESIS_HASH) {
    throw new Error("V2 demo market deployment is restricted to Solana devnet");
  }
  const program = createProgram(connection, creator);
  const observationTs = resolveObservationTimestamp(
    process.env.NORTIA_V2_OBSERVATION_AT,
    Math.floor(Date.now() / 1_000),
  );
  const id = resolveMarketId(process.env.NORTIA_V2_MARKET_ID, observationTs);
  const thresholdInput = process.env.NORTIA_V2_BTC_THRESHOLD ?? "120000.00";
  const threshold = parseDecimalAtExponent(thresholdInput, -2);
  if (threshold <= 0n) throw new Error("NORTIA_V2_BTC_THRESHOLD must be positive");

  const question = `Will BTC/USD be at or above $${thresholdInput} at ${new Date(observationTs * 1_000).toISOString()}?`;
  const rules = `Resolve from the fully verified Pyth BTC/USD update that uniquely brackets ${new Date(observationTs * 1_000).toISOString()}. YES requires price greater than or equal to ${thresholdInput} USD with confidence width at or below 1%.`;
  const questionHash = hash(question);
  const rulesHash = hash(rules);
  const outcomeLabelsHash = hash("YES\nNO");
  const sourceId = oracleSourceIdBytes(BTC_USD_FEED);
  const oracleFingerprint = [
    "pyth-price-v2",
    PYTH_RECEIVER_PROGRAM.toBase58(),
    Buffer.from(sourceId).toString("hex"),
    "greater-than-or-equal",
    threshold.toString(),
    "-2",
    observationTs.toString(),
    Buffer.from(questionHash).toString("hex"),
    Buffer.from(rulesHash).toString("hex"),
  ].join("\n");
  const configHash = hash(oracleFingerprint);

  const engine = enginePda();
  const engineAccount = await program.account.engineConfig.fetchNullable(engine);
  if (!engineAccount) throw new Error("The Nortia V2 engine is not initialized on this cluster");
  if (!engineAccount.collateralMint.equals(DEVNET_USDC_MINT)) {
    throw new Error("The V2 engine is not configured with Circle devnet USDC");
  }
  const market = hybridMarketPda(creator.publicKey, id);
  const metadata = hybridMetadataPda(market);
  const vault = hybridVaultPda(market);
  const creatorToken = getAssociatedTokenAddressSync(engineAccount.collateralMint, creator.publicKey);
  const initialSubsidy = requiredLmsrSubsidy(LIQUIDITY_PARAMETER, ROUNDING_RESERVE);
  const tokenBalance = await connection.getTokenAccountBalance(creatorToken, "confirmed").catch(() => null);
  if (!tokenBalance || BigInt(tokenBalance.value.amount) < initialSubsidy) {
    throw new Error(`Creator needs at least ${formatUsdc(initialSubsidy)} Circle devnet USDC at ${creatorToken.toBase58()}`);
  }

  let marketSignature: string | null = null;
  if (!await connection.getAccountInfo(market, "confirmed")) {
    const lockTs = observationTs - 5 * 60;
    marketSignature = await program.methods.initializeHybridMarket({
      marketId: new BN(id.toString()),
      category: { crypto: {} },
      tradingMode: { continuous: {} },
      questionHash,
      rulesHash,
      outcomeLabelsHash,
      liquidityParameter: new BN(LIQUIDITY_PARAMETER.toString()),
      roundingReserve: new BN(ROUNDING_RESERVE.toString()),
      maxTradeShares: new BN(MAX_TRADE_SHARES.toString()),
      tradeFeeBps: TRADE_FEE_BPS,
      lockTs: new BN(lockTs),
      resolveNotBeforeTs: new BN(observationTs),
      resolutionDeadlineTs: new BN(observationTs + 30 * 60),
      oracle: {
        resolver: { pythPriceV2: {} },
        sourceProgram: PYTH_RECEIVER_PROGRAM,
        sourceQueue: PublicKey.default,
        sourceId,
        comparator: { greaterThanOrEqual: {} },
        threshold: new BN(threshold.toString()),
        thresholdExponent: -2,
        observationTs: new BN(observationTs),
        observationWindowSecs: 60,
        maxStalenessSecs: 30,
        maxStalenessSlots: new BN(0),
        maxConfidenceBps: 100,
        minSamples: 0,
        challengePeriodSecs: 0,
        bondAmount: new BN(0),
        configHash,
      },
    }).accountsPartial({
      creator: creator.publicKey,
      engine,
      collateralMint: engineAccount.collateralMint,
      creatorToken,
      market,
      oracleConfig: oracleConfigPda(market),
      vault,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    }).preInstructions([
      createAssociatedTokenAccountIdempotentInstruction(
        creator.publicKey,
        creatorToken,
        creator.publicKey,
        engineAccount.collateralMint,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID,
      ),
    ]).rpc();
  }

  let metadataSignature: string | null = null;
  if (!await connection.getAccountInfo(metadata, "confirmed")) {
    metadataSignature = await program.methods.publishHybridMetadata({
      question,
      rules,
      yesLabel: "YES",
      noLabel: "NO",
      referenceUrl: "https://www.pyth.network/price-feeds/crypto-btc-usd",
    }).accountsPartial({
      creator: creator.publicKey,
      market,
      metadata,
      systemProgram: SystemProgram.programId,
    }).rpc();
  }

  process.stdout.write(`${JSON.stringify({
    event: marketSignature || metadataSignature ? "v2-pyth-market-ready" : "v2-pyth-market-exists",
    market: market.toBase58(),
    marketId: id.toString(),
    vault: vault.toBase58(),
    metadata: metadata.toBase58(),
    observationAt: new Date(observationTs * 1_000).toISOString(),
    threshold: thresholdInput,
    initialSubsidy: initialSubsidy.toString(),
    marketSignature,
    metadataSignature,
  })}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});

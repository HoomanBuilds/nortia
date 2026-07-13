import path from "node:path";

function integer(name: string, fallback: number) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`${name} must be a positive integer`);
  return value;
}

function memberIndex(): 1 | 2 | 3 {
  const value = integer("COMMITTEE_MEMBER_INDEX", 1);
  if (value !== 1 && value !== 2 && value !== 3) throw new Error("COMMITTEE_MEMBER_INDEX must be 1, 2, or 3");
  return value;
}

function list(name: string) {
  return (process.env[name] ?? "").split(",").map((value) => value.trim()).filter(Boolean);
}

export const config = {
  rpcUrl: process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com",
  keypairPath: process.env.NORTIA_KEYPAIR_PATH ? path.resolve(process.env.NORTIA_KEYPAIR_PATH) : null,
  treasuryOwner: process.env.NORTIA_TREASURY_OWNER ?? null,
  collateralMint: process.env.NORTIA_COLLATERAL_MINT ?? "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
  committeePubkeys: list("NORTIA_COMMITTEE_PUBKEYS"),
  placementVerifier: process.env.NORTIA_PLACEMENT_VERIFIER ?? null,
  redeemVerifier: process.env.NORTIA_REDEEM_VERIFIER ?? null,
  txlineOrigin: (process.env.TXLINE_API_ORIGIN ?? "https://txline-dev.txodds.com").replace(/\/$/, ""),
  txlineJwt: process.env.TXLINE_JWT ?? null,
  txlineApiToken: process.env.TXLINE_API_TOKEN ?? null,
  keeperDryRun: process.env.KEEPER_DRY_RUN !== "false",
  keeperIntervalMs: integer("KEEPER_INTERVAL_MS", 15_000),
  indexOutputPath: path.resolve(process.env.INDEX_OUTPUT_PATH ?? "./state/markets.json"),
  indexOnce: process.env.INDEX_ONCE === "true",
  committeeMemberIndex: memberIndex(),
  committeePort: integer("COMMITTEE_PORT", 4_101),
  committeeStatePath: path.resolve(process.env.COMMITTEE_STATE_PATH ?? "./state/committee-1.json"),
  committeeEndpoints: list("COMMITTEE_ENDPOINTS"),
  committeeKeypairPaths: list("COMMITTEE_KEYPAIR_PATHS").map((value) => path.resolve(value)),
  proverPort: integer("PROVER_PORT", 4_200),
  proverApiToken: process.env.PROVER_API_TOKEN ?? null,
  repoRoot: path.resolve(process.env.NORTIA_REPO_ROOT ?? new URL("../..", import.meta.url).pathname),
};

import { randomBytes } from "node:crypto";
import { chmod, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const webPath = resolve(repoRoot, "web/.env.local");
const servicesPath = resolve(repoRoot, "services/.env");

async function readEnvironment(path) {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return "";
    throw error;
  }
}

function valuesFromEnvironment(content) {
  return new Map(content.split(/\r?\n/).flatMap((line) => {
    const separator = line.indexOf("=");
    return separator > 0 ? [[line.slice(0, separator), line.slice(separator + 1)]] : [];
  }));
}

async function updateEnvironment(path, values) {
  const current = await readEnvironment(path);
  const keys = new Set(Object.keys(values));
  const retained = current
    .split(/\r?\n/)
    .filter((line) => !keys.has(line.split("=", 1)[0] ?? ""))
    .filter((line, index, lines) => line.length > 0 || index < lines.length - 1);
  const additions = Object.entries(values).map(([key, value]) => `${key}=${value}`);
  await writeFile(path, `${[...retained, ...additions].join("\n")}\n`, { mode: 0o600 });
  await chmod(path, 0o600);
}

const serviceValues = valuesFromEnvironment(await readEnvironment(servicesPath));
const proverToken = serviceValues.get("PROVER_API_TOKEN") || randomBytes(32).toString("hex");
const keypairPath = process.env.NORTIA_KEYPAIR_PATH;

await updateEnvironment(servicesPath, {
  SOLANA_RPC_URL: "https://api.devnet.solana.com",
  NORTIA_COLLATERAL_MINT: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
  ORACLE_PROVIDER_PROFILE: "free",
  KEEPER_DRY_RUN: "true",
  PROVER_API_TOKEN: proverToken,
  ...(keypairPath ? { NORTIA_KEYPAIR_PATH: resolve(keypairPath) } : {}),
});

await updateEnvironment(webPath, {
  NEXT_PUBLIC_SOLANA_RPC_URL: "https://api.devnet.solana.com",
  PYTH_HERMES_ORIGIN: "https://hermes.pyth.network",
  SWITCHBOARD_CROSSBAR_ORIGIN: "https://crossbar.switchboard.xyz",
  STORK_REST_ORIGIN: "https://rest.dev.stork-oracle.network",
  NORTIA_PROVER_URL: "http://127.0.0.1:4200",
  NORTIA_PROVER_API_TOKEN: proverToken,
});

process.stdout.write(`${JSON.stringify({
  event: "local-environments-configured",
  webEnvironment: "web/.env.local",
  servicesEnvironment: "services/.env",
  proverTokenGenerated: !serviceValues.has("PROVER_API_TOKEN"),
})}\n`);

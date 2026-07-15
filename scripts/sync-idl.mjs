import { copyFile, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const idlSource = resolve(repoRoot, "target/idl/nortia.json");
const typeSource = resolve(repoRoot, "target/types/nortia.ts");
const expectedProgram = "4S2EvdGrbKJ9zazvB4gtR83crTrVJWqqwoVVvEQy8VE9";

const idl = JSON.parse(await readFile(idlSource, "utf8"));
if (idl.address !== expectedProgram) {
  throw new Error(`Refusing to sync IDL for unexpected program ${String(idl.address)}`);
}
if (!idl.instructions.some((instruction) => instruction.name === "buy_hybrid_shares")) {
  throw new Error("Generated IDL does not contain the V2 market instructions");
}

for (const destination of [
  "services/src/idl/nortia.json",
  "web/lib/solana/idl/nortia.json",
]) {
  await copyFile(idlSource, resolve(repoRoot, destination));
}
for (const destination of [
  "services/src/idl/nortia.ts",
  "web/lib/solana/idl/nortia.ts",
]) {
  await copyFile(typeSource, resolve(repoRoot, destination));
}

process.stdout.write("Synced Nortia IDL to services and web\n");

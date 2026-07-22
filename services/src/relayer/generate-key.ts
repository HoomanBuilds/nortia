import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { Keypair } from "@solana/web3.js";

async function main() {
  const output = process.argv[2];
  if (!output) throw new Error("Usage: npm run relayer:key -- <output-path>");
  const target = path.resolve(output);
  const relayer = Keypair.generate();
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, `${JSON.stringify([...relayer.secretKey])}\n`, { mode: 0o600, flag: "wx" });
  process.stdout.write(`${JSON.stringify({ created: target, relayer: relayer.publicKey.toBase58() })}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});

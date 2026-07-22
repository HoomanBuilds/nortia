import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { generateCommitteeEncryptionKey } from "./encryption.js";

async function main() {
  const memberIndex = Number(process.argv[2]);
  const output = process.argv[3];
  if ((memberIndex !== 1 && memberIndex !== 2 && memberIndex !== 3) || !output) {
    throw new Error("Usage: npm run committee:keys -- <1|2|3> <output-path>");
  }
  const target = path.resolve(output);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, `${JSON.stringify(await generateCommitteeEncryptionKey(memberIndex), null, 2)}\n`, { mode: 0o600, flag: "wx" });
  process.stdout.write(`${JSON.stringify({ created: target, memberIndex })}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});

import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const webDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const clientDirectory = resolve(webDirectory, "../client");

for (const directory of [clientDirectory, webDirectory]) {
  const result = spawnSync("npm", ["ci"], { cwd: directory, stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

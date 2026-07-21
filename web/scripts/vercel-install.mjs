import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const webDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const clientDirectory = resolve(webDirectory, "../client");

const installs = [
  { directory: clientDirectory, command: "ci" },
  { directory: webDirectory, command: "install" },
];

for (const { directory, command } of installs) {
  const result = spawnSync("npm", [command], { cwd: directory, stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

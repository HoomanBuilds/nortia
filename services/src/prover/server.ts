import { randomBytes } from "node:crypto";
import { access, cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { PublicKey } from "@solana/web3.js";
import { createShamirShare } from "nortia-client/committee";
import { TREE_DEPTH, fieldHex, merkleRoot, nullifierHash, orderCommitment, poseidonHash, shareCommitment } from "nortia-client/commitments";
import { config } from "../config.js";

const SCALAR_MODULUS = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
const MAX_BODY_BYTES = 16 * 1024;

type PlaceRequest = {
  marketId: string;
  ticketAmount: string;
  payer: string;
  side: boolean;
};

type RedeemRequest = {
  marketId: string;
  ticketAmount: string;
  commitmentRoot: string;
  outcome: boolean;
  recipient: string;
  payoutAmount: string;
  side: boolean;
  secret: string;
  nullifier: string;
  pathBits: boolean[];
  siblings: string[];
};

function randomField() {
  const value = BigInt(`0x${randomBytes(32).toString("hex")}`) % SCALAR_MODULUS;
  return value === 0n ? 1n : value;
}

function littleEndianInteger(value: Uint8Array) {
  return BigInt(`0x${Buffer.from(value).reverse().toString("hex")}`);
}

function payerHash(payer: PublicKey) {
  const bytes = payer.toBytes();
  return poseidonHash(littleEndianInteger(bytes.slice(0, 16)), littleEndianInteger(bytes.slice(16)));
}

function checkedRequest(value: unknown): PlaceRequest {
  if (!value || typeof value !== "object") throw new Error("Invalid proof request");
  const input = value as Partial<PlaceRequest>;
  if (typeof input.marketId !== "string" || !/^\d+$/.test(input.marketId)) throw new Error("marketId must be a decimal integer");
  if (input.ticketAmount !== "1000000") throw new Error("Only the fixed 1 USDC ticket is supported");
  if (typeof input.payer !== "string") throw new Error("payer is required");
  if (typeof input.side !== "boolean") throw new Error("side must be boolean");
  const marketId = BigInt(input.marketId);
  if (marketId <= 0n || marketId > 18_446_744_073_709_551_615n) throw new Error("marketId is outside the u64 range");
  new PublicKey(input.payer);
  return input as PlaceRequest;
}

async function requestJson(request: IncomingMessage) {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const bytes = Buffer.from(chunk);
    size += bytes.length;
    if (size > MAX_BODY_BYTES) throw new Error("Request body is too large");
    chunks.push(bytes);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
}

function field(value: unknown, name: string) {
  if (typeof value !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(value)) throw new Error(`${name} must be a 32-byte field`);
  const parsed = BigInt(value);
  if (parsed >= SCALAR_MODULUS) throw new Error(`${name} exceeds the BN254 scalar field`);
  return parsed;
}

function checkedRedeem(value: unknown): RedeemRequest {
  if (!value || typeof value !== "object") throw new Error("Invalid redeem proof request");
  const input = value as Partial<RedeemRequest>;
  if (typeof input.marketId !== "string" || !/^\d+$/.test(input.marketId)) throw new Error("marketId must be a decimal integer");
  if (input.ticketAmount !== "1000000") throw new Error("Only the fixed 1 USDC ticket is supported");
  if (typeof input.payoutAmount !== "string" || !/^\d+$/.test(input.payoutAmount) || BigInt(input.payoutAmount) <= 0n) throw new Error("payoutAmount must be positive");
  if (typeof input.recipient !== "string") throw new Error("recipient is required");
  if (typeof input.outcome !== "boolean" || typeof input.side !== "boolean") throw new Error("outcome and side must be boolean");
  if (input.side !== input.outcome) throw new Error("A losing position cannot generate a redeem proof");
  if (!Array.isArray(input.pathBits) || input.pathBits.length !== TREE_DEPTH || !input.pathBits.every((item) => typeof item === "boolean")) throw new Error(`pathBits must contain ${TREE_DEPTH} booleans`);
  if (!Array.isArray(input.siblings) || input.siblings.length !== TREE_DEPTH) throw new Error(`siblings must contain ${TREE_DEPTH} fields`);
  const marketId = BigInt(input.marketId);
  if (marketId <= 0n || marketId > 18_446_744_073_709_551_615n) throw new Error("marketId is outside the u64 range");
  new PublicKey(input.recipient);
  field(input.commitmentRoot, "commitmentRoot");
  field(input.secret, "secret");
  field(input.nullifier, "nullifier");
  input.siblings.forEach((item, index) => field(item, `siblings[${index}]`));
  return input as RedeemRequest;
}

function respond(response: ServerResponse, status: number, value: unknown) {
  response.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
  response.end(`${JSON.stringify(value)}\n`);
}

function run(command: string, args: string[], cwd?: string) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
    const errors: Buffer[] = [];
    child.stderr.on("data", (chunk) => errors.push(Buffer.from(chunk)));
    const timer = setTimeout(() => child.kill("SIGKILL"), 180_000);
    child.once("error", reject);
    child.once("exit", (code) => {
      clearTimeout(timer);
      code === 0 ? resolve() : reject(new Error(`${command} exited with ${code}: ${Buffer.concat(errors).toString("utf8").slice(-2_000)}`));
    });
  });
}

async function available(command: string, args: string[]) {
  try {
    await run(command, args);
    return true;
  } catch {
    return false;
  }
}

let queue = Promise.resolve();

async function provePlace(input: PlaceRequest) {
  const marketId = BigInt(input.marketId);
  const ticketAmount = BigInt(input.ticketAmount);
  const payer = new PublicKey(input.payer);
  const secret = randomField();
  const nullifier = randomField();
  const coefficient = randomField();
  const salts = [randomField(), randomField(), randomField()] as const;
  const shares = [1, 2, 3].map((memberIndex) => createShamirShare(input.side, coefficient, memberIndex as 1 | 2 | 3));
  const commitment = orderCommitment(marketId, ticketAmount, input.side, secret, nullifier);
  const shareCommitments = shares.map((share, index) => shareCommitment(share, salts[index] ?? 0n));
  const proverToml = [
    `market_id = "${fieldHex(marketId)}"`,
    `ticket_amount = "${fieldHex(ticketAmount)}"`,
    `payer_hash = "${fieldHex(payerHash(payer))}"`,
    `commitment = "${fieldHex(commitment)}"`,
    ...shareCommitments.map((value, index) => `share_commitment_${index + 1} = "${fieldHex(value)}"`),
    `side = ${input.side}`,
    `secret = "${fieldHex(secret)}"`,
    `nullifier = "${fieldHex(nullifier)}"`,
    `coefficient = "${fieldHex(coefficient)}"`,
    ...salts.map((value, index) => `salt_${index + 1} = "${fieldHex(value)}"`),
    "",
  ].join("\n");

  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "nortia-place-"));
  const packageRoot = path.join(temporaryRoot, "place_order");
  const targetRoot = path.join(packageRoot, "target");
  try {
    await cp(path.join(config.repoRoot, "circuits/place_order"), packageRoot, { recursive: true });
    await mkdir(targetRoot, { recursive: true });
    await writeFile(path.join(packageRoot, "Prover.toml"), proverToml, { mode: 0o600 });
    for (const artifact of ["place_order.json", "place_order.ccs", "place_order.pk"]) {
      await cp(path.join(config.repoRoot, "circuits/target", artifact), path.join(targetRoot, artifact));
    }
    await run("nargo", ["execute"], packageRoot);
    await run("sunspot", [
      "prove",
      "target/place_order.json",
      "target/place_order.gz",
      "target/place_order.ccs",
      "target/place_order.pk",
    ], packageRoot);
    const [proof, publicWitness] = await Promise.all([
      readFile(path.join(targetRoot, "place_order.proof")),
      readFile(path.join(targetRoot, "place_order.pw")),
    ]);
    return {
      commitment: fieldHex(commitment),
      shareCommitments: shareCommitments.map(fieldHex),
      proof: proof.toString("base64"),
      publicWitness: publicWitness.toString("base64"),
      recovery: { secret: fieldHex(secret), nullifier: fieldHex(nullifier) },
      shares: shares.map((share, index) => ({
        memberIndex: index + 1,
        share: fieldHex(share),
        salt: fieldHex(salts[index] ?? 0n),
        expectedShareCommitment: fieldHex(shareCommitments[index] ?? 0n),
      })),
    };
  } finally {
    if (temporaryRoot.startsWith(path.join(os.tmpdir(), "nortia-place-"))) {
      await rm(temporaryRoot, { recursive: true, force: true });
    }
  }
}

async function proveRedeem(input: RedeemRequest) {
  const marketId = BigInt(input.marketId);
  const ticketAmount = BigInt(input.ticketAmount);
  const commitmentRoot = field(input.commitmentRoot, "commitmentRoot");
  const secret = field(input.secret, "secret");
  const nullifier = field(input.nullifier, "nullifier");
  const siblings = input.siblings.map((value, index) => field(value, `siblings[${index}]`));
  const commitment = orderCommitment(marketId, ticketAmount, input.side, secret, nullifier);
  if (merkleRoot(commitment, input.pathBits, siblings) !== commitmentRoot) throw new Error("Position is not included in the submitted commitment root");
  const recipient = new PublicKey(input.recipient);
  const nullifierValue = nullifierHash(marketId, nullifier);
  const proverToml = [
    `market_id = "${fieldHex(marketId)}"`,
    `ticket_amount = "${fieldHex(ticketAmount)}"`,
    `commitment_root = "${fieldHex(commitmentRoot)}"`,
    `outcome = ${input.outcome}`,
    `nullifier_hash = "${fieldHex(nullifierValue)}"`,
    `recipient_hash = "${fieldHex(payerHash(recipient))}"`,
    `payout_amount = "${fieldHex(BigInt(input.payoutAmount))}"`,
    `side = ${input.side}`,
    `secret = "${fieldHex(secret)}"`,
    `nullifier = "${fieldHex(nullifier)}"`,
    `path_bits = [${input.pathBits.join(", ")}]`,
    `siblings = [${siblings.map((value) => `"${fieldHex(value)}"`).join(", ")}]`,
    "",
  ].join("\n");

  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "nortia-redeem-"));
  const packageRoot = path.join(temporaryRoot, "redeem");
  const targetRoot = path.join(packageRoot, "target");
  try {
    await cp(path.join(config.repoRoot, "circuits/redeem"), packageRoot, { recursive: true });
    await mkdir(targetRoot, { recursive: true });
    await writeFile(path.join(packageRoot, "Prover.toml"), proverToml, { mode: 0o600 });
    for (const artifact of ["redeem.json", "redeem.ccs", "redeem.pk"]) {
      await cp(path.join(config.repoRoot, "circuits/target", artifact), path.join(targetRoot, artifact));
    }
    await run("nargo", ["execute"], packageRoot);
    await run("sunspot", ["prove", "target/redeem.json", "target/redeem.gz", "target/redeem.ccs", "target/redeem.pk"], packageRoot);
    const [proof, publicWitness] = await Promise.all([
      readFile(path.join(targetRoot, "redeem.proof")),
      readFile(path.join(targetRoot, "redeem.pw")),
    ]);
    return {
      nullifierHash: fieldHex(nullifierValue),
      proof: proof.toString("base64"),
      publicWitness: publicWitness.toString("base64"),
    };
  } finally {
    if (temporaryRoot.startsWith(path.join(os.tmpdir(), "nortia-redeem-"))) {
      await rm(temporaryRoot, { recursive: true, force: true });
    }
  }
}

async function main() {
  if (!config.proverApiToken || config.proverApiToken.length < 24) {
    throw new Error("PROVER_API_TOKEN must be configured with at least 24 characters");
  }
  const artifacts = ["place_order.json", "place_order.ccs", "place_order.pk", "redeem.json", "redeem.ccs", "redeem.pk"];
  for (const artifact of artifacts) await access(path.join(config.repoRoot, "circuits/target", artifact));

  const server = createServer(async (request, response) => {
    try {
      if (request.method === "GET" && request.url === "/health") {
        const [nargo, sunspot] = await Promise.all([available("nargo", ["--version"]), available("sunspot", ["--help"])]);
        respond(response, nargo && sunspot ? 200 : 503, { ok: nargo && sunspot, nargo, sunspot });
        return;
      }
      if (request.method !== "POST" || (request.url !== "/place" && request.url !== "/redeem")) {
        respond(response, 404, { error: "Not found" });
        return;
      }
      if (request.headers.authorization !== `Bearer ${config.proverApiToken}`) {
        respond(response, 401, { error: "Unauthorized" });
        return;
      }
      const value = await requestJson(request);
      const work = request.url === "/place"
        ? queue.then(() => provePlace(checkedRequest(value)))
        : queue.then(() => proveRedeem(checkedRedeem(value)));
      queue = work.then(() => undefined, () => undefined);
      respond(response, 200, await work);
    } catch (error) {
      respond(response, 400, { error: error instanceof Error ? error.message : String(error) });
    }
  });
  server.listen(config.proverPort, "127.0.0.1", () => {
    process.stdout.write(`${JSON.stringify({ event: "prover-listening", port: config.proverPort })}\n`);
  });
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});

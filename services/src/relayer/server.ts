import { timingSafeEqual } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import BN from "bn.js";
import { ComputeBudgetProgram, Connection, PublicKey, SystemProgram } from "@solana/web3.js";
import { config } from "../config.js";
import { createProgram, phaseName, readKeypair } from "../solana.js";
import { checkedRelayRedeem, type RelayRedeemRequest } from "./requests.js";

const MAX_BODY_BYTES = 4 * 1024;
const MAX_PENDING_REDEMPTIONS = 8;

function authorized(value: string | undefined) {
  const expected = Buffer.from(`Bearer ${config.relayerApiToken ?? ""}`);
  const actual = Buffer.from(value ?? "");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
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

function respond(response: ServerResponse, status: number, value: unknown) {
  response.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(`${JSON.stringify(value)}\n`);
}

function fieldBytes(value: string) {
  return Array.from(Buffer.from(value.slice(2), "hex"));
}

async function main() {
  if (!config.relayerApiToken || config.relayerApiToken.length < 24) {
    throw new Error("RELAYER_API_TOKEN must be configured with at least 24 characters");
  }
  if (!config.relayerKeypairPath) throw new Error("NORTIA_RELAYER_KEYPAIR_PATH is required");
  const relayer = await readKeypair(config.relayerKeypairPath);
  const connection = new Connection(config.rpcUrl, "confirmed");
  const program = createProgram(connection, relayer);
  let queue = Promise.resolve();
  let pendingRedemptions = 0;

  async function relay(input: RelayRedeemRequest) {
    const market = new PublicKey(input.market);
    const recipient = new PublicKey(input.recipient);
    const account = await program.account.market.fetch(market);
    if (phaseName(account.phase) !== "resolved") throw new Error("Market is not ready for redemption");
    const nullifierHash = fieldBytes(input.nullifierHash);
    const claim = PublicKey.findProgramAddressSync(
      [Buffer.from("claim"), market.toBuffer(), Buffer.from(nullifierHash)],
      program.programId,
    )[0];
    if (await connection.getAccountInfo(claim, "confirmed")) throw new Error("Position has already been redeemed");
    const recipientToken = getAssociatedTokenAddressSync(account.collateralMint, recipient);
    const vault = PublicKey.findProgramAddressSync([Buffer.from("vault"), market.toBuffer()], program.programId)[0];
    return program.methods.redeem({
      nullifierHash,
      payoutAmount: new BN(input.payoutAmount),
      proof: Buffer.from(input.proof, "base64"),
      publicWitness: Buffer.from(input.publicWitness, "base64"),
    }).accountsPartial({
      relayer: relayer.publicKey,
      market,
      collateralMint: account.collateralMint,
      claim,
      vault,
      recipientOwner: recipient,
      recipientToken,
      redeemVerifier: account.redeemVerifier,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    }).preInstructions([
      ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }),
      createAssociatedTokenAccountIdempotentInstruction(
        relayer.publicKey,
        recipientToken,
        recipient,
        account.collateralMint,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID,
      ),
    ]).rpc();
  }

  const server = createServer(async (request, response) => {
    if (request.method === "GET" && request.url === "/health") {
      const balance = await connection.getBalance(relayer.publicKey, "confirmed").catch(() => 0);
      respond(response, balance > 0 ? 200 : 503, { ok: balance > 0, relayer: relayer.publicKey.toBase58(), funded: balance > 0 });
      return;
    }
    if (request.method !== "POST" || request.url !== "/redeem") {
      respond(response, 404, { error: "Not found" });
      return;
    }
    if (!authorized(request.headers.authorization)) {
      respond(response, 401, { error: "Unauthorized" });
      return;
    }
    if (pendingRedemptions >= MAX_PENDING_REDEMPTIONS) {
      respond(response, 429, { error: "Relay queue is full" });
      return;
    }
    try {
      const input = checkedRelayRedeem(await requestJson(request));
      pendingRedemptions += 1;
      const work = queue.then(() => relay(input)).finally(() => { pendingRedemptions -= 1; });
      queue = work.then(() => undefined, () => undefined);
      const signature = await work;
      process.stdout.write(`${JSON.stringify({ event: "redemption-relayed", signature })}\n`);
      respond(response, 200, { signature, recipient: input.recipient });
    } catch (error) {
      process.stderr.write(`${JSON.stringify({ event: "redemption-rejected", reason: error instanceof Error ? error.message : String(error) })}\n`);
      respond(response, 400, { error: "Relay transaction was rejected" });
    }
  });
  server.listen(config.relayerPort, "127.0.0.1", () => {
    process.stdout.write(`${JSON.stringify({ event: "relayer-listening", port: config.relayerPort, relayer: relayer.publicKey.toBase58() })}\n`);
  });
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});

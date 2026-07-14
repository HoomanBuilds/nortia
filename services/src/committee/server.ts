import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { BorshAccountsCoder, type Idl } from "@anchor-lang/core";
import { Connection, PublicKey } from "@solana/web3.js";
import { CommitteeMember, type CommitteeShare } from "nortia-client/committee";
import { config } from "../config.js";
import idl from "../idl/nortia.json" with { type: "json" };

const NORTIA_PROGRAM = new PublicKey("4S2EvdGrbKJ9zazvB4gtR83crTrVJWqqwoVVvEQy8VE9");
const MAX_BODY_BYTES = 64 * 1024;

type EncodedShare = Omit<CommitteeShare, "orderCommitment" | "share" | "salt" | "expectedShareCommitment"> & {
  orderCommitment: string;
  share: string;
  salt: string;
  expectedShareCommitment: string;
};

type OrderAccount = {
  market: PublicKey;
  order_index: number;
  commitment: number[];
  share_commitments: number[][];
};

function fieldBytes(value: bigint) {
  if (value < 0n) throw new Error("Field values must be non-negative");
  return Buffer.from(value.toString(16).padStart(64, "0"), "hex");
}

function encode(share: CommitteeShare): EncodedShare {
  return {
    ...share,
    orderCommitment: share.orderCommitment.toString(),
    share: share.share.toString(),
    salt: share.salt.toString(),
    expectedShareCommitment: share.expectedShareCommitment.toString(),
  };
}

function decode(value: EncodedShare): CommitteeShare {
  return {
    ...value,
    orderCommitment: BigInt(value.orderCommitment),
    share: BigInt(value.share),
    salt: BigInt(value.salt),
    expectedShareCommitment: BigInt(value.expectedShareCommitment),
  };
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
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as EncodedShare;
}

function respond(response: ServerResponse, status: number, value: unknown) {
  response.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
  response.end(`${JSON.stringify(value)}\n`);
}

async function main() {
  const member = new CommitteeMember(config.committeeMemberIndex);
  const connection = new Connection(config.rpcUrl, "confirmed");
  const coder = new BorshAccountsCoder(idl as Idl);

  try {
    const stored = JSON.parse(await readFile(config.committeeStatePath, "utf8")) as EncodedShare[];
    for (const share of stored) member.submit(decode(share));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }

  const verifyOnchainOrder = async (share: CommitteeShare) => {
    const market = new PublicKey(share.market);
    const commitment = fieldBytes(share.orderCommitment);
    const [orderAddress] = PublicKey.findProgramAddressSync(
      [Buffer.from("order"), market.toBuffer(), commitment],
      NORTIA_PROGRAM,
    );
    const orderInfo = await connection.getAccountInfo(orderAddress, "confirmed");
    if (!orderInfo || !orderInfo.owner.equals(NORTIA_PROGRAM)) throw new Error("Onchain order account was not found");
    const order = coder.decode("Order", orderInfo.data) as OrderAccount;
    if (!order.market.equals(market)) throw new Error("Onchain order belongs to a different market");
    if (order.order_index !== share.orderIndex) throw new Error("Onchain order index does not match");
    if (!Buffer.from(order.commitment).equals(commitment)) throw new Error("Onchain order commitment does not match");
    const expected = order.share_commitments[share.memberIndex - 1];
    if (!expected || !Buffer.from(expected).equals(fieldBytes(share.expectedShareCommitment))) {
      throw new Error("Onchain share commitment does not match this committee member");
    }
    const transaction = await connection.getTransaction(share.placementSignature, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    });
    if (!transaction || transaction.meta?.err) throw new Error("Placement transaction is missing or failed");
    const invocation = `Program ${NORTIA_PROGRAM.toBase58()} invoke`;
    if (!transaction.meta?.logMessages?.some((line) => line.startsWith(invocation))) {
      throw new Error("Placement transaction did not invoke Nortia");
    }
  };

  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
      if (request.method === "GET" && url.pathname === "/health") {
        respond(response, 200, { ok: true, memberIndex: member.memberIndex, network: "solana-devnet" });
        return;
      }
      const match = url.pathname.match(/^\/markets\/([^/]+)\/snapshot$/);
      if (request.method === "GET" && match) {
        respond(response, 200, member.snapshot(decodeURIComponent(match[1] ?? "")).map(encode));
        return;
      }
      if (request.method === "POST" && url.pathname === "/shares") {
        const share = decode(await requestJson(request));
        if (share.memberIndex !== member.memberIndex) throw new Error("Share was sent to the wrong member service");
        await verifyOnchainOrder(share);
        member.submit(share);
        const existing = JSON.parse(await readFile(config.committeeStatePath, "utf8").catch(() => "[]")) as EncodedShare[];
        const allMarkets = new Set(existing.map((item) => item.market));
        allMarkets.add(share.market);
        await mkdir(path.dirname(config.committeeStatePath), { recursive: true });
        const temporary = `${config.committeeStatePath}.tmp`;
        const snapshot = [...allMarkets].flatMap((market) => member.snapshot(market)).map(encode);
        await writeFile(temporary, `${JSON.stringify(snapshot, null, 2)}\n`, { mode: 0o600 });
        await rename(temporary, config.committeeStatePath);
        respond(response, 202, { accepted: true, orderIndex: share.orderIndex });
        return;
      }
      respond(response, 404, { error: "Not found" });
    } catch (error) {
      respond(response, 400, { error: error instanceof Error ? error.message : String(error) });
    }
  });

  server.listen(config.committeePort, "127.0.0.1", () => {
    process.stdout.write(`${JSON.stringify({ event: "committee-listening", memberIndex: member.memberIndex, port: config.committeePort })}\n`);
  });
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});

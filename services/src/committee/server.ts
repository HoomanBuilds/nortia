import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { timingSafeEqual } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { BorshAccountsCoder, type Idl } from "@anchor-lang/core";
import { Connection, PublicKey } from "@solana/web3.js";
import { CommitteeMember, MIN_PRIVATE_BATCH_ORDERS, type CommitteeAggregate, type CommitteeShare } from "nortia-client/committee";
import { config } from "../config.js";
import idl from "../idl/nortia.json" with { type: "json" };
import { openCommitteeShare, readCommitteeEncryptionKey, type CommitteeEnvelope } from "./encryption.js";
import { openCommitteeState, sealCommitteeState } from "./state.js";

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

type MarketAccount = {
  lock_ts: { toNumber(): number };
  batch_deadline_ts: { toNumber(): number };
  order_count: number;
  phase: Record<string, unknown>;
};

type EncodedAggregate = Omit<CommitteeAggregate, "aggregateShare" | "orderCommitments"> & {
  aggregateShare: string;
  orderCommitments: string[];
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

function encodeAggregate(aggregate: CommitteeAggregate): EncodedAggregate {
  return {
    ...aggregate,
    aggregateShare: aggregate.aggregateShare.toString(),
    orderCommitments: aggregate.orderCommitments.map((value) => value.toString()),
  };
}

function authorized(request: IncomingMessage) {
  const expected = Buffer.from(`Bearer ${config.committeeApiToken ?? ""}`);
  const supplied = Buffer.from(request.headers.authorization ?? "");
  return expected.length === supplied.length && expected.length > 7 && timingSafeEqual(expected, supplied);
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
  response.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
  response.end(`${JSON.stringify(value)}\n`);
}

async function main() {
  if (!config.committeeApiToken || config.committeeApiToken.length < 24) {
    throw new Error("COMMITTEE_API_TOKEN must be configured with at least 24 characters");
  }
  if (!config.committeeStateKey || !/^[0-9a-fA-F]{64}$/.test(config.committeeStateKey)) {
    throw new Error("COMMITTEE_STATE_KEY must be configured as 64 hex characters");
  }
  if (!config.committeeEncryptionKeyPath) throw new Error("COMMITTEE_ENCRYPTION_KEY_PATH is required");
  const member = new CommitteeMember(config.committeeMemberIndex);
  const encryptionKey = await readCommitteeEncryptionKey(config.committeeEncryptionKeyPath, member.memberIndex);
  const connection = new Connection(config.rpcUrl, "confirmed");
  const coder = new BorshAccountsCoder(idl as Idl);
  const allMarkets = new Set<string>();

  const persist = async () => {
    await mkdir(path.dirname(config.committeeStatePath), { recursive: true });
    const temporary = `${config.committeeStatePath}.tmp`;
    const snapshot = [...allMarkets].flatMap((market) => member.snapshot(market)).map(encode);
    await writeFile(temporary, sealCommitteeState(snapshot, config.committeeStateKey!, member.memberIndex), { mode: 0o600 });
    await rename(temporary, config.committeeStatePath);
  };

  try {
    const opened = openCommitteeState(await readFile(config.committeeStatePath, "utf8"), config.committeeStateKey, member.memberIndex);
    if (!Array.isArray(opened.value)) throw new Error("Committee state payload is invalid");
    const stored = opened.value as EncodedShare[];
    for (const share of stored) member.submit(decode(share));
    for (const share of stored) allMarkets.add(share.market);
    if (opened.legacy) await persist();
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
      if (!authorized(request)) {
        respond(response, 401, { error: "Unauthorized" });
        return;
      }
      if (request.method === "GET" && url.pathname === "/encryption-key") {
        respond(response, 200, { memberIndex: member.memberIndex, publicKey: encryptionKey.publicKey });
        return;
      }
      const match = url.pathname.match(/^\/markets\/([^/]+)\/aggregate$/);
      if (request.method === "POST" && match) {
        const marketValue = decodeURIComponent(match[1] ?? "");
        const marketAddress = new PublicKey(marketValue);
        const marketInfo = await connection.getAccountInfo(marketAddress, "confirmed");
        if (!marketInfo || !marketInfo.owner.equals(NORTIA_PROGRAM)) throw new Error("Onchain market account was not found");
        const market = coder.decode("Market", marketInfo.data) as MarketAccount;
        if (!("Open" in market.phase)) throw new Error("Market is not open for batching");
        if (Math.floor(Date.now() / 1_000) < market.lock_ts.toNumber()) throw new Error("Market is not locked yet");
        const localCount = member.snapshot(marketValue).length;
        if (localCount < MIN_PRIVATE_BATCH_ORDERS) {
          respond(response, 409, { error: "insufficient-privacy-set", orderCount: localCount });
          return;
        }
        const aggregate = member.aggregate(marketValue);
        if (aggregate.orderCount !== market.order_count) throw new Error("Committee member is missing accepted orders");
        respond(response, 200, encodeAggregate(aggregate));
        return;
      }
      if (request.method === "POST" && url.pathname === "/shares") {
        const envelope = await requestJson(request) as CommitteeEnvelope;
        const share = decode(await openCommitteeShare(envelope, encryptionKey.privateKey, member.memberIndex) as EncodedShare);
        if (share.memberIndex !== member.memberIndex) throw new Error("Share was sent to the wrong member service");
        await verifyOnchainOrder(share);
        member.submit(share);
        allMarkets.add(share.market);
        await persist();
        respond(response, 202, { accepted: true, orderIndex: share.orderIndex });
        return;
      }
      const purgeMatch = url.pathname.match(/^\/markets\/([^/]+)\/shares$/);
      if (request.method === "DELETE" && purgeMatch) {
        const marketValue = decodeURIComponent(purgeMatch[1] ?? "");
        const marketAddress = new PublicKey(marketValue);
        const marketInfo = await connection.getAccountInfo(marketAddress, "confirmed");
        if (!marketInfo || !marketInfo.owner.equals(NORTIA_PROGRAM)) throw new Error("Onchain market account was not found");
        const market = coder.decode("Market", marketInfo.data) as MarketAccount;
        const now = Math.floor(Date.now() / 1_000);
        if ("Open" in market.phase && now <= market.batch_deadline_ts.toNumber()) {
          throw new Error("Committee shares cannot be purged before batching closes");
        }
        const removed = member.clearMarket(marketValue);
        allMarkets.delete(marketValue);
        await persist();
        respond(response, 200, { purged: removed });
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

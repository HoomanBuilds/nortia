import { Connection, PublicKey } from "@solana/web3.js";
import {
  finalizeCommitteeAggregates,
  type CommitteeAggregate,
} from "nortia-client/committee";
import { config } from "../config.js";
import { createProgram, readKeypair } from "../solana.js";

type EncodedAggregate = Omit<CommitteeAggregate, "aggregateShare" | "orderCommitments"> & {
  aggregateShare: string;
  orderCommitments: string[];
};

class IneligiblePrivateBatchError extends Error {}

function decode(value: EncodedAggregate): CommitteeAggregate {
  return {
    ...value,
    aggregateShare: BigInt(value.aggregateShare),
    orderCommitments: value.orderCommitments.map(BigInt),
  };
}

function fieldBytes(value: bigint) {
  if (value < 0n) throw new Error("Field values must be non-negative");
  return Array.from(Buffer.from(value.toString(16).padStart(64, "0"), "hex"));
}

async function memberAggregate(endpoint: string, market: string) {
  const response = await fetch(`${endpoint.replace(/\/$/, "")}/markets/${encodeURIComponent(market)}/aggregate`, {
    method: "POST",
    headers: { Authorization: `Bearer ${config.committeeApiToken}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (response.status === 409) throw new IneligiblePrivateBatchError("Private batch does not meet the minimum anonymity set");
  if (!response.ok) throw new Error(`Committee aggregate failed with ${response.status}`);
  return decode(await response.json() as EncodedAggregate);
}

async function purgeMember(endpoint: string, market: string) {
  const response = await fetch(`${endpoint.replace(/\/$/, "")}/markets/${encodeURIComponent(market)}/shares`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${config.committeeApiToken}` },
    signal: AbortSignal.timeout(10_000),
  });
  return response.ok;
}

async function purgeAll(market: string) {
  return Promise.all(config.committeeEndpoints.map((endpoint) => purgeMember(endpoint, market)));
}

async function main() {
  const marketValue = process.argv[2];
  if (!marketValue) throw new Error("Usage: npm run committee:batch -- <market-address>");
  if (!config.keypairPath) throw new Error("NORTIA_KEYPAIR_PATH is required as the transaction payer");
  if (config.committeeEndpoints.length !== 3 || config.committeeKeypairPaths.length < 2) {
    throw new Error("Three committee endpoints and two committee keypair paths are required");
  }
  if (!config.committeeApiToken || config.committeeApiToken.length < 24) {
    throw new Error("COMMITTEE_API_TOKEN must be configured with at least 24 characters");
  }

  const market = new PublicKey(marketValue);
  let batch;
  try {
    const [first, second] = await Promise.all([
      memberAggregate(config.committeeEndpoints[0] ?? "", marketValue),
      memberAggregate(config.committeeEndpoints[1] ?? "", marketValue),
    ]);
    batch = finalizeCommitteeAggregates(marketValue, first, second);
  } catch (error) {
    if (!(error instanceof IneligiblePrivateBatchError) && !(error instanceof Error && error.message.includes("one-sided"))) throw error;
    const purged = await purgeAll(marketValue);
    process.stdout.write(`${JSON.stringify({ event: "batch-ineligible", market: marketValue, reason: error.message, purged })}\n`);
    return;
  }
  const payer = await readKeypair(config.keypairPath);
  const signers = await Promise.all(config.committeeKeypairPaths.slice(0, 2).map(readKeypair));
  const connection = new Connection(config.rpcUrl, "confirmed");
  const program = createProgram(connection, payer);
  const signature = await program.methods.submitBatch({
    commitmentRoot: fieldBytes(batch.commitmentRoot),
    yesCount: batch.yesCount,
    noCount: batch.noCount,
  }).accountsPartial({ market }).remainingAccounts(
    signers.map((signer) => ({ pubkey: signer.publicKey, isSigner: true, isWritable: false })),
  ).signers(signers).rpc();
  const purged = await purgeAll(marketValue);
  process.stdout.write(`${JSON.stringify({ event: "batch-submitted", market: marketValue, signature, yesCount: batch.yesCount, noCount: batch.noCount, purged })}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});

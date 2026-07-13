import { Connection, PublicKey } from "@solana/web3.js";
import {
  CommitteeMember,
  finalizeCommitteeBatch,
  type CommitteeShare,
} from "nortia-client/committee";
import { config } from "../config.js";
import { createProgram, readKeypair } from "../solana.js";

type EncodedShare = Omit<CommitteeShare, "orderCommitment" | "share" | "salt" | "expectedShareCommitment"> & {
  orderCommitment: string;
  share: string;
  salt: string;
  expectedShareCommitment: string;
};

function decode(value: EncodedShare): CommitteeShare {
  return {
    ...value,
    orderCommitment: BigInt(value.orderCommitment),
    share: BigInt(value.share),
    salt: BigInt(value.salt),
    expectedShareCommitment: BigInt(value.expectedShareCommitment),
  };
}

function fieldBytes(value: bigint) {
  if (value < 0n) throw new Error("Field values must be non-negative");
  return Array.from(Buffer.from(value.toString(16).padStart(64, "0"), "hex"));
}

async function memberSnapshot(endpoint: string, market: string) {
  const response = await fetch(`${endpoint.replace(/\/$/, "")}/markets/${encodeURIComponent(market)}/snapshot`, {
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Committee snapshot failed with ${response.status}`);
  const shares = await response.json() as EncodedShare[];
  if (shares.length === 0) throw new Error("Committee member has no shares for this market");
  const member = new CommitteeMember(shares[0]?.memberIndex ?? 1);
  for (const share of shares) member.submit(decode(share));
  return member;
}

async function main() {
  const marketValue = process.argv[2];
  if (!marketValue) throw new Error("Usage: npm run committee:batch -- <market-address>");
  if (!config.keypairPath) throw new Error("NORTIA_KEYPAIR_PATH is required as the transaction payer");
  if (config.committeeEndpoints.length < 2 || config.committeeKeypairPaths.length < 2) {
    throw new Error("Two committee endpoints and two committee keypair paths are required");
  }

  const market = new PublicKey(marketValue);
  const [first, second] = await Promise.all([
    memberSnapshot(config.committeeEndpoints[0] ?? "", marketValue),
    memberSnapshot(config.committeeEndpoints[1] ?? "", marketValue),
  ]);
  const batch = finalizeCommitteeBatch(marketValue, first, second);
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
  process.stdout.write(`${JSON.stringify({ event: "batch-submitted", market: marketValue, signature, yesCount: batch.yesCount, noCount: batch.noCount })}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});

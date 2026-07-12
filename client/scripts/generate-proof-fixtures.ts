import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  TREE_DEPTH,
  fieldHex,
  merkleRoot,
  nullifierHash,
  orderCommitment,
  shareCommitment,
} from "../src/commitments.js";

const marketId = 42n;
const ticketAmount = 1_000_000n;
const payerHash = 91n;
const side = true;
const secret = 11n;
const nullifier = 12n;
const coefficient = 13n;
const salts = [21n, 22n, 23n] as const;
const shares = [
  1n + coefficient,
  1n + coefficient * 2n,
  1n + coefficient * 3n,
] as const;
const commitment = orderCommitment(
  marketId,
  ticketAmount,
  side,
  secret,
  nullifier,
);

const placementToml = [
  `market_id = "${fieldHex(marketId)}"`,
  `ticket_amount = "${fieldHex(ticketAmount)}"`,
  `payer_hash = "${fieldHex(payerHash)}"`,
  `commitment = "${fieldHex(commitment)}"`,
  `share_commitment_1 = "${fieldHex(shareCommitment(shares[0], salts[0]))}"`,
  `share_commitment_2 = "${fieldHex(shareCommitment(shares[1], salts[1]))}"`,
  `share_commitment_3 = "${fieldHex(shareCommitment(shares[2], salts[2]))}"`,
  `side = ${side}`,
  `secret = "${fieldHex(secret)}"`,
  `nullifier = "${fieldHex(nullifier)}"`,
  `coefficient = "${fieldHex(coefficient)}"`,
  `salt_1 = "${fieldHex(salts[0])}"`,
  `salt_2 = "${fieldHex(salts[1])}"`,
  `salt_3 = "${fieldHex(salts[2])}"`,
  "",
].join("\n");

const pathBits = Array<boolean>(TREE_DEPTH).fill(false);
const siblings = Array<bigint>(TREE_DEPTH).fill(0n);
const root = merkleRoot(commitment, pathBits, siblings);
const redemptionToml = [
  `market_id = "${fieldHex(marketId)}"`,
  `ticket_amount = "${fieldHex(ticketAmount)}"`,
  `commitment_root = "${fieldHex(root)}"`,
  `outcome = ${side}`,
  `nullifier_hash = "${fieldHex(nullifierHash(marketId, nullifier))}"`,
  `recipient_hash = "${fieldHex(91n)}"`,
  `payout_amount = "${fieldHex(1_485_000n)}"`,
  `side = ${side}`,
  `secret = "${fieldHex(secret)}"`,
  `nullifier = "${fieldHex(nullifier)}"`,
  `path_bits = [${pathBits.join(", ")}]`,
  `siblings = [${siblings.map((value) => `"${fieldHex(value)}"`).join(", ")}]`,
  "",
].join("\n");

await Promise.all([
  writeFile(resolve("circuits/place_order/Prover.toml"), placementToml),
  writeFile(resolve("circuits/redeem/Prover.toml"), redemptionToml),
]);

console.log("Generated deterministic local proof fixtures.");

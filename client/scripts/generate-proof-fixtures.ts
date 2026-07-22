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
const stakeAmount = 100_000_000n;
const amount = 37_000_000n;
const payerHash = 91n;
const side = true;
const secret = 11n;
const nullifier = 12n;
const sideCoefficient = 13n;
const yesAmountCoefficient = 14n;
const totalAmountCoefficient = 15n;
const salts = [21n, 22n, 23n] as const;
const bundles = [1n, 2n, 3n].map((index) => ({
  sideShare: 1n + sideCoefficient * index,
  yesAmountShare: amount + yesAmountCoefficient * index,
  totalAmountShare: amount + totalAmountCoefficient * index,
}));
const commitment = orderCommitment(
  marketId,
  stakeAmount,
  amount,
  side,
  secret,
  nullifier,
);

const placementToml = [
  `market_id = "${fieldHex(marketId)}"`,
  `stake_amount = "${fieldHex(stakeAmount)}"`,
  `payer_hash = "${fieldHex(payerHash)}"`,
  `commitment = "${fieldHex(commitment)}"`,
  ...bundles.map((bundle, index) => `share_commitment_${index + 1} = "${fieldHex(shareCommitment(bundle.sideShare, bundle.yesAmountShare, bundle.totalAmountShare, salts[index] ?? 0n))}"`),
  `amount = ${amount}`,
  `side = ${side}`,
  `secret = "${fieldHex(secret)}"`,
  `nullifier = "${fieldHex(nullifier)}"`,
  `side_coefficient = "${fieldHex(sideCoefficient)}"`,
  `yes_amount_coefficient = "${fieldHex(yesAmountCoefficient)}"`,
  `total_amount_coefficient = "${fieldHex(totalAmountCoefficient)}"`,
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
  `stake_amount = "${fieldHex(stakeAmount)}"`,
  `commitment_root = "${fieldHex(root)}"`,
  `outcome = ${side}`,
  `nullifier_hash = "${fieldHex(nullifierHash(marketId, nullifier))}"`,
  `recipient_hash = "${fieldHex(91n)}"`,
  `net_pool = "${fieldHex(99_000_000n)}"`,
  `winning_amount = "${fieldHex(50_000_000n)}"`,
  `payout_amount = "${fieldHex(136_260_000n)}"`,
  `amount = ${amount}`,
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

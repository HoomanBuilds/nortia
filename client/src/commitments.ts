import { poseidon2 } from "poseidon-lite";

export const TREE_DEPTH = 16;

export function poseidonHash(left: bigint, right: bigint): bigint {
  return poseidon2([left, right]);
}

export function orderCommitment(
  marketId: bigint,
  stakeAmount: bigint,
  amount: bigint,
  side: boolean,
  secret: bigint,
  nullifier: bigint,
): bigint {
  const context = poseidonHash(marketId, stakeAmount);
  const position = poseidonHash(amount, side ? 1n : 0n);
  return poseidonHash(context, poseidonHash(position, poseidonHash(secret, nullifier)));
}

export function shareCommitment(
  sideShare: bigint,
  yesAmountShare: bigint,
  totalAmountShare: bigint,
  salt: bigint,
): bigint {
  return poseidonHash(
    poseidonHash(sideShare, yesAmountShare),
    poseidonHash(totalAmountShare, salt),
  );
}

export function nullifierHash(marketId: bigint, nullifier: bigint): bigint {
  return poseidonHash(marketId, nullifier);
}

export function merkleRoot(
  leaf: bigint,
  pathBits: readonly boolean[],
  siblings: readonly bigint[],
): bigint {
  if (pathBits.length !== TREE_DEPTH || siblings.length !== TREE_DEPTH) {
    throw new Error(`expected Merkle depth ${TREE_DEPTH}`);
  }
  return siblings.reduce(
    (current, sibling, index) =>
      pathBits[index]
        ? poseidonHash(sibling, current)
        : poseidonHash(current, sibling),
    leaf,
  );
}

export function fieldHex(value: bigint): string {
  if (value < 0n) {
    throw new Error("field values cannot be negative");
  }
  return `0x${value.toString(16).padStart(64, "0")}`;
}

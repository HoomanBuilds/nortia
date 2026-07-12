import { poseidon2 } from "poseidon-lite";

export const TREE_DEPTH = 16;

export function poseidonHash(left: bigint, right: bigint): bigint {
  return poseidon2([left, right]);
}

export function orderCommitment(
  marketId: bigint,
  ticketAmount: bigint,
  side: boolean,
  secret: bigint,
  nullifier: bigint,
): bigint {
  const context = poseidonHash(marketId, ticketAmount);
  const position = poseidonHash(side ? 1n : 0n, secret);
  return poseidonHash(context, poseidonHash(position, nullifier));
}

export function shareCommitment(share: bigint, salt: bigint): bigint {
  return poseidonHash(share, salt);
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

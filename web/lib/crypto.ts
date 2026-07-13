import { poseidon2 } from "poseidon-lite";

export const TREE_DEPTH = 16;

export function poseidonHash(left: bigint, right: bigint) {
  return poseidon2([left, right]);
}

export function fieldBigInt(value: readonly number[] | Uint8Array | string) {
  if (typeof value === "string") return BigInt(value);
  return BigInt(`0x${Buffer.from(value).toString("hex")}`);
}

export function fieldHex(value: bigint) {
  return `0x${value.toString(16).padStart(64, "0")}`;
}

function zeroHashes() {
  const values = [0n];
  for (let level = 0; level < TREE_DEPTH; level += 1) values.push(poseidonHash(values[level] ?? 0n, values[level] ?? 0n));
  return values;
}

export function commitmentPath(leaves: readonly bigint[], leafIndex: number) {
  if (!Number.isInteger(leafIndex) || leafIndex < 0 || leafIndex >= leaves.length) throw new Error("Commitment is not present in the market batch");
  if (leaves.length > 2 ** TREE_DEPTH) throw new Error("Market commitment tree exceeds the circuit depth");
  const zeros = zeroHashes();
  const pathBits: boolean[] = [];
  const siblings: bigint[] = [];
  let index = leafIndex;
  let levelNodes = [...leaves];

  for (let level = 0; level < TREE_DEPTH; level += 1) {
    const isRight = index % 2 === 1;
    pathBits.push(isRight);
    siblings.push(levelNodes[isRight ? index - 1 : index + 1] ?? zeros[level] ?? 0n);
    const parents: bigint[] = [];
    const parentCount = Math.max(1, Math.ceil(levelNodes.length / 2));
    for (let parent = 0; parent < parentCount; parent += 1) {
      const empty = zeros[level] ?? 0n;
      parents.push(poseidonHash(levelNodes[parent * 2] ?? empty, levelNodes[parent * 2 + 1] ?? empty));
    }
    levelNodes = parents;
    index = Math.floor(index / 2);
  }
  return { pathBits, siblings, root: levelNodes[0] ?? zeros[TREE_DEPTH] ?? 0n };
}

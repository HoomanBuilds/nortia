import { poseidon2 } from "poseidon-lite";

export const TREE_DEPTH = 16;
export const BN254_SCALAR_MODULUS = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;

export type PlacementWitness = {
  secret: string;
  nullifier: string;
  sideCoefficient: string;
  yesAmountCoefficient: string;
  totalAmountCoefficient: string;
  salts: [string, string, string];
};

export function poseidonHash(left: bigint, right: bigint) {
  return poseidon2([left, right]);
}

function bigEndianInteger(bytes: readonly number[] | Uint8Array) {
  let value = 0n;
  for (const byte of bytes) value = (value << 8n) | BigInt(byte);
  return value;
}

function littleEndianInteger(bytes: readonly number[] | Uint8Array) {
  let value = 0n;
  for (let index = bytes.length - 1; index >= 0; index -= 1) value = (value << 8n) | BigInt(bytes[index] ?? 0);
  return value;
}

export function fieldBigInt(value: readonly number[] | Uint8Array | string) {
  if (typeof value === "string") return BigInt(value);
  return bigEndianInteger(value);
}

export function fieldHex(value: bigint) {
  return `0x${value.toString(16).padStart(64, "0")}`;
}

export function randomFieldHex() {
  if (!globalThis.crypto?.getRandomValues) throw new Error("Secure browser randomness is unavailable");
  for (;;) {
    const bytes = globalThis.crypto.getRandomValues(new Uint8Array(32));
    const value = bigEndianInteger(bytes);
    if (value > 0n && value < BN254_SCALAR_MODULUS) return fieldHex(value);
  }
}

export function solanaPublicKeyHash(bytes: Uint8Array) {
  if (bytes.length !== 32) throw new Error("Solana public key must contain 32 bytes");
  return poseidonHash(littleEndianInteger(bytes.slice(0, 16)), littleEndianInteger(bytes.slice(16)));
}

export function createPlacementWitness(): PlacementWitness {
  return {
    secret: randomFieldHex(),
    nullifier: randomFieldHex(),
    sideCoefficient: randomFieldHex(),
    yesAmountCoefficient: randomFieldHex(),
    totalAmountCoefficient: randomFieldHex(),
    salts: [randomFieldHex(), randomFieldHex(), randomFieldHex()],
  };
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

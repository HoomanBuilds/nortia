import { poseidonHash, shareCommitment, TREE_DEPTH } from "./commitments.js";

export const BN254_SCALAR_MODULUS =
  21888242871839275222246405745257275088548364400416034343698204186575808495617n;

export type CommitteeShare = {
  market: string;
  orderIndex: number;
  orderCommitment: bigint;
  memberIndex: 1 | 2 | 3;
  share: bigint;
  salt: bigint;
  expectedShareCommitment: bigint;
  placementSignature: string;
};

export type CommitteeBatch = {
  market: string;
  orderCount: number;
  yesCount: number;
  noCount: number;
  commitmentRoot: bigint;
  memberIndices: readonly [number, number];
};

function mod(value: bigint): bigint {
  const reduced = value % BN254_SCALAR_MODULUS;
  return reduced >= 0n ? reduced : reduced + BN254_SCALAR_MODULUS;
}

function inverse(value: bigint): bigint {
  let exponent = BN254_SCALAR_MODULUS - 2n;
  let base = mod(value);
  let result = 1n;

  if (base === 0n) {
    throw new Error("cannot invert zero");
  }

  while (exponent > 0n) {
    if (exponent & 1n) {
      result = mod(result * base);
    }
    base = mod(base * base);
    exponent >>= 1n;
  }

  return result;
}

export function createShamirShare(
  side: boolean,
  coefficient: bigint,
  memberIndex: 1 | 2 | 3,
): bigint {
  return mod((side ? 1n : 0n) + coefficient * BigInt(memberIndex));
}

export function reconstructIntercept(
  firstIndex: number,
  firstShare: bigint,
  secondIndex: number,
  secondShare: bigint,
): bigint {
  if (firstIndex === secondIndex) {
    throw new Error("committee indices must be distinct");
  }

  const x1 = BigInt(firstIndex);
  const x2 = BigInt(secondIndex);
  const numerator = mod(firstShare * x2 - secondShare * x1);
  return mod(numerator * inverse(x2 - x1));
}

function zeroHashes(): bigint[] {
  const values = [0n];
  for (let level = 0; level < TREE_DEPTH; level += 1) {
    const current = values[level];
    if (current === undefined) {
      throw new Error("missing zero hash");
    }
    values.push(poseidonHash(current, current));
  }
  return values;
}

export function commitmentRoot(leaves: readonly bigint[]): bigint {
  if (leaves.length > 2 ** TREE_DEPTH) {
    throw new Error(`tree supports at most ${2 ** TREE_DEPTH} commitments`);
  }

  const zeros = zeroHashes();
  let levelNodes = [...leaves];

  for (let level = 0; level < TREE_DEPTH; level += 1) {
    const empty = zeros[level];
    if (empty === undefined) {
      throw new Error("missing zero hash");
    }
    const parents: bigint[] = [];
    const parentCount = Math.max(1, Math.ceil(levelNodes.length / 2));
    for (let index = 0; index < parentCount; index += 1) {
      const left = levelNodes[index * 2] ?? empty;
      const right = levelNodes[index * 2 + 1] ?? empty;
      parents.push(poseidonHash(left, right));
    }
    levelNodes = parents;
  }

  const root = levelNodes[0] ?? zeros[TREE_DEPTH];
  if (root === undefined) {
    throw new Error("missing commitment root");
  }
  return root;
}

export class CommitteeMember {
  readonly memberIndex: 1 | 2 | 3;
  readonly #shares = new Map<string, Map<number, CommitteeShare>>();

  constructor(memberIndex: 1 | 2 | 3) {
    this.memberIndex = memberIndex;
  }

  submit(input: CommitteeShare): void {
    if (input.memberIndex !== this.memberIndex) {
      throw new Error("share sent to the wrong committee member");
    }
    if (!Number.isSafeInteger(input.orderIndex) || input.orderIndex < 0) {
      throw new Error("order index must be a non-negative safe integer");
    }
    if (!input.placementSignature) {
      throw new Error("placement signature is required");
    }
    if (shareCommitment(input.share, input.salt) !== input.expectedShareCommitment) {
      throw new Error("share commitment mismatch");
    }

    const marketShares = this.#shares.get(input.market) ?? new Map();
    const existing = marketShares.get(input.orderIndex);
    if (existing) {
      if (
        existing.orderCommitment !== input.orderCommitment ||
        existing.share !== input.share ||
        existing.salt !== input.salt ||
        existing.placementSignature !== input.placementSignature
      ) {
        throw new Error("conflicting share submission");
      }
      return;
    }

    marketShares.set(input.orderIndex, input);
    this.#shares.set(input.market, marketShares);
  }

  snapshot(market: string): readonly CommitteeShare[] {
    return [...(this.#shares.get(market)?.values() ?? [])].sort(
      (left, right) => left.orderIndex - right.orderIndex,
    );
  }
}

export function finalizeCommitteeBatch(
  market: string,
  first: CommitteeMember,
  second: CommitteeMember,
): CommitteeBatch {
  if (first.memberIndex === second.memberIndex) {
    throw new Error("two distinct committee members are required");
  }

  const firstShares = first.snapshot(market);
  const secondShares = second.snapshot(market);
  if (firstShares.length === 0 || firstShares.length !== secondShares.length) {
    throw new Error("committee snapshots must contain the same non-zero order count");
  }

  let firstAggregate = 0n;
  let secondAggregate = 0n;
  const leaves: bigint[] = [];

  for (let orderIndex = 0; orderIndex < firstShares.length; orderIndex += 1) {
    const firstShare = firstShares[orderIndex];
    const secondShare = secondShares[orderIndex];
    if (!firstShare || !secondShare) {
      throw new Error("missing committee share");
    }
    if (
      firstShare.orderIndex !== orderIndex ||
      secondShare.orderIndex !== orderIndex ||
      firstShare.orderCommitment !== secondShare.orderCommitment ||
      firstShare.placementSignature !== secondShare.placementSignature
    ) {
      throw new Error("committee snapshots do not describe the same ordered commitments");
    }
    firstAggregate = mod(firstAggregate + firstShare.share);
    secondAggregate = mod(secondAggregate + secondShare.share);
    leaves.push(firstShare.orderCommitment);
  }

  const reconstructed = reconstructIntercept(
    first.memberIndex,
    firstAggregate,
    second.memberIndex,
    secondAggregate,
  );
  if (reconstructed > BigInt(firstShares.length)) {
    throw new Error("reconstructed YES count is outside the order range");
  }

  const yesCount = Number(reconstructed);
  return {
    market,
    orderCount: firstShares.length,
    yesCount,
    noCount: firstShares.length - yesCount,
    commitmentRoot: commitmentRoot(leaves),
    memberIndices: [first.memberIndex, second.memberIndex],
  };
}

import assert from "node:assert/strict";
import test from "node:test";

import {
  CommitteeMember,
  commitmentRoot,
  createShamirShare,
  finalizeCommitteeBatch,
  reconstructIntercept,
} from "./committee.js";
import {
  merkleRoot,
  orderCommitment,
  poseidonHash,
  shareCommitment,
  TREE_DEPTH,
} from "./commitments.js";

test("every two-member pair reconstructs the hidden side", () => {
  for (const side of [false, true]) {
    const coefficient = 987654321n;
    const shares = [1, 2, 3].map((index) =>
      createShamirShare(side, coefficient, index as 1 | 2 | 3),
    );

    for (const [left, right] of [
      [0, 1],
      [0, 2],
      [1, 2],
    ] as const) {
      assert.equal(
        reconstructIntercept(left + 1, shares[left]!, right + 1, shares[right]!),
        side ? 1n : 0n,
      );
    }
  }
});

test("a single share changes when the random coefficient changes", () => {
  assert.notEqual(createShamirShare(true, 10n, 1), createShamirShare(true, 11n, 1));
});

test("committee finalizes ordered commitments and aggregate counts", () => {
  const members = [new CommitteeMember(1), new CommitteeMember(2), new CommitteeMember(3)];
  const sides = [true, false, true];

  sides.forEach((side, orderIndex) => {
    const coefficient = BigInt(100 + orderIndex);
    const order = orderCommitment(42n, 1_000_000n, side, BigInt(orderIndex + 5), BigInt(orderIndex + 9));
    const signature = `signature-${orderIndex}`;

    members.forEach((member) => {
      const share = createShamirShare(side, coefficient, member.memberIndex);
      const salt = BigInt(1000 + member.memberIndex * 10 + orderIndex);
      member.submit({
        market: "market-1",
        orderIndex,
        orderCommitment: order,
        memberIndex: member.memberIndex,
        share,
        salt,
        expectedShareCommitment: shareCommitment(share, salt),
        placementSignature: signature,
      });
    });
  });

  const batch = finalizeCommitteeBatch("market-1", members[0]!, members[2]!);
  assert.equal(batch.orderCount, 3);
  assert.equal(batch.yesCount, 2);
  assert.equal(batch.noCount, 1);
  assert.deepEqual(batch.memberIndices, [1, 3]);
});

test("single-leaf tree matches the redeem circuit path convention", () => {
  const leaf = 123n;
  const zeros = Array<bigint>(TREE_DEPTH);
  let empty = 0n;
  for (let level = 0; level < TREE_DEPTH; level += 1) {
    zeros[level] = empty;
    empty = poseidonHash(empty, empty);
  }
  assert.equal(
    commitmentRoot([leaf]),
    merkleRoot(leaf, Array<boolean>(TREE_DEPTH).fill(false), zeros),
  );
});

test("member rejects wrong, conflicting, and invalid shares", () => {
  const member = new CommitteeMember(1);
  const valid = {
    market: "market-1",
    orderIndex: 0,
    orderCommitment: 100n,
    memberIndex: 1 as const,
    share: 9n,
    salt: 10n,
    expectedShareCommitment: shareCommitment(9n, 10n),
    placementSignature: "signature-0",
  };
  member.submit(valid);
  member.submit(valid);

  assert.throws(
    () => member.submit({ ...valid, share: 10n, expectedShareCommitment: shareCommitment(10n, 10n) }),
    /conflicting/,
  );
  assert.throws(
    () => member.submit({ ...valid, orderIndex: 1, expectedShareCommitment: 1n }),
    /mismatch/,
  );
  assert.throws(
    () => member.submit({ ...valid, orderIndex: 1, memberIndex: 2 as const }),
    /wrong committee member/,
  );
});

test("finalization rejects gaps and mismatched snapshots", () => {
  const first = new CommitteeMember(1);
  const second = new CommitteeMember(2);
  const firstShare = createShamirShare(true, 4n, 1);
  const secondShare = createShamirShare(true, 4n, 2);

  first.submit({
    market: "market-1",
    orderIndex: 1,
    orderCommitment: 20n,
    memberIndex: 1,
    share: firstShare,
    salt: 7n,
    expectedShareCommitment: shareCommitment(firstShare, 7n),
    placementSignature: "signature-1",
  });
  second.submit({
    market: "market-1",
    orderIndex: 1,
    orderCommitment: 20n,
    memberIndex: 2,
    share: secondShare,
    salt: 8n,
    expectedShareCommitment: shareCommitment(secondShare, 8n),
    placementSignature: "signature-1",
  });

  assert.throws(() => finalizeCommitteeBatch("market-1", first, second), /same ordered commitments/);
});

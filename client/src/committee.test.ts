import assert from "node:assert/strict";
import test from "node:test";

import {
  BN254_SCALAR_MODULUS,
  CommitteeMember,
  MIN_PRIVATE_BATCH_ORDERS,
  commitmentRoot,
  createShamirShare,
  finalizeCommitteeAggregates,
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

type OrderInput = { side: boolean; amount: bigint };

function submitOrders(members: CommitteeMember[], orders: OrderInput[]) {
  orders.forEach(({ side, amount }, orderIndex) => {
    const sideCoefficient = BigInt(100 + orderIndex);
    const yesAmountCoefficient = BigInt(200 + orderIndex);
    const totalAmountCoefficient = BigInt(300 + orderIndex);
    const order = orderCommitment(42n, 100_000_000n, amount, side, BigInt(orderIndex + 5), BigInt(orderIndex + 9));

    members.forEach((member) => {
      const sideShare = createShamirShare(side ? 1n : 0n, sideCoefficient, member.memberIndex);
      const yesAmountShare = createShamirShare(side ? amount : 0n, yesAmountCoefficient, member.memberIndex);
      const totalAmountShare = createShamirShare(amount, totalAmountCoefficient, member.memberIndex);
      const salt = BigInt(1_000 + member.memberIndex * 10 + orderIndex);
      member.submit({
        market: "market-1",
        orderIndex,
        orderCommitment: order,
        memberIndex: member.memberIndex,
        sideShare,
        yesAmountShare,
        totalAmountShare,
        salt,
        expectedShareCommitment: shareCommitment(sideShare, yesAmountShare, totalAmountShare, salt),
        placementSignature: `signature-${orderIndex}`,
      });
    });
  });
}

test("every two-member pair reconstructs hidden values", () => {
  for (const value of [0n, 1n, 37_000_000n]) {
    const coefficient = 987_654_321n;
    const shares = [1, 2, 3].map((index) =>
      createShamirShare(value, coefficient, index as 1 | 2 | 3),
    );
    for (const [left, right] of [[0, 1], [0, 2], [1, 2]] as const) {
      assert.equal(reconstructIntercept(left + 1, shares[left]!, right + 1, shares[right]!), value);
    }
  }
});

test("a single share changes when its random coefficient changes", () => {
  assert.notEqual(createShamirShare(1n, 10n, 1), createShamirShare(1n, 11n, 1));
});

test("committee finalizes unequal private amounts", () => {
  const members = [new CommitteeMember(1), new CommitteeMember(2), new CommitteeMember(3)];
  submitOrders(members, [
    { side: true, amount: 37_000_000n },
    { side: false, amount: 12_000_000n },
    { side: true, amount: 5_000_000n },
    { side: false, amount: 9_000_000n },
  ]);

  const batch = finalizeCommitteeBatch("market-1", members[0]!, members[2]!);
  assert.equal(batch.orderCount, 4);
  assert.equal(batch.yesCount, 2);
  assert.equal(batch.noCount, 2);
  assert.equal(batch.yesAmount, 42_000_000n);
  assert.equal(batch.noAmount, 21_000_000n);
  assert.deepEqual(batch.memberIndices, [1, 3]);
});

test("aggregate summaries expose no individual private values", () => {
  const member = new CommitteeMember(1);
  submitOrders([member], [
    { side: true, amount: 7_000_000n },
    { side: false, amount: 8_000_000n },
    { side: true, amount: 9_000_000n },
    { side: false, amount: 10_000_000n },
  ]);
  const aggregate = member.aggregate("market-1");
  assert.equal(aggregate.orderCount, MIN_PRIVATE_BATCH_ORDERS);
  assert.equal("shares" in aggregate, false);
  assert.equal("salts" in aggregate, false);
  assert.equal(aggregate.orderCommitments.length, MIN_PRIVATE_BATCH_ORDERS);
  assert.equal(member.clearMarket("market-1"), true);
  assert.deepEqual(member.snapshot("market-1"), []);
});

test("small and one-sided batches are refused", () => {
  const small = new CommitteeMember(1);
  assert.throws(() => small.aggregate("market-1"), /at least 4/);

  const first = new CommitteeMember(1);
  const second = new CommitteeMember(2);
  submitOrders([first, second], Array.from({ length: MIN_PRIVATE_BATCH_ORDERS }, (_, index) => ({
    side: true,
    amount: BigInt(index + 1) * 1_000_000n,
  })));
  assert.throws(
    () => finalizeCommitteeAggregates("market-1", first.aggregate("market-1"), second.aggregate("market-1")),
    /one-sided/,
  );
});

test("single-leaf tree matches the redeem circuit path convention", () => {
  const leaf = 123n;
  const zeros = Array<bigint>(TREE_DEPTH);
  let empty = 0n;
  for (let level = 0; level < TREE_DEPTH; level += 1) {
    zeros[level] = empty;
    empty = poseidonHash(empty, empty);
  }
  assert.equal(commitmentRoot([leaf]), merkleRoot(leaf, Array<boolean>(TREE_DEPTH).fill(false), zeros));
});

test("member rejects conflicting and invalid share bundles", () => {
  const member = new CommitteeMember(1);
  const valid = {
    market: "market-1",
    orderIndex: 0,
    orderCommitment: 100n,
    memberIndex: 1 as const,
    sideShare: 9n,
    yesAmountShare: 10n,
    totalAmountShare: 11n,
    salt: 12n,
    expectedShareCommitment: shareCommitment(9n, 10n, 11n, 12n),
    placementSignature: "signature-0",
  };
  member.submit(valid);
  member.submit(valid);

  assert.throws(
    () => member.submit({ ...valid, sideShare: 10n, expectedShareCommitment: shareCommitment(10n, 10n, 11n, 12n) }),
    /conflicting/,
  );
  assert.throws(() => member.submit({ ...valid, orderIndex: 1, expectedShareCommitment: 1n }), /mismatch/);
  assert.throws(() => member.submit({ ...valid, orderIndex: 1, memberIndex: 2 as const }), /wrong committee member/);
  assert.throws(() => member.submit({ ...valid, orderIndex: 1, totalAmountShare: BN254_SCALAR_MODULUS }), /scalar field/);
});

test("finalization rejects non-contiguous snapshots", () => {
  const member = new CommitteeMember(1);
  const sideShare = createShamirShare(1n, 4n, 1);
  const yesAmountShare = createShamirShare(1_000_000n, 5n, 1);
  const totalAmountShare = createShamirShare(1_000_000n, 6n, 1);
  member.submit({
    market: "market-1",
    orderIndex: 1,
    orderCommitment: 20n,
    memberIndex: 1,
    sideShare,
    yesAmountShare,
    totalAmountShare,
    salt: 7n,
    expectedShareCommitment: shareCommitment(sideShare, yesAmountShare, totalAmountShare, 7n),
    placementSignature: "signature-1",
  });
  assert.throws(() => member.aggregate("market-1"), /at least 4/);
});

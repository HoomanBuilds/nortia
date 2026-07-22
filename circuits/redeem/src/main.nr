use poseidon::poseidon::bn254::hash_2 as poseidon_hash;

global TREE_DEPTH: u32 = 16;
global MIN_WAGER_AMOUNT: u64 = 1000000;

fn hash(left: Field, right: Field) -> Field {
    poseidon_hash([left, right])
}

fn order_commitment(
    market_id: Field,
    stake_amount: Field,
    amount: Field,
    side: bool,
    secret: Field,
    nullifier: Field,
) -> Field {
    let context = hash(market_id, stake_amount);
    let position = hash(amount, side as Field);
    hash(context, hash(position, hash(secret, nullifier)))
}

fn merkle_root(leaf: Field, path_bits: [bool; TREE_DEPTH], siblings: [Field; TREE_DEPTH]) -> Field {
    let mut current = leaf;
    for i in 0..TREE_DEPTH {
        let sibling = siblings[i];
        current = if !path_bits[i] {
            hash(current, sibling)
        } else {
            hash(sibling, current)
        };
    }
    current
}

fn main(
    market_id: pub Field,
    stake_amount: pub Field,
    commitment_root: pub Field,
    outcome: pub bool,
    nullifier_hash: pub Field,
    recipient_hash: pub Field,
    net_pool: pub Field,
    winning_amount: pub Field,
    payout_amount: pub Field,
    amount: u64,
    side: bool,
    secret: Field,
    nullifier: Field,
    path_bits: [bool; TREE_DEPTH],
    siblings: [Field; TREE_DEPTH],
) {
    let stake_u64 = stake_amount as u64;
    let net_pool_u64 = net_pool as u64;
    let winning_amount_u64 = winning_amount as u64;
    let payout_u64 = payout_amount as u64;
    assert(stake_u64 as Field == stake_amount);
    assert(net_pool_u64 as Field == net_pool);
    assert(winning_amount_u64 as Field == winning_amount);
    assert(payout_u64 as Field == payout_amount);
    assert(amount >= MIN_WAGER_AMOUNT);
    assert(amount <= stake_u64);
    assert(winning_amount_u64 > 0);

    let commitment = order_commitment(market_id, stake_amount, amount as Field, side, secret, nullifier);
    assert(merkle_root(commitment, path_bits, siblings) == commitment_root);
    assert(hash(market_id, nullifier) == nullifier_hash);

    let unused_collateral = (stake_u64 - amount) as u128;
    let market_payout = if side == outcome {
        (amount as u128) * (net_pool_u64 as u128) / (winning_amount_u64 as u128)
    } else {
        0
    };
    assert(unused_collateral + market_payout == payout_u64 as u128);
    assert(recipient_hash != 0);
    assert(secret != 0);
    assert(nullifier != 0);
}

#[test]
fn accepts_winning_confidential_amount() {
    let market_id: Field = 42;
    let stake_amount: Field = 100000000;
    let amount: u64 = 37000000;
    let outcome: bool = true;
    let secret: Field = 11;
    let nullifier: Field = 12;
    let path_bits: [bool; TREE_DEPTH] = [false; TREE_DEPTH];
    let siblings: [Field; TREE_DEPTH] = [0; TREE_DEPTH];
    let commitment = order_commitment(market_id, stake_amount, amount as Field, outcome, secret, nullifier);
    let root = merkle_root(commitment, path_bits, siblings);
    let net_pool: u64 = 99000000;
    let winning_amount: u64 = 50000000;
    let payout = stake_amount as u64 - amount + amount * net_pool / winning_amount;

    main(
        market_id,
        stake_amount,
        root,
        outcome,
        hash(market_id, nullifier),
        91,
        net_pool as Field,
        winning_amount as Field,
        payout as Field,
        amount,
        outcome,
        secret,
        nullifier,
        path_bits,
        siblings,
    );
}

#[test]
fn accepts_losing_unused_collateral() {
    let path_bits: [bool; TREE_DEPTH] = [false; TREE_DEPTH];
    let siblings: [Field; TREE_DEPTH] = [0; TREE_DEPTH];
    let amount: u64 = 37000000;
    let stake_amount: Field = 100000000;
    let commitment = order_commitment(42, stake_amount, amount as Field, false, 11, 12);
    main(
        42,
        stake_amount,
        merkle_root(commitment, path_bits, siblings),
        true,
        hash(42, 12),
        91,
        99000000,
        50000000,
        63000000,
        amount,
        false,
        11,
        12,
        path_bits,
        siblings,
    );
}

#[test(should_fail)]
fn rejects_incorrect_payout() {
    let path_bits: [bool; TREE_DEPTH] = [false; TREE_DEPTH];
    let siblings: [Field; TREE_DEPTH] = [0; TREE_DEPTH];
    let amount: u64 = 37000000;
    let commitment = order_commitment(42, 100000000, amount as Field, true, 11, 12);
    main(
        42,
        100000000,
        merkle_root(commitment, path_bits, siblings),
        true,
        hash(42, 12),
        91,
        99000000,
        50000000,
        63000000,
        amount,
        true,
        11,
        12,
        path_bits,
        siblings,
    );
}

#[test(should_fail)]
fn rejects_amount_above_stake() {
    let path_bits: [bool; TREE_DEPTH] = [false; TREE_DEPTH];
    let siblings: [Field; TREE_DEPTH] = [0; TREE_DEPTH];
    main(42, 100000000, 1, true, 2, 91, 99000000, 50000000, 1, 100000001, true, 11, 12, path_bits, siblings);
}

#[test(should_fail)]
fn rejects_rebound_recipient() {
    let path_bits: [bool; TREE_DEPTH] = [false; TREE_DEPTH];
    let siblings: [Field; TREE_DEPTH] = [0; TREE_DEPTH];
    let amount: u64 = 37000000;
    let commitment = order_commitment(42, 100000000, amount as Field, true, 11, 12);
    main(
        42,
        100000000,
        merkle_root(commitment, path_bits, siblings),
        true,
        hash(42, 12),
        0,
        99000000,
        50000000,
        136260000,
        amount,
        true,
        11,
        12,
        path_bits,
        siblings,
    );
}

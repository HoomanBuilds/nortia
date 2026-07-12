use poseidon::poseidon::bn254::hash_2 as poseidon_hash;

global TREE_DEPTH: u32 = 16;

fn hash(left: Field, right: Field) -> Field {
    poseidon_hash([left, right])
}

fn order_commitment(
    market_id: Field,
    ticket_amount: Field,
    side: bool,
    secret: Field,
    nullifier: Field,
) -> Field {
    let context = hash(market_id, ticket_amount);
    let position = hash(side as Field, secret);
    hash(context, hash(position, nullifier))
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
    ticket_amount: pub Field,
    commitment_root: pub Field,
    outcome: pub bool,
    nullifier_hash: pub Field,
    recipient_hash: pub Field,
    payout_amount: pub Field,
    side: bool,
    secret: Field,
    nullifier: Field,
    path_bits: [bool; TREE_DEPTH],
    siblings: [Field; TREE_DEPTH],
) {
    let commitment = order_commitment(market_id, ticket_amount, side, secret, nullifier);
    assert(merkle_root(commitment, path_bits, siblings) == commitment_root);
    assert(side == outcome);
    assert(hash(market_id, nullifier) == nullifier_hash);
    assert(recipient_hash != 0);
    assert(payout_amount != 0);
}

#[test]
fn accepts_valid_redemption() {
    let market_id: Field = 42;
    let ticket_amount: Field = 1000000;
    let outcome: bool = true;
    let secret: Field = 11;
    let nullifier: Field = 12;
    let path_bits: [bool; TREE_DEPTH] = [false; TREE_DEPTH];
    let siblings: [Field; TREE_DEPTH] = [0; TREE_DEPTH];
    let commitment = order_commitment(market_id, ticket_amount, outcome, secret, nullifier);
    let root = merkle_root(commitment, path_bits, siblings);

    main(
        market_id,
        ticket_amount,
        root,
        outcome,
        hash(market_id, nullifier),
        91,
        1485000,
        outcome,
        secret,
        nullifier,
        path_bits,
        siblings,
    );
}

#[test(should_fail)]
fn rejects_losing_side() {
    let market_id: Field = 42;
    let ticket_amount: Field = 1000000;
    let side: bool = false;
    let secret: Field = 11;
    let nullifier: Field = 12;
    let path_bits: [bool; TREE_DEPTH] = [false; TREE_DEPTH];
    let siblings: [Field; TREE_DEPTH] = [0; TREE_DEPTH];
    let commitment = order_commitment(market_id, ticket_amount, side, secret, nullifier);

    main(
        market_id,
        ticket_amount,
        merkle_root(commitment, path_bits, siblings),
        true,
        hash(market_id, nullifier),
        91,
        1485000,
        side,
        secret,
        nullifier,
        path_bits,
        siblings,
    );
}

#[test(should_fail)]
fn rejects_rebound_recipient() {
    let path_bits: [bool; TREE_DEPTH] = [false; TREE_DEPTH];
    let siblings: [Field; TREE_DEPTH] = [0; TREE_DEPTH];
    let commitment = order_commitment(42, 1000000, true, 11, 12);
    main(
        42,
        1000000,
        merkle_root(commitment, path_bits, siblings),
        true,
        hash(42, 12),
        0,
        1485000,
        true,
        11,
        12,
        path_bits,
        siblings,
    );
}

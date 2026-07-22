use poseidon::poseidon::bn254::hash_2 as poseidon_hash;

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

fn committed_share_bundle(
    side_share: Field,
    yes_amount_share: Field,
    total_amount_share: Field,
    salt: Field,
) -> Field {
    hash(hash(side_share, yes_amount_share), hash(total_amount_share, salt))
}

fn main(
    market_id: pub Field,
    stake_amount: pub Field,
    payer_hash: pub Field,
    commitment: pub Field,
    share_commitment_1: pub Field,
    share_commitment_2: pub Field,
    share_commitment_3: pub Field,
    amount: u64,
    side: bool,
    secret: Field,
    nullifier: Field,
    side_coefficient: Field,
    yes_amount_coefficient: Field,
    total_amount_coefficient: Field,
    salt_1: Field,
    salt_2: Field,
    salt_3: Field,
) {
    let stake_u64 = stake_amount as u64;
    assert(stake_u64 as Field == stake_amount);
    assert(amount >= MIN_WAGER_AMOUNT);
    assert(amount <= stake_u64);

    let amount_field = amount as Field;
    let side_field = side as Field;
    let yes_amount = amount_field * side_field;

    let side_share_1 = side_field + side_coefficient;
    let side_share_2 = side_field + side_coefficient * 2;
    let side_share_3 = side_field + side_coefficient * 3;
    let yes_amount_share_1 = yes_amount + yes_amount_coefficient;
    let yes_amount_share_2 = yes_amount + yes_amount_coefficient * 2;
    let yes_amount_share_3 = yes_amount + yes_amount_coefficient * 3;
    let total_amount_share_1 = amount_field + total_amount_coefficient;
    let total_amount_share_2 = amount_field + total_amount_coefficient * 2;
    let total_amount_share_3 = amount_field + total_amount_coefficient * 3;

    assert(commitment == order_commitment(market_id, stake_amount, amount_field, side, secret, nullifier));
    assert(share_commitment_1 == committed_share_bundle(side_share_1, yes_amount_share_1, total_amount_share_1, salt_1));
    assert(share_commitment_2 == committed_share_bundle(side_share_2, yes_amount_share_2, total_amount_share_2, salt_2));
    assert(share_commitment_3 == committed_share_bundle(side_share_3, yes_amount_share_3, total_amount_share_3, salt_3));
    assert(payer_hash != 0);
    assert(secret != 0);
    assert(nullifier != 0);
    assert(side_coefficient != 0);
    assert(yes_amount_coefficient != 0);
    assert(total_amount_coefficient != 0);
    assert(salt_1 != 0);
    assert(salt_2 != 0);
    assert(salt_3 != 0);
}

#[test]
fn accepts_confidential_yes_amount() {
    let market_id: Field = 42;
    let stake_amount: Field = 100000000;
    let amount: u64 = 37000000;
    let side: bool = true;
    let secret: Field = 11;
    let nullifier: Field = 12;
    let side_coefficient: Field = 13;
    let yes_amount_coefficient: Field = 14;
    let total_amount_coefficient: Field = 15;
    let amount_field = amount as Field;
    let yes_amount = amount_field;

    main(
        market_id,
        stake_amount,
        91,
        order_commitment(market_id, stake_amount, amount_field, side, secret, nullifier),
        committed_share_bundle(side as Field + side_coefficient, yes_amount + yes_amount_coefficient, amount_field + total_amount_coefficient, 21),
        committed_share_bundle(side as Field + side_coefficient * 2, yes_amount + yes_amount_coefficient * 2, amount_field + total_amount_coefficient * 2, 22),
        committed_share_bundle(side as Field + side_coefficient * 3, yes_amount + yes_amount_coefficient * 3, amount_field + total_amount_coefficient * 3, 23),
        amount,
        side,
        secret,
        nullifier,
        side_coefficient,
        yes_amount_coefficient,
        total_amount_coefficient,
        21,
        22,
        23,
    );
}

#[test]
fn accepts_minimum_no_amount() {
    let amount: u64 = MIN_WAGER_AMOUNT;
    let side: bool = false;
    let side_coefficient: Field = 13;
    let yes_amount_coefficient: Field = 14;
    let total_amount_coefficient: Field = 15;
    main(
        42,
        5000000,
        91,
        order_commitment(42, 5000000, amount as Field, side, 11, 12),
        committed_share_bundle(side_coefficient, yes_amount_coefficient, amount as Field + total_amount_coefficient, 21),
        committed_share_bundle(side_coefficient * 2, yes_amount_coefficient * 2, amount as Field + total_amount_coefficient * 2, 22),
        committed_share_bundle(side_coefficient * 3, yes_amount_coefficient * 3, amount as Field + total_amount_coefficient * 3, 23),
        amount,
        side,
        11,
        12,
        side_coefficient,
        yes_amount_coefficient,
        total_amount_coefficient,
        21,
        22,
        23,
    );
}

#[test(should_fail)]
fn rejects_amount_below_minimum() {
    main(42, 100000000, 91, 99, 1, 2, 3, 999999, true, 11, 12, 13, 14, 15, 21, 22, 23);
}

#[test(should_fail)]
fn rejects_amount_above_stake() {
    main(42, 100000000, 91, 99, 1, 2, 3, 100000001, true, 11, 12, 13, 14, 15, 21, 22, 23);
}

#[test(should_fail)]
fn rejects_mutated_share_bundle() {
    let amount: u64 = 37000000;
    let side: bool = true;
    let side_coefficient: Field = 13;
    let yes_amount_coefficient: Field = 14;
    let total_amount_coefficient: Field = 15;
    main(
        42,
        100000000,
        91,
        order_commitment(42, 100000000, amount as Field, side, 11, 12),
        1,
        committed_share_bundle(1 + side_coefficient * 2, amount as Field + yes_amount_coefficient * 2, amount as Field + total_amount_coefficient * 2, 22),
        committed_share_bundle(1 + side_coefficient * 3, amount as Field + yes_amount_coefficient * 3, amount as Field + total_amount_coefficient * 3, 23),
        amount,
        side,
        11,
        12,
        side_coefficient,
        yes_amount_coefficient,
        total_amount_coefficient,
        21,
        22,
        23,
    );
}

use poseidon::poseidon::bn254::hash_2 as poseidon_hash;

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

fn main(
    market_id: pub Field,
    ticket_amount: pub Field,
    payer_hash: pub Field,
    commitment: pub Field,
    share_commitment_1: pub Field,
    share_commitment_2: pub Field,
    share_commitment_3: pub Field,
    side: bool,
    secret: Field,
    nullifier: Field,
    coefficient: Field,
    salt_1: Field,
    salt_2: Field,
    salt_3: Field,
) {
    let share_1 = side as Field + coefficient;
    let share_2 = side as Field + coefficient * 2;
    let share_3 = side as Field + coefficient * 3;

    assert(commitment == order_commitment(market_id, ticket_amount, side, secret, nullifier));
    assert(share_commitment_1 == hash(share_1, salt_1));
    assert(share_commitment_2 == hash(share_2, salt_2));
    assert(share_commitment_3 == hash(share_3, salt_3));
    assert(payer_hash != 0);
    assert(secret != 0);
    assert(nullifier != 0);
    assert(coefficient != 0);
    assert(salt_1 != 0);
    assert(salt_2 != 0);
    assert(salt_3 != 0);
}

#[test]
fn accepts_valid_yes_order() {
    let market_id: Field = 42;
    let ticket_amount: Field = 1000000;
    let payer_hash: Field = 91;
    let side: bool = true;
    let secret: Field = 11;
    let nullifier: Field = 12;
    let coefficient: Field = 13;
    let salt_1: Field = 21;
    let salt_2: Field = 22;
    let salt_3: Field = 23;
    let commitment = order_commitment(market_id, ticket_amount, side, secret, nullifier);

    main(
        market_id,
        ticket_amount,
        payer_hash,
        commitment,
        hash(side as Field + coefficient, salt_1),
        hash(side as Field + coefficient * 2, salt_2),
        hash(side as Field + coefficient * 3, salt_3),
        side,
        secret,
        nullifier,
        coefficient,
        salt_1,
        salt_2,
        salt_3,
    );
}

#[test(should_fail)]
fn rejects_mutated_commitment() {
    main(42, 1000000, 91, 99, 1, 2, 3, true, 11, 12, 13, 21, 22, 23);
}

#[test(should_fail)]
fn rejects_zero_payer_hash() {
    let side: bool = false;
    let secret: Field = 11;
    let nullifier: Field = 12;
    let coefficient: Field = 13;
    let commitment = order_commitment(42, 1000000, side, secret, nullifier);
    main(
        42,
        1000000,
        0,
        commitment,
        hash(side as Field + coefficient, 21),
        hash(side as Field + coefficient * 2, 22),
        hash(side as Field + coefficient * 3, 23),
        side,
        secret,
        nullifier,
        coefficient,
        21,
        22,
        23,
    );
}

#[test(should_fail)]
fn rejects_zero_shamir_coefficient() {
    let side: bool = true;
    let secret: Field = 11;
    let nullifier: Field = 12;
    let coefficient: Field = 0;
    let commitment = order_commitment(42, 1000000, side, secret, nullifier);
    main(
        42,
        1000000,
        91,
        commitment,
        hash(side as Field + coefficient, 21),
        hash(side as Field + coefficient * 2, 22),
        hash(side as Field + coefficient * 3, 23),
        side,
        secret,
        nullifier,
        coefficient,
        21,
        22,
        23,
    );
}

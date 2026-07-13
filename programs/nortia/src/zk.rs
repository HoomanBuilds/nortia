use anchor_lang::{
    prelude::*,
    solana_program::{instruction::Instruction, program::invoke},
};
use solana_poseidon::{hashv, Endianness, Parameters};

use crate::{error::NortiaError, state::Market};

const PUBLIC_INPUTS: usize = 7;
const WITNESS_HEADER_LEN: usize = 12;
const FIELD_LEN: usize = 32;
const WITNESS_LEN: usize = WITNESS_HEADER_LEN + PUBLIC_INPUTS * FIELD_LEN;
const MAX_PROOF_LEN: usize = 512;

pub fn pubkey_hash(key: &Pubkey) -> Result<[u8; 32]> {
    let bytes = key.as_ref();
    let hash = hashv(
        Parameters::Bn254X5,
        Endianness::LittleEndian,
        &[&bytes[..16], &bytes[16..]],
    )
    .map_err(|_| error!(NortiaError::PoseidonHashFailed))?;
    let little_endian = hash.to_bytes();
    let mut big_endian = little_endian;
    big_endian.reverse();
    Ok(big_endian)
}

pub fn field_from_u64(value: u64) -> [u8; 32] {
    let mut field = [0u8; 32];
    field[24..].copy_from_slice(&value.to_be_bytes());
    field
}

pub fn verify_place(
    market: &Market,
    payer: &Pubkey,
    commitment: &[u8; 32],
    share_commitments: &[[u8; 32]; 3],
    proof: &[u8],
    witness: &[u8],
    verifier: &AccountInfo,
) -> Result<()> {
    let expected = [
        field_from_u64(market.market_id),
        field_from_u64(market.ticket_amount),
        pubkey_hash(payer)?,
        *commitment,
        share_commitments[0],
        share_commitments[1],
        share_commitments[2],
    ];
    verify(
        expected,
        proof,
        witness,
        verifier,
        &market.placement_verifier,
    )
}

pub fn verify_redeem(
    market: &Market,
    recipient: &Pubkey,
    nullifier_hash: &[u8; 32],
    proof: &[u8],
    witness: &[u8],
    verifier: &AccountInfo,
) -> Result<()> {
    let expected = [
        field_from_u64(market.market_id),
        field_from_u64(market.ticket_amount),
        market.commitment_root,
        field_from_u64(market.outcome as u64),
        *nullifier_hash,
        pubkey_hash(recipient)?,
        field_from_u64(market.payout_amount),
    ];
    verify(expected, proof, witness, verifier, &market.redeem_verifier)
}

fn verify(
    expected_fields: [[u8; 32]; PUBLIC_INPUTS],
    proof: &[u8],
    witness: &[u8],
    verifier: &AccountInfo,
    expected_verifier: &Pubkey,
) -> Result<()> {
    require!(
        (128..=MAX_PROOF_LEN).contains(&proof.len()),
        NortiaError::InvalidProofLength
    );
    require!(
        witness.len() == WITNESS_LEN,
        NortiaError::InvalidWitnessLength
    );
    require_keys_eq!(
        *verifier.key,
        *expected_verifier,
        NortiaError::InvalidVerifierProgram
    );
    require!(verifier.executable, NortiaError::InvalidVerifierProgram);

    for (index, expected) in expected_fields.iter().enumerate() {
        let start = WITNESS_HEADER_LEN + index * FIELD_LEN;
        require!(
            witness[start..start + FIELD_LEN] == expected[..],
            NortiaError::PublicWitnessMismatch
        );
    }

    let mut data = Vec::with_capacity(proof.len() + witness.len());
    data.extend_from_slice(proof);
    data.extend_from_slice(witness);
    let instruction = Instruction {
        program_id: *expected_verifier,
        accounts: vec![],
        data,
    };
    invoke(&instruction, std::slice::from_ref(verifier)).map_err(Into::into)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn encodes_u64_as_noir_field() {
        let field = field_from_u64(0x0102_0304_0506_0708);
        assert_eq!(&field[..24], &[0u8; 24]);
        assert_eq!(&field[24..], &[1, 2, 3, 4, 5, 6, 7, 8]);
    }

    #[test]
    fn pubkey_hash_matches_the_typescript_prover_encoding() {
        let key = pubkey!("4S2EvdGrbKJ9zazvB4gtR83crTrVJWqqwoVVvEQy8VE9");
        assert_eq!(
            pubkey_hash(&key).unwrap(),
            [
                40, 192, 105, 29, 19, 25, 245, 169, 45, 252, 52, 235, 123, 107, 24, 101, 211, 46,
                48, 194, 152, 111, 56, 35, 168, 165, 174, 116, 28, 33, 218, 80,
            ]
        );
    }
}

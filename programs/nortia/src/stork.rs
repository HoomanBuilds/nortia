use anchor_lang::prelude::*;

use crate::{
    constants::STORK_ORACLE_PROGRAM_ID,
    error::NortiaError,
    oracles::{compare_values, NormalizedObservation},
    state::{OracleConfig, OracleResolverV2},
};

const STORK_FEED_SEED: &[u8] = b"stork_feed";
const STORK_FEED_DISCRIMINATOR: [u8; 8] = [0x25, 0xa6, 0x41, 0xc4, 0x1d, 0x69, 0x61, 0xa1];
const STORK_VALUE_EXPONENT: i32 = -18;
const STORK_VALUE_PREFIX_LEN: usize = 64;
const NANOS_PER_SECOND: u64 = 1_000_000_000;

pub fn validate_stork_account(
    feed_account: &AccountInfo<'_>,
    oracle: &OracleConfig,
    clock: &Clock,
) -> Result<NormalizedObservation> {
    require!(
        oracle.resolver == OracleResolverV2::StorkPriceV1
            && oracle.source_program == STORK_ORACLE_PROGRAM_ID
            && oracle.source_queue == Pubkey::default(),
        NortiaError::InvalidOracleConfiguration
    );
    require_keys_eq!(
        *feed_account.owner,
        STORK_ORACLE_PROGRAM_ID,
        NortiaError::InvalidStorkFeed
    );
    let canonical = Pubkey::find_program_address(
        &[STORK_FEED_SEED, oracle.source_id.as_ref()],
        &STORK_ORACLE_PROGRAM_ID,
    )
    .0;
    require_keys_eq!(*feed_account.key, canonical, NortiaError::InvalidStorkFeed);
    let data = feed_account
        .try_borrow_data()
        .map_err(|_| error!(NortiaError::InvalidStorkFeed))?;
    require!(
        data.len() >= STORK_VALUE_PREFIX_LEN
            && data[..8] == STORK_FEED_DISCRIMINATOR
            && data[8..40] == oracle.source_id,
        NortiaError::InvalidStorkFeed
    );
    let timestamp_ns = u64::from_le_bytes(
        data[40..48]
            .try_into()
            .map_err(|_| error!(NortiaError::InvalidStorkFeed))?,
    );
    require!(
        timestamp_ns % NANOS_PER_SECOND == 0,
        NortiaError::InvalidObservationTime
    );
    let timestamp = i64::try_from(timestamp_ns / NANOS_PER_SECOND)
        .map_err(|_| error!(NortiaError::InvalidObservationTime))?;
    let value = i128::from_le_bytes(
        data[48..64]
            .try_into()
            .map_err(|_| error!(NortiaError::InvalidStorkFeed))?,
    );
    let window_end = oracle
        .observation_ts
        .checked_add(oracle.observation_window_secs as i64)
        .ok_or_else(|| error!(NortiaError::ArithmeticOverflow))?;
    require!(
        timestamp >= oracle.observation_ts
            && timestamp <= window_end
            && timestamp <= clock.unix_timestamp
            && timestamp
                .checked_sub(oracle.observation_ts)
                .is_some_and(|lag| lag <= oracle.max_staleness_secs as i64),
        NortiaError::InvalidObservationTime
    );
    require!(value > 0, NortiaError::InvalidStorkFeed);
    let outcome = u8::from(compare_values(
        value,
        STORK_VALUE_EXPONENT,
        oracle.threshold,
        oracle.threshold_exponent,
        oracle.comparator,
    )?);
    Ok(NormalizedObservation {
        outcome,
        value,
        exponent: STORK_VALUE_EXPONENT,
        timestamp,
        slot: 0,
        confidence: 0,
        sample_count: 1,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::state::ValueComparator;

    const FEED_ID: [u8; 32] = [7; 32];
    const OBSERVATION_TS: i64 = 2_000;

    fn oracle_config() -> OracleConfig {
        OracleConfig {
            bump: 1,
            version: OracleConfig::VERSION,
            market: Pubkey::new_unique(),
            resolver: OracleResolverV2::StorkPriceV1,
            source_program: STORK_ORACLE_PROGRAM_ID,
            source_queue: Pubkey::default(),
            source_id: FEED_ID,
            comparator: ValueComparator::GreaterThanOrEqual,
            threshold: 100_000_000_000_000_000_000,
            threshold_exponent: -18,
            observation_ts: OBSERVATION_TS,
            observation_window_secs: 30,
            max_staleness_secs: 10,
            max_staleness_slots: 0,
            max_confidence_bps: 0,
            min_samples: 0,
            challenge_period_secs: 0,
            bond_amount: 0,
            config_hash: [8; 32],
            optimistic_proposal: Pubkey::default(),
            consumed: false,
        }
    }

    fn clock() -> Clock {
        Clock {
            slot: 100,
            epoch_start_timestamp: 0,
            epoch: 0,
            leader_schedule_epoch: 0,
            unix_timestamp: OBSERVATION_TS + 20,
        }
    }

    fn feed_data(timestamp: i64, value: i128) -> Vec<u8> {
        let mut data = vec![0u8; 120];
        data[..8].copy_from_slice(&STORK_FEED_DISCRIMINATOR);
        data[8..40].copy_from_slice(&FEED_ID);
        data[40..48].copy_from_slice(&((timestamp as u64) * NANOS_PER_SECOND).to_le_bytes());
        data[48..64].copy_from_slice(&value.to_le_bytes());
        data
    }

    fn validate_with(
        key: &Pubkey,
        owner: &Pubkey,
        data: &mut [u8],
        oracle: &OracleConfig,
    ) -> Result<NormalizedObservation> {
        let mut lamports = 1;
        let account = AccountInfo::new(key, false, false, &mut lamports, data, owner, false);
        validate_stork_account(&account, oracle, &clock())
    }

    #[test]
    fn accepts_canonical_timestamped_feed() {
        let key = Pubkey::find_program_address(
            &[STORK_FEED_SEED, FEED_ID.as_ref()],
            &STORK_ORACLE_PROGRAM_ID,
        )
        .0;
        let mut data = feed_data(OBSERVATION_TS + 1, 100_000_000_000_000_000_000);
        let observation =
            validate_with(&key, &STORK_ORACLE_PROGRAM_ID, &mut data, &oracle_config()).unwrap();
        assert_eq!(observation.outcome, 1);
        assert_eq!(observation.timestamp, OBSERVATION_TS + 1);
        assert_eq!(observation.exponent, -18);
    }

    #[test]
    fn rejects_wrong_owner_pda_feed_and_discriminator() {
        let key = Pubkey::find_program_address(
            &[STORK_FEED_SEED, FEED_ID.as_ref()],
            &STORK_ORACLE_PROGRAM_ID,
        )
        .0;
        let mut data = feed_data(OBSERVATION_TS + 1, 1);
        assert!(validate_with(&key, &Pubkey::new_unique(), &mut data, &oracle_config()).is_err());
        assert!(validate_with(
            &Pubkey::new_unique(),
            &STORK_ORACLE_PROGRAM_ID,
            &mut data,
            &oracle_config(),
        )
        .is_err());

        data[8] = 9;
        assert!(
            validate_with(&key, &STORK_ORACLE_PROGRAM_ID, &mut data, &oracle_config(),).is_err()
        );
        data[8] = FEED_ID[0];
        data[0] = 0;
        assert!(
            validate_with(&key, &STORK_ORACLE_PROGRAM_ID, &mut data, &oracle_config(),).is_err()
        );
    }

    #[test]
    fn rejects_early_late_future_fractional_and_non_positive_values() {
        let key = Pubkey::find_program_address(
            &[STORK_FEED_SEED, FEED_ID.as_ref()],
            &STORK_ORACLE_PROGRAM_ID,
        )
        .0;
        for (timestamp, value) in [
            (OBSERVATION_TS - 1, 1),
            (OBSERVATION_TS + 11, 1),
            (clock().unix_timestamp + 1, 1),
            (OBSERVATION_TS + 1, 0),
            (OBSERVATION_TS + 1, -1),
        ] {
            let mut data = feed_data(timestamp, value);
            assert!(
                validate_with(&key, &STORK_ORACLE_PROGRAM_ID, &mut data, &oracle_config(),)
                    .is_err()
            );
        }
        let mut data = feed_data(OBSERVATION_TS + 1, 1);
        data[40..48]
            .copy_from_slice(&(((OBSERVATION_TS + 1) as u64 * NANOS_PER_SECOND) + 1).to_le_bytes());
        assert!(
            validate_with(&key, &STORK_ORACLE_PROGRAM_ID, &mut data, &oracle_config(),).is_err()
        );
    }
}

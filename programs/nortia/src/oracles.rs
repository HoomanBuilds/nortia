use anchor_lang::prelude::*;
use pyth_solana_receiver_sdk::price_update::{PriceUpdateV2, VerificationLevel};

use crate::{
    constants::{FEE_SPLIT_DENOMINATOR, PYTH_RECEIVER_PROGRAM_ID},
    error::NortiaError,
    state::{OracleConfig, OracleResolverV2, ValueComparator},
};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct NormalizedObservation {
    pub outcome: u8,
    pub value: i64,
    pub exponent: i32,
    pub timestamp: i64,
    pub confidence: u64,
}

pub fn validate_pyth_observation(
    update: &PriceUpdateV2,
    oracle: &OracleConfig,
    clock: &Clock,
) -> Result<NormalizedObservation> {
    require!(
        oracle.resolver == OracleResolverV2::PythPriceV2
            && oracle.source_program == PYTH_RECEIVER_PROGRAM_ID,
        NortiaError::InvalidOracleConfiguration
    );
    require!(
        update.verification_level == VerificationLevel::Full,
        NortiaError::InvalidOracleConfiguration
    );
    let price = update
        .get_price_unchecked(&oracle.source_id)
        .map_err(|_| error!(NortiaError::InvalidOracleConfiguration))?;
    let window_end = oracle
        .observation_ts
        .checked_add(oracle.observation_window_secs as i64)
        .ok_or_else(|| error!(NortiaError::ArithmeticOverflow))?;
    require!(
        update.price_message.prev_publish_time < oracle.observation_ts
            && price.publish_time >= oracle.observation_ts
            && price.publish_time <= window_end
            && price.publish_time <= clock.unix_timestamp,
        NortiaError::InvalidObservationTime
    );
    let report_lag = price
        .publish_time
        .checked_sub(oracle.observation_ts)
        .ok_or_else(|| error!(NortiaError::InvalidObservationTime))?;
    require!(
        report_lag <= oracle.max_staleness_secs as i64,
        NortiaError::InvalidObservationTime
    );
    require!(price.price > 0, NortiaError::InvalidOracleConfiguration);
    let confidence_ratio_left = (price.conf as u128)
        .checked_mul(FEE_SPLIT_DENOMINATOR as u128)
        .ok_or_else(|| error!(NortiaError::ArithmeticOverflow))?;
    let confidence_ratio_right = (price.price as u128)
        .checked_mul(oracle.max_confidence_bps as u128)
        .ok_or_else(|| error!(NortiaError::ArithmeticOverflow))?;
    require!(
        confidence_ratio_left <= confidence_ratio_right,
        NortiaError::InvalidOracleConfiguration
    );
    let outcome = u8::from(compare_values(
        price.price,
        price.exponent,
        oracle.threshold,
        oracle.threshold_exponent,
        oracle.comparator,
    )?);
    Ok(NormalizedObservation {
        outcome,
        value: price.price,
        exponent: price.exponent,
        timestamp: price.publish_time,
        confidence: price.conf,
    })
}

pub fn compare_values(
    left: i64,
    left_exponent: i32,
    right: i64,
    right_exponent: i32,
    comparator: ValueComparator,
) -> Result<bool> {
    require!(
        (-18..=18).contains(&left_exponent) && (-18..=18).contains(&right_exponent),
        NortiaError::InvalidOracleConfiguration
    );
    let common_exponent = left_exponent.min(right_exponent);
    let normalized_left = normalize_value(left, left_exponent, common_exponent)?;
    let normalized_right = normalize_value(right, right_exponent, common_exponent)?;
    Ok(match comparator {
        ValueComparator::GreaterThan => normalized_left > normalized_right,
        ValueComparator::GreaterThanOrEqual => normalized_left >= normalized_right,
        ValueComparator::LessThan => normalized_left < normalized_right,
        ValueComparator::LessThanOrEqual => normalized_left <= normalized_right,
        ValueComparator::Equal => normalized_left == normalized_right,
    })
}

fn normalize_value(value: i64, exponent: i32, common_exponent: i32) -> Result<i128> {
    let difference = exponent
        .checked_sub(common_exponent)
        .ok_or_else(|| error!(NortiaError::ArithmeticOverflow))?;
    require!(
        (0..=18).contains(&difference),
        NortiaError::InvalidOracleConfiguration
    );
    let scale = 10i128
        .checked_pow(difference as u32)
        .ok_or_else(|| error!(NortiaError::ArithmeticOverflow))?;
    (value as i128)
        .checked_mul(scale)
        .ok_or_else(|| error!(NortiaError::ArithmeticOverflow))
}

#[cfg(test)]
mod tests {
    use super::*;
    use pyth_solana_receiver_sdk::price_update::PriceFeedMessage;

    const FEED_ID: [u8; 32] = [7; 32];
    const OBSERVATION_TS: i64 = 1_000;

    fn oracle_config() -> OracleConfig {
        OracleConfig {
            bump: 1,
            version: OracleConfig::VERSION,
            market: Pubkey::new_unique(),
            resolver: OracleResolverV2::PythPriceV2,
            source_program: PYTH_RECEIVER_PROGRAM_ID,
            source_id: FEED_ID,
            comparator: ValueComparator::GreaterThanOrEqual,
            threshold: 100_000,
            threshold_exponent: -3,
            observation_ts: OBSERVATION_TS,
            observation_window_secs: 30,
            max_staleness_secs: 5,
            max_confidence_bps: 100,
            min_samples: 1,
            challenge_period_secs: 0,
            config_hash: [8; 32],
            consumed: false,
        }
    }

    fn price_update() -> PriceUpdateV2 {
        PriceUpdateV2 {
            write_authority: Pubkey::new_unique(),
            verification_level: VerificationLevel::Full,
            price_message: PriceFeedMessage {
                feed_id: FEED_ID,
                price: 100_000_000,
                conf: 500_000,
                exponent: -6,
                publish_time: OBSERVATION_TS + 1,
                prev_publish_time: OBSERVATION_TS - 1,
                ema_price: 100_000_000,
                ema_conf: 500_000,
            },
            posted_slot: 100,
        }
    }

    fn clock() -> Clock {
        Clock {
            slot: 101,
            epoch_start_timestamp: 0,
            epoch: 0,
            leader_schedule_epoch: 0,
            unix_timestamp: OBSERVATION_TS + 300,
        }
    }

    #[test]
    fn comparison_normalizes_decimal_exponents() {
        assert!(compare_values(10_001, -2, 100, 0, ValueComparator::GreaterThan).unwrap());
        assert!(compare_values(10, -1, 1, 0, ValueComparator::Equal).unwrap());
        assert!(compare_values(999, -3, 1, 0, ValueComparator::LessThan).unwrap());
    }

    #[test]
    fn comparison_honors_inclusive_boundaries() {
        assert!(!compare_values(50, -1, 5, 0, ValueComparator::GreaterThan).unwrap());
        assert!(compare_values(50, -1, 5, 0, ValueComparator::GreaterThanOrEqual).unwrap());
        assert!(compare_values(50, -1, 5, 0, ValueComparator::LessThanOrEqual).unwrap());
    }

    #[test]
    fn comparison_rejects_unbounded_exponents() {
        assert!(compare_values(1, -19, 1, 0, ValueComparator::Equal).is_err());
        assert!(compare_values(1, 0, 1, 19, ValueComparator::Equal).is_err());
    }

    #[test]
    fn pyth_accepts_fully_verified_timestamped_update() {
        let observation =
            validate_pyth_observation(&price_update(), &oracle_config(), &clock()).unwrap();
        assert_eq!(observation.outcome, 1);
        assert_eq!(observation.value, 100_000_000);
        assert_eq!(observation.exponent, -6);
        assert_eq!(observation.timestamp, OBSERVATION_TS + 1);
        assert_eq!(observation.confidence, 500_000);
    }

    #[test]
    fn pyth_rejects_wrong_feed_and_partial_verification() {
        let mut wrong_feed = price_update();
        wrong_feed.price_message.feed_id = [9; 32];
        assert!(validate_pyth_observation(&wrong_feed, &oracle_config(), &clock()).is_err());

        let mut partial = price_update();
        partial.verification_level = VerificationLevel::Partial { num_signatures: 5 };
        assert!(validate_pyth_observation(&partial, &oracle_config(), &clock()).is_err());
    }

    #[test]
    fn pyth_rejects_non_bracketing_and_late_updates() {
        let mut selectable_tick = price_update();
        selectable_tick.price_message.prev_publish_time = OBSERVATION_TS;
        assert!(validate_pyth_observation(&selectable_tick, &oracle_config(), &clock()).is_err());

        let mut late = price_update();
        late.price_message.publish_time = OBSERVATION_TS + 6;
        assert!(validate_pyth_observation(&late, &oracle_config(), &clock()).is_err());
    }

    #[test]
    fn pyth_rejects_future_and_out_of_window_updates() {
        let mut future = price_update();
        future.price_message.publish_time = clock().unix_timestamp + 1;
        assert!(validate_pyth_observation(&future, &oracle_config(), &clock()).is_err());

        let mut outside_window = price_update();
        outside_window.price_message.publish_time = OBSERVATION_TS + 31;
        let mut oracle = oracle_config();
        oracle.max_staleness_secs = 60;
        assert!(validate_pyth_observation(&outside_window, &oracle, &clock()).is_err());
    }

    #[test]
    fn pyth_rejects_excessive_confidence_interval() {
        let mut update = price_update();
        update.price_message.conf = 1_000_001;
        assert!(validate_pyth_observation(&update, &oracle_config(), &clock()).is_err());
    }

    #[test]
    fn pyth_honors_comparator_boundary() {
        let mut oracle = oracle_config();
        oracle.comparator = ValueComparator::GreaterThan;
        let strict = validate_pyth_observation(&price_update(), &oracle, &clock()).unwrap();
        assert_eq!(strict.outcome, 0);

        oracle.comparator = ValueComparator::GreaterThanOrEqual;
        let inclusive = validate_pyth_observation(&price_update(), &oracle, &clock()).unwrap();
        assert_eq!(inclusive.outcome, 1);
    }
}

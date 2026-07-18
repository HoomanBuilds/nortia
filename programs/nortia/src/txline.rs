use anchor_lang::{
    prelude::*,
    solana_program::{
        instruction::{AccountMeta, Instruction},
        program::{get_return_data, invoke},
    },
};

use crate::{
    constants::{
        DAILY_SCORES_ROOT_SEED, FINAL_PERIOD, MILLIS_PER_DAY, PARTICIPANT_ONE_GOALS_KEY,
        PARTICIPANT_TWO_GOALS_KEY, TXLINE_PROGRAM_ID, TXLINE_VALIDATE_STAT_DISCRIMINATOR,
    },
    error::NortiaError,
    oracles::{compare_values, NormalizedObservation},
    state::{HybridMarket, Market, MarketCategory, OracleConfig, OracleResolver, ValueComparator},
};

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct ProofNode {
    pub hash: [u8; 32],
    pub is_right_sibling: bool,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct ScoresUpdateStats {
    pub update_count: i32,
    pub min_timestamp: i64,
    pub max_timestamp: i64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct ScoresBatchSummary {
    pub fixture_id: i64,
    pub update_stats: ScoresUpdateStats,
    pub events_sub_tree_root: [u8; 32],
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct ScoreStat {
    pub key: u32,
    pub value: i32,
    pub period: i32,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct StatLeaf {
    pub stat: ScoreStat,
    pub stat_proof: Vec<ProofNode>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct StatValidationInput {
    pub ts: i64,
    pub fixture_summary: ScoresBatchSummary,
    pub fixture_proof: Vec<ProofNode>,
    pub main_tree_proof: Vec<ProofNode>,
    pub event_stat_root: [u8; 32],
    pub stats: Vec<StatLeaf>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct NDimensionalStrategy {
    pub geometric_targets: Vec<GeometricTarget>,
    pub distance_predicate: Option<TraderPredicate>,
    pub discrete_predicates: Vec<StatPredicate>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct GeometricTarget {
    pub stat_index: u8,
    pub prediction: i32,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct TraderPredicate {
    pub threshold: i32,
    pub comparison: Comparison,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub enum Comparison {
    GreaterThan,
    LessThan,
    EqualTo,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub enum BinaryExpression {
    Add,
    Subtract,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub enum StatPredicate {
    Single {
        index: u8,
        predicate: TraderPredicate,
    },
    Binary {
        index_a: u8,
        index_b: u8,
        op: BinaryExpression,
        predicate: TraderPredicate,
    },
}

pub fn resolve_total_goals_over<'info>(
    market: &Market,
    payload: &StatValidationInput,
    daily_root: &AccountInfo<'info>,
    txline_program: &AccountInfo<'info>,
) -> Result<bool> {
    require_keys_eq!(
        market.txline_program,
        TXLINE_PROGRAM_ID,
        NortiaError::InvalidTxlineProgram
    );
    require_keys_eq!(
        *txline_program.key,
        TXLINE_PROGRAM_ID,
        NortiaError::InvalidTxlineProgram
    );
    require!(txline_program.executable, NortiaError::InvalidTxlineProgram);
    require_keys_eq!(
        *daily_root.owner,
        TXLINE_PROGRAM_ID,
        NortiaError::InvalidTxlineRoot
    );
    validate_payload(market, payload, daily_root.key)?;

    let strategy = total_goals_over_strategy(market.total_goals_threshold)?;
    invoke_stat_validation(payload, &strategy, daily_root, txline_program)
}

pub fn resolve_hybrid_total_goals<'info>(
    market: &HybridMarket,
    oracle: &OracleConfig,
    payload: &StatValidationInput,
    daily_root: &AccountInfo<'info>,
    txline_program: &AccountInfo<'info>,
    now: i64,
) -> Result<NormalizedObservation> {
    require!(
        market.category == MarketCategory::Sports
            && oracle.resolver == OracleResolver::TxlineStat
            && oracle.source_program == TXLINE_PROGRAM_ID,
        NortiaError::InvalidOracleConfiguration
    );
    require_keys_eq!(
        *txline_program.key,
        TXLINE_PROGRAM_ID,
        NortiaError::InvalidTxlineProgram
    );
    require!(txline_program.executable, NortiaError::InvalidTxlineProgram);
    require_keys_eq!(
        *daily_root.owner,
        TXLINE_PROGRAM_ID,
        NortiaError::InvalidTxlineRoot
    );
    validate_hybrid_payload(oracle, payload, daily_root.key, now)?;

    let threshold = i32::try_from(oracle.threshold)
        .map_err(|_| error!(NortiaError::InvalidOracleConfiguration))?;
    let strategy = total_goals_strategy(threshold, oracle.comparator)?;
    let oracle_outcome = invoke_stat_validation(payload, &strategy, daily_root, txline_program)?;
    let score_a = payload.stats[0].stat.value as i128;
    let score_b = payload.stats[1].stat.value as i128;
    let total = score_a
        .checked_add(score_b)
        .ok_or_else(|| error!(NortiaError::ArithmeticOverflow))?;
    let expected_outcome = compare_values(total, 0, oracle.threshold, 0, oracle.comparator)?;
    require!(
        oracle_outcome == expected_outcome,
        NortiaError::InvalidTxlineReturn
    );
    Ok(NormalizedObservation {
        outcome: u8::from(oracle_outcome),
        value: total,
        exponent: 0,
        timestamp: payload
            .fixture_summary
            .update_stats
            .max_timestamp
            .div_euclid(1_000),
        slot: 0,
        confidence: 0,
        sample_count: 0,
    })
}

fn invoke_stat_validation<'info>(
    payload: &StatValidationInput,
    strategy: &NDimensionalStrategy,
    daily_root: &AccountInfo<'info>,
    txline_program: &AccountInfo<'info>,
) -> Result<bool> {
    let mut data = TXLINE_VALIDATE_STAT_DISCRIMINATOR.to_vec();
    payload
        .serialize(&mut data)
        .map_err(|_| error!(NortiaError::InvalidScorePayload))?;
    strategy
        .serialize(&mut data)
        .map_err(|_| error!(NortiaError::InvalidScorePayload))?;

    let instruction = Instruction {
        program_id: TXLINE_PROGRAM_ID,
        accounts: vec![AccountMeta::new_readonly(*daily_root.key, false)],
        data,
    };
    invoke(&instruction, &[daily_root.clone(), txline_program.clone()])?;

    let (returning_program, return_data) =
        get_return_data().ok_or_else(|| error!(NortiaError::InvalidTxlineReturn))?;
    require_keys_eq!(
        returning_program,
        TXLINE_PROGRAM_ID,
        NortiaError::InvalidTxlineReturn
    );
    match return_data.as_slice() {
        [0] => Ok(false),
        [1] => Ok(true),
        _ => err!(NortiaError::InvalidTxlineReturn),
    }
}

fn validate_payload(
    market: &Market,
    payload: &StatValidationInput,
    daily_root: &Pubkey,
) -> Result<()> {
    require!(
        payload.fixture_summary.fixture_id == market.fixture_id,
        NortiaError::InvalidScorePayload
    );
    require!(payload.stats.len() == 2, NortiaError::InvalidScorePayload);
    require!(
        payload.fixture_summary.update_stats.update_count > 0,
        NortiaError::InvalidScorePayload
    );
    require!(
        payload.fixture_summary.update_stats.min_timestamp
            <= payload.fixture_summary.update_stats.max_timestamp,
        NortiaError::InvalidScorePayload
    );
    require!(
        payload.ts == payload.fixture_summary.update_stats.min_timestamp,
        NortiaError::InvalidScorePayload
    );

    let score_a = &payload.stats[0].stat;
    let score_b = &payload.stats[1].stat;
    require!(
        score_a.key == market.score_key_a,
        NortiaError::InvalidScorePayload
    );
    require!(
        score_b.key == market.score_key_b,
        NortiaError::InvalidScorePayload
    );
    require!(
        score_a.period == FINAL_PERIOD,
        NortiaError::InvalidScorePayload
    );
    require!(
        score_b.period == FINAL_PERIOD,
        NortiaError::InvalidScorePayload
    );
    require!(score_a.value >= 0, NortiaError::InvalidScorePayload);
    require!(score_b.value >= 0, NortiaError::InvalidScorePayload);

    let expected_root = daily_scores_root(payload.ts)?;
    require_keys_eq!(*daily_root, expected_root, NortiaError::InvalidTxlineRoot);
    Ok(())
}

fn validate_hybrid_payload(
    oracle: &OracleConfig,
    payload: &StatValidationInput,
    daily_root: &Pubkey,
    now: i64,
) -> Result<()> {
    require!(
        payload.fixture_summary.fixture_id == fixture_id_from_source_id(&oracle.source_id)?,
        NortiaError::InvalidScorePayload
    );
    require!(payload.stats.len() == 2, NortiaError::InvalidScorePayload);
    require!(
        payload.fixture_summary.update_stats.update_count > 0
            && payload.fixture_summary.update_stats.min_timestamp
                <= payload.fixture_summary.update_stats.max_timestamp
            && payload.ts == payload.fixture_summary.update_stats.min_timestamp,
        NortiaError::InvalidScorePayload
    );
    let score_a = &payload.stats[0].stat;
    let score_b = &payload.stats[1].stat;
    require!(
        score_a.key == PARTICIPANT_ONE_GOALS_KEY
            && score_b.key == PARTICIPANT_TWO_GOALS_KEY
            && score_a.period == FINAL_PERIOD
            && score_b.period == FINAL_PERIOD
            && score_a.value >= 0
            && score_b.value >= 0,
        NortiaError::InvalidScorePayload
    );
    let proof_ts = payload
        .fixture_summary
        .update_stats
        .max_timestamp
        .div_euclid(1_000);
    let window_end = oracle
        .observation_ts
        .checked_add(oracle.observation_window_secs as i64)
        .ok_or_else(|| error!(NortiaError::ArithmeticOverflow))?;
    let report_lag = proof_ts
        .checked_sub(oracle.observation_ts)
        .ok_or_else(|| error!(NortiaError::InvalidObservationTime))?;
    require!(
        proof_ts >= oracle.observation_ts
            && proof_ts <= window_end
            && proof_ts <= now
            && report_lag <= oracle.max_staleness_secs as i64,
        NortiaError::InvalidObservationTime
    );
    let expected_root = daily_scores_root(payload.ts)?;
    require_keys_eq!(*daily_root, expected_root, NortiaError::InvalidTxlineRoot);
    Ok(())
}

pub fn txline_source_id(fixture_id: i64) -> Result<[u8; 32]> {
    require!(fixture_id > 0, NortiaError::InvalidOracleConfiguration);
    let mut source_id = [0; 32];
    source_id[..8].copy_from_slice(&fixture_id.to_le_bytes());
    Ok(source_id)
}

pub fn fixture_id_from_source_id(source_id: &[u8; 32]) -> Result<i64> {
    require!(
        source_id[8..].iter().all(|value| *value == 0),
        NortiaError::InvalidOracleConfiguration
    );
    let fixture_id = i64::from_le_bytes(
        source_id[..8]
            .try_into()
            .map_err(|_| error!(NortiaError::InvalidOracleConfiguration))?,
    );
    require!(fixture_id > 0, NortiaError::InvalidOracleConfiguration);
    Ok(fixture_id)
}

fn daily_scores_root(timestamp_ms: i64) -> Result<Pubkey> {
    let epoch_day = timestamp_ms.div_euclid(MILLIS_PER_DAY);
    require!(
        (0..=u16::MAX as i64).contains(&epoch_day),
        NortiaError::InvalidTxlineRoot
    );
    let epoch_day_bytes = (epoch_day as u16).to_le_bytes();
    Ok(Pubkey::find_program_address(
        &[DAILY_SCORES_ROOT_SEED, &epoch_day_bytes],
        &TXLINE_PROGRAM_ID,
    )
    .0)
}

fn total_goals_over_strategy(threshold: i32) -> Result<NDimensionalStrategy> {
    total_goals_strategy(threshold, ValueComparator::GreaterThan)
}

fn total_goals_strategy(
    threshold: i32,
    comparator: ValueComparator,
) -> Result<NDimensionalStrategy> {
    let predicate = match comparator {
        ValueComparator::GreaterThan => TraderPredicate {
            threshold,
            comparison: Comparison::GreaterThan,
        },
        ValueComparator::GreaterThanOrEqual => TraderPredicate {
            threshold: threshold
                .checked_sub(1)
                .ok_or_else(|| error!(NortiaError::InvalidOracleConfiguration))?,
            comparison: Comparison::GreaterThan,
        },
        ValueComparator::LessThan => TraderPredicate {
            threshold,
            comparison: Comparison::LessThan,
        },
        ValueComparator::LessThanOrEqual => TraderPredicate {
            threshold: threshold
                .checked_add(1)
                .ok_or_else(|| error!(NortiaError::InvalidOracleConfiguration))?,
            comparison: Comparison::LessThan,
        },
        ValueComparator::Equal => TraderPredicate {
            threshold,
            comparison: Comparison::EqualTo,
        },
    };
    Ok(NDimensionalStrategy {
        geometric_targets: vec![],
        distance_predicate: None,
        discrete_predicates: vec![StatPredicate::Binary {
            index_a: 0,
            index_b: 1,
            op: BinaryExpression::Add,
            predicate,
        }],
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    const FIXTURE_ID: i64 = 42;
    const OBSERVATION_TS: i64 = 2_000;

    fn hybrid_oracle() -> OracleConfig {
        OracleConfig {
            bump: 1,
            version: OracleConfig::VERSION,
            market: Pubkey::new_unique(),
            resolver: OracleResolver::TxlineStat,
            source_program: TXLINE_PROGRAM_ID,
            source_queue: Pubkey::default(),
            source_id: txline_source_id(FIXTURE_ID).unwrap(),
            comparator: ValueComparator::GreaterThan,
            threshold: 2,
            threshold_exponent: 0,
            observation_ts: OBSERVATION_TS,
            observation_window_secs: 60,
            max_staleness_secs: 30,
            max_staleness_slots: 0,
            max_confidence_bps: 0,
            min_samples: 1,
            challenge_period_secs: 0,
            bond_amount: 0,
            config_hash: [8; 32],
            optimistic_proposal: Pubkey::default(),
            consumed: false,
        }
    }

    fn validation_payload() -> StatValidationInput {
        let timestamp_ms = (OBSERVATION_TS + 1) * 1_000;
        StatValidationInput {
            ts: timestamp_ms,
            fixture_summary: ScoresBatchSummary {
                fixture_id: FIXTURE_ID,
                update_stats: ScoresUpdateStats {
                    update_count: 3,
                    min_timestamp: timestamp_ms,
                    max_timestamp: timestamp_ms + 500,
                },
                events_sub_tree_root: [1; 32],
            },
            fixture_proof: vec![],
            main_tree_proof: vec![],
            event_stat_root: [2; 32],
            stats: vec![
                StatLeaf {
                    stat: ScoreStat {
                        key: PARTICIPANT_ONE_GOALS_KEY,
                        value: 2,
                        period: FINAL_PERIOD,
                    },
                    stat_proof: vec![],
                },
                StatLeaf {
                    stat: ScoreStat {
                        key: PARTICIPANT_TWO_GOALS_KEY,
                        value: 1,
                        period: FINAL_PERIOD,
                    },
                    stat_proof: vec![],
                },
            ],
        }
    }

    #[test]
    fn strategy_adds_goal_keys_and_compares_to_threshold() {
        let strategy = total_goals_over_strategy(2).unwrap();
        assert_eq!(strategy.discrete_predicates.len(), 1);
        match &strategy.discrete_predicates[0] {
            StatPredicate::Binary {
                index_a,
                index_b,
                op: BinaryExpression::Add,
                predicate:
                    TraderPredicate {
                        threshold,
                        comparison: Comparison::GreaterThan,
                    },
            } => assert_eq!((*index_a, *index_b, *threshold), (0, 1, 2)),
            _ => panic!("unexpected strategy"),
        }
    }

    #[test]
    fn daily_root_uses_epoch_day_in_little_endian() {
        let timestamp = 20_000_i64 * MILLIS_PER_DAY;
        let epoch_bytes = 20_000_u16.to_le_bytes();
        let expected = Pubkey::find_program_address(
            &[DAILY_SCORES_ROOT_SEED, &epoch_bytes],
            &TXLINE_PROGRAM_ID,
        )
        .0;
        assert_eq!(daily_scores_root(timestamp).unwrap(), expected);
    }

    #[test]
    fn daily_root_rejects_negative_timestamp() {
        assert!(daily_scores_root(-1).is_err());
    }

    #[test]
    fn source_id_round_trips_fixture_without_ambiguous_tail() {
        let source_id = txline_source_id(FIXTURE_ID).unwrap();
        assert_eq!(fixture_id_from_source_id(&source_id).unwrap(), FIXTURE_ID);
        assert!(txline_source_id(0).is_err());

        let mut ambiguous = source_id;
        ambiguous[8] = 1;
        assert!(fixture_id_from_source_id(&ambiguous).is_err());
    }

    #[test]
    fn strategy_encodes_inclusive_integer_comparators() {
        let greater_equal = total_goals_strategy(3, ValueComparator::GreaterThanOrEqual).unwrap();
        match &greater_equal.discrete_predicates[0] {
            StatPredicate::Binary {
                predicate:
                    TraderPredicate {
                        threshold,
                        comparison: Comparison::GreaterThan,
                    },
                ..
            } => assert_eq!(*threshold, 2),
            _ => panic!("unexpected strategy"),
        }

        let less_equal = total_goals_strategy(3, ValueComparator::LessThanOrEqual).unwrap();
        match &less_equal.discrete_predicates[0] {
            StatPredicate::Binary {
                predicate:
                    TraderPredicate {
                        threshold,
                        comparison: Comparison::LessThan,
                    },
                ..
            } => assert_eq!(*threshold, 4),
            _ => panic!("unexpected strategy"),
        }
        assert!(total_goals_strategy(i32::MIN, ValueComparator::GreaterThanOrEqual).is_err());
        assert!(total_goals_strategy(i32::MAX, ValueComparator::LessThanOrEqual).is_err());
    }

    #[test]
    fn hybrid_payload_binds_fixture_final_stats_time_and_root() {
        let oracle = hybrid_oracle();
        let payload = validation_payload();
        let root = daily_scores_root(payload.ts).unwrap();
        assert!(validate_hybrid_payload(&oracle, &payload, &root, OBSERVATION_TS + 10).is_ok());

        let mut wrong_fixture = payload.clone();
        wrong_fixture.fixture_summary.fixture_id += 1;
        assert!(
            validate_hybrid_payload(&oracle, &wrong_fixture, &root, OBSERVATION_TS + 10).is_err()
        );

        let mut non_final = payload.clone();
        non_final.stats[0].stat.period = FINAL_PERIOD - 1;
        assert!(validate_hybrid_payload(&oracle, &non_final, &root, OBSERVATION_TS + 10).is_err());

        let mut negative_score = payload.clone();
        negative_score.stats[1].stat.value = -1;
        assert!(
            validate_hybrid_payload(&oracle, &negative_score, &root, OBSERVATION_TS + 10).is_err()
        );

        assert!(validate_hybrid_payload(
            &oracle,
            &payload,
            &Pubkey::new_unique(),
            OBSERVATION_TS + 10
        )
        .is_err());
    }

    #[test]
    fn hybrid_payload_rejects_future_late_and_out_of_window_proofs() {
        let oracle = hybrid_oracle();
        let mut payload = validation_payload();
        let root = daily_scores_root(payload.ts).unwrap();
        assert!(validate_hybrid_payload(&oracle, &payload, &root, OBSERVATION_TS).is_err());

        payload.ts = (OBSERVATION_TS + 31) * 1_000;
        payload.fixture_summary.update_stats.min_timestamp = payload.ts;
        payload.fixture_summary.update_stats.max_timestamp = payload.ts;
        let late_root = daily_scores_root(payload.ts).unwrap();
        assert!(
            validate_hybrid_payload(&oracle, &payload, &late_root, OBSERVATION_TS + 40).is_err()
        );

        let mut wide_oracle = hybrid_oracle();
        wide_oracle.max_staleness_secs = 120;
        payload.ts = (OBSERVATION_TS + 61) * 1_000;
        payload.fixture_summary.update_stats.min_timestamp = payload.ts;
        payload.fixture_summary.update_stats.max_timestamp = payload.ts;
        let outside_root = daily_scores_root(payload.ts).unwrap();
        assert!(validate_hybrid_payload(
            &wide_oracle,
            &payload,
            &outside_root,
            OBSERVATION_TS + 90
        )
        .is_err());
    }
}

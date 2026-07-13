use anchor_lang::{
    prelude::*,
    solana_program::{
        instruction::{AccountMeta, Instruction},
        program::{get_return_data, invoke},
    },
};

use crate::{
    constants::{
        DAILY_SCORES_ROOT_SEED, FINAL_PERIOD, MILLIS_PER_DAY, TXLINE_PROGRAM_ID,
        TXLINE_VALIDATE_STAT_V2_DISCRIMINATOR,
    },
    error::NortiaError,
    state::Market,
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

    let strategy = total_goals_over_strategy(market.total_goals_threshold);
    let mut data = TXLINE_VALIDATE_STAT_V2_DISCRIMINATOR.to_vec();
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

fn total_goals_over_strategy(threshold: i32) -> NDimensionalStrategy {
    NDimensionalStrategy {
        geometric_targets: vec![],
        distance_predicate: None,
        discrete_predicates: vec![StatPredicate::Binary {
            index_a: 0,
            index_b: 1,
            op: BinaryExpression::Add,
            predicate: TraderPredicate {
                threshold,
                comparison: Comparison::GreaterThan,
            },
        }],
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn strategy_adds_goal_keys_and_compares_to_threshold() {
        let strategy = total_goals_over_strategy(2);
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
}

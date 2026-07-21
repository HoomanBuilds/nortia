use anchor_lang::prelude::*;

use crate::constants::COMMITTEE_SIZE;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq, Eq)]
pub enum MarketMode {
    Live,
    Replay,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq, Eq)]
pub enum MarketCategory {
    Sports,
    Crypto,
    Politics,
    Technology,
    Culture,
    Other,
    Economics,
    Science,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq, Eq)]
pub enum ResolverKind {
    TxlineStat,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq, Eq)]
pub enum MarketPhase {
    Open,
    Batched,
    Resolved,
    Refunding,
    Closed,
}

#[account]
pub struct ProtocolConfig {
    pub bump: u8,
    pub authority: Pubkey,
    pub treasury_owner: Pubkey,
    pub fee_bps: u16,
    pub keeper_reward_bps: u16,
    pub collateral_mint: Pubkey,
    pub token_program: Pubkey,
    pub txline_program: Pubkey,
    pub committee: [Pubkey; COMMITTEE_SIZE],
    pub placement_verifier: Pubkey,
    pub redeem_verifier: Pubkey,
}

impl ProtocolConfig {
    pub const SPACE: usize = 8 + 325;
}

#[account]
pub struct Market {
    pub bump: u8,
    pub vault_bump: u8,
    pub market_id: u64,
    pub authority: Pubkey,
    pub category: MarketCategory,
    pub resolver_kind: ResolverKind,
    pub question_hash: [u8; 32],
    pub rules_hash: [u8; 32],
    pub fixture_id: i64,
    pub market_mode: MarketMode,
    pub fixture_start_ts: i64,
    pub score_key_a: u32,
    pub score_key_b: u32,
    pub total_goals_threshold: i32,
    pub collateral_mint: Pubkey,
    pub token_program: Pubkey,
    pub ticket_amount: u64,
    pub fee_bps: u16,
    pub keeper_reward_bps: u16,
    pub treasury_owner: Pubkey,
    pub txline_program: Pubkey,
    pub lock_ts: i64,
    pub batch_deadline_ts: i64,
    pub resolution_deadline_ts: i64,
    pub phase: MarketPhase,
    pub order_count: u32,
    pub yes_count: u32,
    pub no_count: u32,
    pub commitment_root: [u8; 32],
    pub outcome: u8,
    pub committee: [Pubkey; COMMITTEE_SIZE],
    pub placement_verifier: Pubkey,
    pub redeem_verifier: Pubkey,
    pub gross_pool: u64,
    pub protocol_fee: u64,
    pub keeper_reward: u64,
    pub treasury_fee: u64,
    pub net_pool: u64,
    pub payout_amount: u64,
    pub payout_remainder: u64,
    pub claimed_count: u32,
    pub refunded_count: u32,
    pub settled_at: i64,
    pub txline_proof_ts: i64,
    pub final_seq: u32,
    pub daily_scores_root: Pubkey,
    pub settlement_evidence_hash: [u8; 32],
    pub score_a: i32,
    pub score_b: i32,
}

impl Market {
    pub const SPACE: usize = 8 + 1024;
    pub const OUTCOME_UNSET: u8 = 2;

    pub fn winner_count(&self) -> u32 {
        if self.outcome == 1 {
            self.yes_count
        } else {
            self.no_count
        }
    }
}

#[account]
pub struct Order {
    pub bump: u8,
    pub market: Pubkey,
    pub payer: Pubkey,
    pub order_index: u32,
    pub commitment: [u8; 32],
    pub share_commitments: [[u8; 32]; COMMITTEE_SIZE],
    pub refunded: bool,
}

impl Order {
    pub const SPACE: usize = 8 + 1 + 32 + 32 + 4 + 32 + 96 + 1;
}

#[account]
pub struct Claim {
    pub bump: u8,
    pub market: Pubkey,
    pub nullifier_hash: [u8; 32],
    pub recipient_owner: Pubkey,
    pub recipient_token: Pubkey,
    pub amount: u64,
}

impl Claim {
    pub const SPACE: usize = 8 + 1 + 32 + 32 + 32 + 32 + 8;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq, Eq)]
pub enum HybridPhase {
    Open,
    Locked,
    Resolving,
    Disputed,
    Resolved,
    Closed,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq, Eq)]
pub enum HybridTradingMode {
    Continuous,
    PrivateBatch,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq, Eq)]
pub enum HybridPricingModel {
    Lmsr,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq, Eq)]
pub enum OracleResolver {
    TxlineStat,
    PythPrice,
    SwitchboardQuote,
    Optimistic,
    UmaWormhole,
    ChainlinkReport,
    StorkPrice,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq, Eq)]
pub enum ValueComparator {
    GreaterThan,
    GreaterThanOrEqual,
    LessThan,
    LessThanOrEqual,
    Equal,
}

#[account]
pub struct EngineConfig {
    pub bump: u8,
    pub version: u8,
    pub authority: Pubkey,
    pub treasury_owner: Pubkey,
    pub collateral_mint: Pubkey,
    pub token_program: Pubkey,
    pub treasury_fee_share_bps: u16,
    pub pyth_receiver_program: Pubkey,
    pub switchboard_quote_program: Pubkey,
    pub paused: bool,
}

impl EngineConfig {
    pub const VERSION: u8 = 1;
    pub const SPACE: usize = 8 + 197;
}

#[account]
pub struct HybridMarket {
    pub bump: u8,
    pub vault_bump: u8,
    pub version: u8,
    pub market_id: u64,
    pub creator: Pubkey,
    pub liquidity_owner: Pubkey,
    pub category: MarketCategory,
    pub trading_mode: HybridTradingMode,
    pub pricing_model: HybridPricingModel,
    pub question_hash: [u8; 32],
    pub rules_hash: [u8; 32],
    pub outcome_labels_hash: [u8; 32],
    pub collateral_mint: Pubkey,
    pub token_program: Pubkey,
    pub treasury_owner: Pubkey,
    pub oracle_config: Pubkey,
    pub liquidity_parameter: u64,
    pub initial_subsidy: u64,
    pub rounding_reserve: u64,
    pub max_trade_shares: u64,
    pub resolver_security_cap: u64,
    pub yes_quantity: u64,
    pub no_quantity: u64,
    pub trade_fee_bps: u16,
    pub treasury_fee_share_bps: u16,
    pub open_ts: i64,
    pub lock_ts: i64,
    pub resolve_not_before_ts: i64,
    pub resolution_deadline_ts: i64,
    pub phase: HybridPhase,
    pub outcome: u8,
    pub trade_count: u64,
    pub volume: u64,
    pub treasury_fees: u64,
    pub liquidity_fees: u64,
    pub outstanding_liability: u64,
    pub redeemed_liability: u64,
    pub settled_at: i64,
    pub settlement_evidence_hash: [u8; 32],
}

impl HybridMarket {
    pub const VERSION: u8 = 1;
    pub const SPACE: usize = 8 + 768;
    pub const OUTCOME_YES: u8 = 1;
    pub const OUTCOME_NO: u8 = 0;
    pub const OUTCOME_INVALID: u8 = 2;
    pub const OUTCOME_UNSET: u8 = 3;
}

#[account]
pub struct OracleConfig {
    pub bump: u8,
    pub version: u8,
    pub market: Pubkey,
    pub resolver: OracleResolver,
    pub source_program: Pubkey,
    pub source_queue: Pubkey,
    pub source_id: [u8; 32],
    pub comparator: ValueComparator,
    pub threshold: i128,
    pub threshold_exponent: i32,
    pub observation_ts: i64,
    pub observation_window_secs: u32,
    pub max_staleness_secs: u32,
    pub max_staleness_slots: u64,
    pub max_confidence_bps: u16,
    pub min_samples: u8,
    pub challenge_period_secs: u32,
    pub bond_amount: u64,
    pub config_hash: [u8; 32],
    pub optimistic_proposal: Pubkey,
    pub consumed: bool,
}

impl OracleConfig {
    pub const VERSION: u8 = 1;
    pub const SPACE: usize = 8 + 256;
}

#[account]
pub struct Position {
    pub bump: u8,
    pub version: u8,
    pub market: Pubkey,
    pub owner: Pubkey,
    pub yes_shares: u64,
    pub no_shares: u64,
    pub total_spent: u64,
    pub total_proceeds: u64,
    pub settled_amount: u64,
    pub settled: bool,
}

impl Position {
    pub const VERSION: u8 = 1;
    pub const SPACE: usize = 8 + 128;
}

#[account]
pub struct ResolutionReceipt {
    pub bump: u8,
    pub version: u8,
    pub market: Pubkey,
    pub resolver: OracleResolver,
    pub outcome: u8,
    pub observation_value: i128,
    pub observation_exponent: i32,
    pub observation_ts: i64,
    pub observation_slot: u64,
    pub confidence: u64,
    pub sample_count: u8,
    pub source_queue: Pubkey,
    pub source_id: [u8; 32],
    pub source_account: Pubkey,
    pub evidence_hash: [u8; 32],
    pub finalized_at: i64,
}

impl ResolutionReceipt {
    pub const VERSION: u8 = 1;
    pub const SPACE: usize = 8 + 224;
}

#[account]
pub struct OptimisticProposal {
    pub bump: u8,
    pub bond_vault_bump: u8,
    pub version: u8,
    pub market: Pubkey,
    pub proposer: Pubkey,
    pub proposer_token: Pubkey,
    pub proposed_outcome: u8,
    pub assertion_hash: [u8; 32],
    pub assertion_evidence_uri: String,
    pub proposed_at: i64,
    pub challenge_deadline: i64,
    pub challenger: Pubkey,
    pub challenger_token: Pubkey,
    pub challenged_outcome: u8,
    pub challenge_hash: [u8; 32],
    pub challenge_evidence_uri: String,
    pub challenged_at: i64,
    pub bond_amount: u64,
    pub proposer_payout: u64,
    pub challenger_payout: u64,
    pub treasury_payout: u64,
    pub proposer_claimed: bool,
    pub challenger_claimed: bool,
    pub treasury_claimed: bool,
    pub finalized: bool,
    pub winner: Pubkey,
    pub decision_hash: [u8; 32],
}

impl OptimisticProposal {
    pub const VERSION: u8 = 1;
    pub const SPACE: usize = 8 + 768;
}

#[account]
pub struct HybridMarketMetadata {
    pub bump: u8,
    pub version: u8,
    pub market: Pubkey,
    pub creator: Pubkey,
    pub question: String,
    pub rules: String,
    pub yes_label: String,
    pub no_label: String,
    pub reference_url: String,
    pub published_at: i64,
}

impl HybridMarketMetadata {
    pub const VERSION: u8 = 1;
    pub const SPACE: usize = 8
        + 1
        + 1
        + 32
        + 32
        + 4
        + crate::constants::MAX_QUESTION_BYTES
        + 4
        + crate::constants::MAX_RULES_BYTES
        + 4
        + crate::constants::MAX_OUTCOME_LABEL_BYTES
        + 4
        + crate::constants::MAX_OUTCOME_LABEL_BYTES
        + 4
        + crate::constants::MAX_REFERENCE_URL_BYTES
        + 8;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct InitializeProtocolArgs {
    pub treasury_owner: Pubkey,
    pub fee_bps: u16,
    pub keeper_reward_bps: u16,
    pub committee: [Pubkey; COMMITTEE_SIZE],
    pub placement_verifier: Pubkey,
    pub redeem_verifier: Pubkey,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct InitializeMarketArgs {
    pub market_id: u64,
    pub category: MarketCategory,
    pub resolver_kind: ResolverKind,
    pub question_hash: [u8; 32],
    pub rules_hash: [u8; 32],
    pub fixture_id: i64,
    pub total_goals_threshold: i32,
    pub market_mode: MarketMode,
    pub fixture_start_ts: i64,
    pub lock_ts: i64,
    pub batch_deadline_ts: i64,
    pub resolution_deadline_ts: i64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct PlaceOrderArgs {
    pub commitment: [u8; 32],
    pub share_commitments: [[u8; 32]; COMMITTEE_SIZE],
    pub proof: Vec<u8>,
    pub public_witness: Vec<u8>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct SubmitBatchArgs {
    pub commitment_root: [u8; 32],
    pub yes_count: u32,
    pub no_count: u32,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct RedeemArgs {
    pub nullifier_hash: [u8; 32],
    pub proof: Vec<u8>,
    pub public_witness: Vec<u8>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct InitializeEngineArgs {
    pub treasury_fee_share_bps: u16,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct OracleConfigArgs {
    pub resolver: OracleResolver,
    pub source_program: Pubkey,
    pub source_queue: Pubkey,
    pub source_id: [u8; 32],
    pub comparator: ValueComparator,
    pub threshold: i128,
    pub threshold_exponent: i32,
    pub observation_ts: i64,
    pub observation_window_secs: u32,
    pub max_staleness_secs: u32,
    pub max_staleness_slots: u64,
    pub max_confidence_bps: u16,
    pub min_samples: u8,
    pub challenge_period_secs: u32,
    pub bond_amount: u64,
    pub config_hash: [u8; 32],
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct InitializeHybridMarketArgs {
    pub market_id: u64,
    pub category: MarketCategory,
    pub trading_mode: HybridTradingMode,
    pub question_hash: [u8; 32],
    pub rules_hash: [u8; 32],
    pub outcome_labels_hash: [u8; 32],
    pub liquidity_parameter: u64,
    pub rounding_reserve: u64,
    pub max_trade_shares: u64,
    pub trade_fee_bps: u16,
    pub lock_ts: i64,
    pub resolve_not_before_ts: i64,
    pub resolution_deadline_ts: i64,
    pub oracle: OracleConfigArgs,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct TradeSharesArgs {
    pub side: u8,
    pub shares: u64,
    pub amount_guard: u64,
    pub deadline_ts: i64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct PublishHybridMetadataArgs {
    pub question: String,
    pub rules: String,
    pub yes_label: String,
    pub no_label: String,
    pub reference_url: String,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct ProposeOptimisticArgs {
    pub outcome: u8,
    pub assertion_hash: [u8; 32],
    pub evidence_uri: String,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct ChallengeOptimisticArgs {
    pub outcome: u8,
    pub challenge_hash: [u8; 32],
    pub evidence_uri: String,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct ArbitrateOptimisticArgs {
    pub outcome: u8,
    pub decision_hash: [u8; 32],
}

#[event]
pub struct ProtocolInitialized {
    pub protocol: Pubkey,
    pub authority: Pubkey,
    pub treasury_owner: Pubkey,
    pub collateral_mint: Pubkey,
    pub fee_bps: u16,
    pub keeper_reward_bps: u16,
    pub committee: [Pubkey; COMMITTEE_SIZE],
    pub placement_verifier: Pubkey,
    pub redeem_verifier: Pubkey,
}

#[event]
pub struct VerifiersRotated {
    pub protocol: Pubkey,
    pub authority: Pubkey,
    pub previous_placement_verifier: Pubkey,
    pub previous_redeem_verifier: Pubkey,
    pub placement_verifier: Pubkey,
    pub redeem_verifier: Pubkey,
}

#[event]
pub struct MarketVerifiersSynced {
    pub market: Pubkey,
    pub authority: Pubkey,
    pub previous_placement_verifier: Pubkey,
    pub previous_redeem_verifier: Pubkey,
    pub placement_verifier: Pubkey,
    pub redeem_verifier: Pubkey,
}

#[event]
pub struct MarketCreated {
    pub market: Pubkey,
    pub market_id: u64,
    pub authority: Pubkey,
    pub category: MarketCategory,
    pub resolver_kind: ResolverKind,
    pub question_hash: [u8; 32],
    pub rules_hash: [u8; 32],
    pub fixture_id: i64,
    pub total_goals_threshold: i32,
    pub market_mode: MarketMode,
    pub collateral_mint: Pubkey,
    pub ticket_amount: u64,
    pub fee_bps: u16,
    pub lock_ts: i64,
}

#[event]
pub struct OrderPlaced {
    pub market: Pubkey,
    pub order: Pubkey,
    pub order_index: u32,
    pub commitment: [u8; 32],
    pub order_count: u32,
}

#[event]
pub struct BatchSubmitted {
    pub market: Pubkey,
    pub commitment_root: [u8; 32],
    pub yes_count: u32,
    pub no_count: u32,
    pub refunding: bool,
}

#[event]
pub struct MarketResolved {
    pub market: Pubkey,
    pub outcome: u8,
    pub score_a: i32,
    pub score_b: i32,
    pub gross_pool: u64,
    pub protocol_fee: u64,
    pub keeper_reward: u64,
    pub treasury_fee: u64,
    pub net_pool: u64,
    pub payout_amount: u64,
    pub payout_remainder: u64,
    pub settlement_evidence_hash: [u8; 32],
}

#[event]
pub struct ProtocolFeeCollected {
    pub market: Pubkey,
    pub treasury_owner: Pubkey,
    pub treasury_token: Pubkey,
    pub gross_pool: u64,
    pub fee_bps: u16,
    pub treasury_amount: u64,
    pub keeper: Pubkey,
    pub keeper_amount: u64,
}

#[event]
pub struct RefundsOpened {
    pub market: Pubkey,
}

#[event]
pub struct OrderRefunded {
    pub market: Pubkey,
    pub order: Pubkey,
    pub payer: Pubkey,
    pub amount: u64,
}

#[event]
pub struct WinningsRedeemed {
    pub market: Pubkey,
    pub nullifier_hash: [u8; 32],
    pub recipient_owner: Pubkey,
    pub recipient_token: Pubkey,
    pub amount: u64,
}

#[event]
pub struct MarketClosed {
    pub market: Pubkey,
}

#[event]
pub struct EngineInitialized {
    pub engine: Pubkey,
    pub authority: Pubkey,
    pub treasury_owner: Pubkey,
    pub collateral_mint: Pubkey,
    pub treasury_fee_share_bps: u16,
    pub pyth_receiver_program: Pubkey,
    pub switchboard_quote_program: Pubkey,
}

#[event]
pub struct HybridMarketCreated {
    pub market: Pubkey,
    pub market_id: u64,
    pub creator: Pubkey,
    pub category: MarketCategory,
    pub resolver: OracleResolver,
    pub liquidity_parameter: u64,
    pub initial_subsidy: u64,
    pub trade_fee_bps: u16,
    pub resolver_security_cap: u64,
    pub lock_ts: i64,
}

#[event]
pub struct HybridMetadataPublished {
    pub market: Pubkey,
    pub metadata: Pubkey,
    pub creator: Pubkey,
    pub published_at: i64,
}

#[event]
pub struct HybridPositionOpened {
    pub market: Pubkey,
    pub position: Pubkey,
    pub owner: Pubkey,
}

#[event]
pub struct HybridTradeExecuted {
    pub market: Pubkey,
    pub position: Pubkey,
    pub owner: Pubkey,
    pub direction: u8,
    pub side: u8,
    pub shares: u64,
    pub raw_amount: u64,
    pub fee_amount: u64,
    pub total_amount: u64,
    pub before_yes_probability: u64,
    pub after_yes_probability: u64,
    pub yes_quantity: u64,
    pub no_quantity: u64,
}

#[event]
pub struct HybridMarketLocked {
    pub market: Pubkey,
    pub locked_at: i64,
}

#[event]
pub struct HybridMarketResolved {
    pub market: Pubkey,
    pub outcome: u8,
    pub resolver: OracleResolver,
    pub outstanding_liability: u64,
    pub evidence_hash: [u8; 32],
    pub settled_at: i64,
}

#[event]
pub struct HybridPositionSettled {
    pub market: Pubkey,
    pub position: Pubkey,
    pub owner: Pubkey,
    pub outcome: u8,
    pub amount: u64,
}

#[event]
pub struct HybridLiquidityWithdrawn {
    pub market: Pubkey,
    pub liquidity_owner: Pubkey,
    pub amount: u64,
    pub outstanding_liability: u64,
}

#[event]
pub struct HybridMarketClosed {
    pub market: Pubkey,
    pub closed_at: i64,
}

#[event]
pub struct OptimisticResolutionProposed {
    pub market: Pubkey,
    pub proposal: Pubkey,
    pub proposer: Pubkey,
    pub outcome: u8,
    pub assertion_hash: [u8; 32],
    pub evidence_uri: String,
    pub bond_amount: u64,
    pub challenge_deadline: i64,
}

#[event]
pub struct OptimisticResolutionChallenged {
    pub market: Pubkey,
    pub proposal: Pubkey,
    pub challenger: Pubkey,
    pub outcome: u8,
    pub challenge_hash: [u8; 32],
    pub evidence_uri: String,
    pub bond_amount: u64,
}

#[event]
pub struct OptimisticResolutionFinalized {
    pub market: Pubkey,
    pub proposal: Pubkey,
    pub outcome: u8,
    pub winner: Pubkey,
    pub winner_payout: u64,
    pub treasury_fee: u64,
    pub decision_hash: [u8; 32],
    pub invalid_refund: bool,
}

#[event]
pub struct OptimisticBondClaimed {
    pub market: Pubkey,
    pub proposal: Pubkey,
    pub claimant: Pubkey,
    pub destination: Pubkey,
    pub amount: u64,
}

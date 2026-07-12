use anchor_lang::prelude::*;

use crate::constants::COMMITTEE_SIZE;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq, Eq)]
pub enum MarketMode {
    Live,
    Replay,
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
    pub collateral_mint: Pubkey,
    pub token_program: Pubkey,
    pub txline_program: Pubkey,
}

impl ProtocolConfig {
    pub const SPACE: usize = 8 + 256;
}

#[account]
pub struct Market {
    pub bump: u8,
    pub vault_bump: u8,
    pub market_id: u64,
    pub authority: Pubkey,
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
    pub net_pool: u64,
    pub payout_amount: u64,
    pub claimed_count: u32,
    pub refunded_count: u32,
    pub settled_at: i64,
    pub txline_proof_ts: i64,
    pub final_seq: u32,
    pub daily_scores_root: Pubkey,
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

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct InitializeProtocolArgs {
    pub treasury_owner: Pubkey,
    pub fee_bps: u16,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct InitializeMarketArgs {
    pub market_id: u64,
    pub fixture_id: i64,
    pub market_mode: MarketMode,
    pub fixture_start_ts: i64,
    pub lock_ts: i64,
    pub batch_deadline_ts: i64,
    pub resolution_deadline_ts: i64,
    pub committee: [Pubkey; COMMITTEE_SIZE],
    pub placement_verifier: Pubkey,
    pub redeem_verifier: Pubkey,
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

#[event]
pub struct ProtocolInitialized {
    pub protocol: Pubkey,
    pub authority: Pubkey,
    pub treasury_owner: Pubkey,
    pub collateral_mint: Pubkey,
    pub fee_bps: u16,
}

#[event]
pub struct MarketCreated {
    pub market: Pubkey,
    pub market_id: u64,
    pub fixture_id: i64,
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
    pub net_pool: u64,
    pub payout_amount: u64,
}

#[event]
pub struct ProtocolFeeCollected {
    pub market: Pubkey,
    pub treasury_owner: Pubkey,
    pub treasury_token: Pubkey,
    pub gross_pool: u64,
    pub fee_bps: u16,
    pub amount: u64,
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

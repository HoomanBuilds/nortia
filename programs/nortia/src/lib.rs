pub mod constants;
pub mod error;
pub mod state;
pub mod txline;
pub mod zk;

use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, TransferChecked};

pub use constants::*;
pub use state::*;
pub use txline::StatValidationInput;

use error::MorosError;

declare_id!("4S2EvdGrbKJ9zazvB4gtR83crTrVJWqqwoVVvEQy8VE9");

#[program]
pub mod nortia {
    use super::*;

    pub fn initialize_protocol(
        ctx: Context<InitializeProtocol>,
        args: InitializeProtocolArgs,
    ) -> Result<()> {
        require!(
            args.treasury_owner != Pubkey::default()
                && args.fee_bps > 0
                && args.fee_bps <= MAX_PROTOCOL_FEE_BPS
                && ctx.accounts.collateral_mint.decimals == USDC_DECIMALS,
            MorosError::InvalidProtocolConfiguration
        );

        let protocol = &mut ctx.accounts.protocol;
        protocol.bump = ctx.bumps.protocol;
        protocol.authority = ctx.accounts.authority.key();
        protocol.treasury_owner = args.treasury_owner;
        protocol.fee_bps = args.fee_bps;
        protocol.collateral_mint = ctx.accounts.collateral_mint.key();
        protocol.token_program = ctx.accounts.token_program.key();
        protocol.txline_program = TXLINE_PROGRAM_ID;

        emit!(ProtocolInitialized {
            protocol: protocol.key(),
            authority: protocol.authority,
            treasury_owner: protocol.treasury_owner,
            collateral_mint: protocol.collateral_mint,
            fee_bps: protocol.fee_bps,
        });
        Ok(())
    }

    pub fn initialize_market(
        ctx: Context<InitializeMarket>,
        args: InitializeMarketArgs,
    ) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let live_timing_valid =
            args.market_mode != MarketMode::Live || args.lock_ts <= args.fixture_start_ts;
        require!(
            valid_committee(&args.committee)
                && args.market_id > 0
                && args.fixture_id > 0
                && args.fixture_start_ts > 0
                && now < args.lock_ts
                && args.lock_ts < args.batch_deadline_ts
                && args.batch_deadline_ts < args.resolution_deadline_ts
                && live_timing_valid
                && args.placement_verifier != Pubkey::default()
                && args.redeem_verifier != Pubkey::default()
                && args.placement_verifier != args.redeem_verifier,
            MorosError::InvalidMarketConfiguration
        );

        let protocol = &ctx.accounts.protocol;
        let market = &mut ctx.accounts.market;
        market.bump = ctx.bumps.market;
        market.vault_bump = ctx.bumps.vault;
        market.market_id = args.market_id;
        market.authority = ctx.accounts.creator.key();
        market.fixture_id = args.fixture_id;
        market.market_mode = args.market_mode;
        market.fixture_start_ts = args.fixture_start_ts;
        market.score_key_a = PARTICIPANT_ONE_GOALS_KEY;
        market.score_key_b = PARTICIPANT_TWO_GOALS_KEY;
        market.total_goals_threshold = TOTAL_GOALS_THRESHOLD;
        market.collateral_mint = protocol.collateral_mint;
        market.token_program = protocol.token_program;
        market.ticket_amount = TICKET_AMOUNT;
        market.fee_bps = protocol.fee_bps;
        market.treasury_owner = protocol.treasury_owner;
        market.txline_program = protocol.txline_program;
        market.lock_ts = args.lock_ts;
        market.batch_deadline_ts = args.batch_deadline_ts;
        market.resolution_deadline_ts = args.resolution_deadline_ts;
        market.phase = MarketPhase::Open;
        market.order_count = 0;
        market.yes_count = 0;
        market.no_count = 0;
        market.commitment_root = [0; 32];
        market.outcome = Market::OUTCOME_UNSET;
        market.committee = args.committee;
        market.placement_verifier = args.placement_verifier;
        market.redeem_verifier = args.redeem_verifier;
        market.gross_pool = 0;
        market.protocol_fee = 0;
        market.net_pool = 0;
        market.payout_amount = 0;
        market.claimed_count = 0;
        market.refunded_count = 0;
        market.settled_at = 0;
        market.txline_proof_ts = 0;
        market.final_seq = 0;
        market.daily_scores_root = Pubkey::default();
        market.score_a = 0;
        market.score_b = 0;

        emit!(MarketCreated {
            market: market.key(),
            market_id: market.market_id,
            fixture_id: market.fixture_id,
            market_mode: market.market_mode,
            collateral_mint: market.collateral_mint,
            ticket_amount: market.ticket_amount,
            fee_bps: market.fee_bps,
            lock_ts: market.lock_ts,
        });
        Ok(())
    }

    pub fn place_order(ctx: Context<PlaceOrder>, args: PlaceOrderArgs) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let market = &ctx.accounts.market;
        require!(market.phase == MarketPhase::Open, MorosError::InvalidPhase);
        require!(now < market.lock_ts, MorosError::MarketLocked);
        require!(args.commitment != [0; 32], MorosError::ZeroCommitment);
        require!(
            args.share_commitments.iter().all(|value| *value != [0; 32]),
            MorosError::ZeroCommitment
        );
        zk::verify_place(
            market,
            &ctx.accounts.payer.key(),
            &args.commitment,
            &args.share_commitments,
            &args.proof,
            &args.public_witness,
            &ctx.accounts.placement_verifier,
        )?;

        let order_index = market.order_count;
        let next_order_count = order_index
            .checked_add(1)
            .ok_or_else(|| error!(MorosError::ArithmeticOverflow))?;

        let order = &mut ctx.accounts.order;
        order.bump = ctx.bumps.order;
        order.market = ctx.accounts.market.key();
        order.payer = ctx.accounts.payer.key();
        order.order_index = order_index;
        order.commitment = args.commitment;
        order.share_commitments = args.share_commitments;
        order.refunded = false;
        ctx.accounts.market.order_count = next_order_count;

        let transfer_accounts = TransferChecked {
            from: ctx.accounts.payer_token.to_account_info(),
            mint: ctx.accounts.collateral_mint.to_account_info(),
            to: ctx.accounts.vault.to_account_info(),
            authority: ctx.accounts.payer.to_account_info(),
        };
        token::transfer_checked(
            CpiContext::new(ctx.accounts.token_program.key(), transfer_accounts),
            ctx.accounts.market.ticket_amount,
            ctx.accounts.collateral_mint.decimals,
        )?;

        emit!(OrderPlaced {
            market: ctx.accounts.market.key(),
            order: order.key(),
            order_index,
            commitment: order.commitment,
            order_count: next_order_count,
        });
        Ok(())
    }

    pub fn submit_batch(ctx: Context<SubmitBatch>, args: SubmitBatchArgs) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let market = &mut ctx.accounts.market;
        require!(market.phase == MarketPhase::Open, MorosError::InvalidPhase);
        require!(now >= market.lock_ts, MorosError::TooEarly);
        require!(now <= market.batch_deadline_ts, MorosError::DeadlineElapsed);
        require!(args.commitment_root != [0; 32], MorosError::ZeroCommitment);
        require!(
            args.yes_count.checked_add(args.no_count) == Some(market.order_count),
            MorosError::BatchCountMismatch
        );
        verify_committee_quorum(&market.committee, ctx.remaining_accounts)?;

        market.commitment_root = args.commitment_root;
        market.yes_count = args.yes_count;
        market.no_count = args.no_count;
        market.phase = batch_phase(args.yes_count, args.no_count);
        let refunding = market.phase == MarketPhase::Refunding;

        emit!(BatchSubmitted {
            market: market.key(),
            commitment_root: market.commitment_root,
            yes_count: market.yes_count,
            no_count: market.no_count,
            refunding,
        });
        if refunding {
            emit!(RefundsOpened {
                market: market.key(),
            });
        }
        Ok(())
    }

    pub fn resolve_market(
        ctx: Context<ResolveMarket>,
        final_seq: u32,
        payload: StatValidationInput,
    ) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        require!(
            ctx.accounts.market.phase == MarketPhase::Batched,
            MorosError::InvalidPhase
        );
        require!(
            now <= ctx.accounts.market.resolution_deadline_ts,
            MorosError::DeadlineElapsed
        );
        require!(final_seq > 0, MorosError::InvalidScorePayload);

        let is_over = txline::resolve_total_goals_over(
            &ctx.accounts.market,
            &payload,
            &ctx.accounts.daily_scores_merkle_roots,
            &ctx.accounts.txline_program,
        )?;
        let outcome = u8::from(is_over);
        let winners = if is_over {
            ctx.accounts.market.yes_count
        } else {
            ctx.accounts.market.no_count
        };
        let settlement = calculate_settlement(
            ctx.accounts.market.ticket_amount,
            ctx.accounts.market.order_count,
            winners,
            ctx.accounts.market.fee_bps,
        )?;
        require!(
            ctx.accounts.vault.amount >= settlement.gross_pool,
            MorosError::InsufficientVaultBalance
        );

        let score_a = payload.stats[0].stat.value;
        let score_b = payload.stats[1].stat.value;
        {
            let market = &mut ctx.accounts.market;
            market.outcome = outcome;
            market.gross_pool = settlement.gross_pool;
            market.protocol_fee = settlement.protocol_fee;
            market.net_pool = settlement.net_pool;
            market.payout_amount = settlement.payout_amount;
            market.phase = MarketPhase::Resolved;
            market.settled_at = now;
            market.txline_proof_ts = payload.ts;
            market.final_seq = final_seq;
            market.daily_scores_root = ctx.accounts.daily_scores_merkle_roots.key();
            market.score_a = score_a;
            market.score_b = score_b;
        }

        transfer_from_vault(
            &ctx.accounts.market,
            &ctx.accounts.vault,
            &ctx.accounts.treasury_token,
            &ctx.accounts.collateral_mint,
            &ctx.accounts.token_program,
            settlement.protocol_fee,
        )?;

        emit!(ProtocolFeeCollected {
            market: ctx.accounts.market.key(),
            treasury_owner: ctx.accounts.market.treasury_owner,
            treasury_token: ctx.accounts.treasury_token.key(),
            gross_pool: settlement.gross_pool,
            fee_bps: ctx.accounts.market.fee_bps,
            amount: settlement.protocol_fee,
        });
        emit!(MarketResolved {
            market: ctx.accounts.market.key(),
            outcome,
            score_a,
            score_b,
            gross_pool: settlement.gross_pool,
            protocol_fee: settlement.protocol_fee,
            net_pool: settlement.net_pool,
            payout_amount: settlement.payout_amount,
        });
        Ok(())
    }

    pub fn begin_refund(ctx: Context<BeginRefund>) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let market = &mut ctx.accounts.market;
        let timed_out = match market.phase {
            MarketPhase::Open => now > market.batch_deadline_ts,
            MarketPhase::Batched => now > market.resolution_deadline_ts,
            _ => false,
        };
        require!(timed_out, MorosError::TooEarly);
        market.phase = MarketPhase::Refunding;
        emit!(RefundsOpened {
            market: market.key(),
        });
        Ok(())
    }

    pub fn refund_order(ctx: Context<RefundOrder>) -> Result<()> {
        require!(
            ctx.accounts.market.phase == MarketPhase::Refunding,
            MorosError::InvalidPhase
        );
        require!(!ctx.accounts.order.refunded, MorosError::AlreadyRefunded);

        ctx.accounts.order.refunded = true;
        ctx.accounts.market.refunded_count = ctx
            .accounts
            .market
            .refunded_count
            .checked_add(1)
            .ok_or_else(|| error!(MorosError::ArithmeticOverflow))?;
        if ctx.accounts.market.refunded_count == ctx.accounts.market.order_count {
            ctx.accounts.market.phase = MarketPhase::Closed;
        }
        let amount = ctx.accounts.market.ticket_amount;
        transfer_from_vault(
            &ctx.accounts.market,
            &ctx.accounts.vault,
            &ctx.accounts.payer_token,
            &ctx.accounts.collateral_mint,
            &ctx.accounts.token_program,
            amount,
        )?;

        emit!(OrderRefunded {
            market: ctx.accounts.market.key(),
            order: ctx.accounts.order.key(),
            payer: ctx.accounts.payer.key(),
            amount,
        });
        Ok(())
    }

    pub fn redeem(ctx: Context<Redeem>, args: RedeemArgs) -> Result<()> {
        require!(
            ctx.accounts.market.phase == MarketPhase::Resolved,
            MorosError::InvalidPhase
        );
        require!(ctx.accounts.market.payout_amount > 0, MorosError::NoWinners);
        require!(
            ctx.accounts.market.claimed_count < ctx.accounts.market.winner_count(),
            MorosError::NoWinners
        );
        zk::verify_redeem(
            &ctx.accounts.market,
            &ctx.accounts.recipient_owner.key(),
            &args.nullifier_hash,
            &args.proof,
            &args.public_witness,
            &ctx.accounts.redeem_verifier,
        )?;

        let amount = ctx.accounts.market.payout_amount;
        let claim = &mut ctx.accounts.claim;
        claim.bump = ctx.bumps.claim;
        claim.market = ctx.accounts.market.key();
        claim.nullifier_hash = args.nullifier_hash;
        claim.recipient_owner = ctx.accounts.recipient_owner.key();
        claim.recipient_token = ctx.accounts.recipient_token.key();
        claim.amount = amount;

        ctx.accounts.market.claimed_count = ctx
            .accounts
            .market
            .claimed_count
            .checked_add(1)
            .ok_or_else(|| error!(MorosError::ArithmeticOverflow))?;
        if ctx.accounts.market.claimed_count == ctx.accounts.market.winner_count() {
            ctx.accounts.market.phase = MarketPhase::Closed;
        }
        transfer_from_vault(
            &ctx.accounts.market,
            &ctx.accounts.vault,
            &ctx.accounts.recipient_token,
            &ctx.accounts.collateral_mint,
            &ctx.accounts.token_program,
            amount,
        )?;

        emit!(WinningsRedeemed {
            market: ctx.accounts.market.key(),
            nullifier_hash: args.nullifier_hash,
            recipient_owner: ctx.accounts.recipient_owner.key(),
            recipient_token: ctx.accounts.recipient_token.key(),
            amount,
        });
        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeProtocol<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        init,
        payer = authority,
        space = ProtocolConfig::SPACE,
        seeds = [PROTOCOL_SEED],
        bump
    )]
    pub protocol: Account<'info, ProtocolConfig>,
    #[account(
        constraint = collateral_mint.decimals == USDC_DECIMALS
            @ MorosError::InvalidCollateralMint
    )]
    pub collateral_mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(args: InitializeMarketArgs)]
pub struct InitializeMarket<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,
    #[account(
        seeds = [PROTOCOL_SEED],
        bump = protocol.bump,
        constraint = protocol.collateral_mint == collateral_mint.key()
            @ MorosError::InvalidCollateralMint,
        constraint = protocol.token_program == token_program.key()
            @ MorosError::InvalidTokenAccount,
        constraint = protocol.txline_program == TXLINE_PROGRAM_ID
            @ MorosError::InvalidTxlineProgram
    )]
    pub protocol: Account<'info, ProtocolConfig>,
    #[account(
        constraint = collateral_mint.decimals == USDC_DECIMALS
            @ MorosError::InvalidCollateralMint
    )]
    pub collateral_mint: Account<'info, Mint>,
    #[account(
        init,
        payer = creator,
        space = Market::SPACE,
        seeds = [MARKET_SEED, &args.market_id.to_le_bytes()],
        bump
    )]
    pub market: Box<Account<'info, Market>>,
    #[account(
        init,
        payer = creator,
        seeds = [VAULT_SEED, market.key().as_ref()],
        bump,
        token::mint = collateral_mint,
        token::authority = market
    )]
    pub vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(args: PlaceOrderArgs)]
pub struct PlaceOrder<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        mut,
        seeds = [MARKET_SEED, &market.market_id.to_le_bytes()],
        bump = market.bump,
        constraint = market.collateral_mint == collateral_mint.key()
            @ MorosError::InvalidCollateralMint,
        constraint = market.token_program == token_program.key()
            @ MorosError::InvalidTokenAccount
    )]
    pub market: Box<Account<'info, Market>>,
    pub collateral_mint: Account<'info, Mint>,
    #[account(
        mut,
        constraint = payer_token.owner == payer.key()
            @ MorosError::InvalidTokenAccount,
        constraint = payer_token.mint == market.collateral_mint
            @ MorosError::InvalidTokenAccount
    )]
    pub payer_token: Account<'info, TokenAccount>,
    #[account(
        init,
        payer = payer,
        space = Order::SPACE,
        seeds = [ORDER_SEED, market.key().as_ref(), args.commitment.as_ref()],
        bump
    )]
    pub order: Account<'info, Order>,
    #[account(
        mut,
        seeds = [VAULT_SEED, market.key().as_ref()],
        bump = market.vault_bump,
        token::mint = collateral_mint,
        token::authority = market
    )]
    pub vault: Account<'info, TokenAccount>,
    /// CHECK: The address and executable flag are checked against immutable market state.
    pub placement_verifier: UncheckedAccount<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SubmitBatch<'info> {
    #[account(
        mut,
        seeds = [MARKET_SEED, &market.market_id.to_le_bytes()],
        bump = market.bump
    )]
    pub market: Box<Account<'info, Market>>,
}

#[derive(Accounts)]
pub struct ResolveMarket<'info> {
    #[account(
        mut,
        seeds = [MARKET_SEED, &market.market_id.to_le_bytes()],
        bump = market.bump,
        constraint = market.collateral_mint == collateral_mint.key()
            @ MorosError::InvalidCollateralMint,
        constraint = market.token_program == token_program.key()
            @ MorosError::InvalidTokenAccount,
        constraint = market.treasury_owner == treasury_token.owner
            @ MorosError::InvalidTreasury
    )]
    pub market: Account<'info, Market>,
    pub collateral_mint: Account<'info, Mint>,
    #[account(
        mut,
        seeds = [VAULT_SEED, market.key().as_ref()],
        bump = market.vault_bump,
        token::mint = collateral_mint,
        token::authority = market
    )]
    pub vault: Account<'info, TokenAccount>,
    #[account(
        mut,
        constraint = treasury_token.mint == market.collateral_mint
            @ MorosError::InvalidTreasury
    )]
    pub treasury_token: Account<'info, TokenAccount>,
    /// CHECK: Ownership, PDA derivation, and payload timestamp are checked against TxLINE.
    pub daily_scores_merkle_roots: UncheckedAccount<'info>,
    /// CHECK: The address and executable flag are checked against the pinned TxLINE ID.
    pub txline_program: UncheckedAccount<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct BeginRefund<'info> {
    #[account(
        mut,
        seeds = [MARKET_SEED, &market.market_id.to_le_bytes()],
        bump = market.bump
    )]
    pub market: Account<'info, Market>,
}

#[derive(Accounts)]
pub struct RefundOrder<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        mut,
        seeds = [MARKET_SEED, &market.market_id.to_le_bytes()],
        bump = market.bump,
        constraint = market.collateral_mint == collateral_mint.key()
            @ MorosError::InvalidCollateralMint,
        constraint = market.token_program == token_program.key()
            @ MorosError::InvalidTokenAccount
    )]
    pub market: Box<Account<'info, Market>>,
    pub collateral_mint: Account<'info, Mint>,
    #[account(
        mut,
        constraint = order.market == market.key() @ MorosError::InvalidOrder,
        constraint = order.payer == payer.key() @ MorosError::InvalidOrder
    )]
    pub order: Account<'info, Order>,
    #[account(
        mut,
        seeds = [VAULT_SEED, market.key().as_ref()],
        bump = market.vault_bump,
        token::mint = collateral_mint,
        token::authority = market
    )]
    pub vault: Account<'info, TokenAccount>,
    #[account(
        mut,
        constraint = payer_token.owner == payer.key()
            @ MorosError::InvalidTokenAccount,
        constraint = payer_token.mint == market.collateral_mint
            @ MorosError::InvalidTokenAccount
    )]
    pub payer_token: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
#[instruction(args: RedeemArgs)]
pub struct Redeem<'info> {
    #[account(mut)]
    pub relayer: Signer<'info>,
    #[account(
        mut,
        seeds = [MARKET_SEED, &market.market_id.to_le_bytes()],
        bump = market.bump,
        constraint = market.collateral_mint == collateral_mint.key()
            @ MorosError::InvalidCollateralMint,
        constraint = market.token_program == token_program.key()
            @ MorosError::InvalidTokenAccount
    )]
    pub market: Box<Account<'info, Market>>,
    pub collateral_mint: Account<'info, Mint>,
    #[account(
        init,
        payer = relayer,
        space = Claim::SPACE,
        seeds = [CLAIM_SEED, market.key().as_ref(), args.nullifier_hash.as_ref()],
        bump
    )]
    pub claim: Account<'info, Claim>,
    #[account(
        mut,
        seeds = [VAULT_SEED, market.key().as_ref()],
        bump = market.vault_bump,
        token::mint = collateral_mint,
        token::authority = market
    )]
    pub vault: Account<'info, TokenAccount>,
    /// CHECK: The redeem proof binds this owner, and the token account verifies ownership.
    pub recipient_owner: UncheckedAccount<'info>,
    #[account(
        mut,
        constraint = recipient_token.owner == recipient_owner.key()
            @ MorosError::InvalidTokenAccount,
        constraint = recipient_token.mint == market.collateral_mint
            @ MorosError::InvalidTokenAccount
    )]
    pub recipient_token: Account<'info, TokenAccount>,
    /// CHECK: The address and executable flag are checked against immutable market state.
    pub redeem_verifier: UncheckedAccount<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

fn valid_committee(committee: &[Pubkey; COMMITTEE_SIZE]) -> bool {
    committee.iter().all(|key| *key != Pubkey::default())
        && committee[0] != committee[1]
        && committee[0] != committee[2]
        && committee[1] != committee[2]
}

fn verify_committee_quorum(
    committee: &[Pubkey; COMMITTEE_SIZE],
    accounts: &[AccountInfo],
) -> Result<()> {
    let signers: Vec<&AccountInfo> = accounts
        .iter()
        .filter(|account| account.is_signer)
        .collect();
    for left in 0..signers.len() {
        for right in left + 1..signers.len() {
            require_keys_neq!(
                *signers[left].key,
                *signers[right].key,
                MorosError::DuplicateCommitteeSigner
            );
        }
    }
    let quorum = committee
        .iter()
        .filter(|configured| signers.iter().any(|account| account.key == *configured))
        .count();
    require!(
        quorum >= COMMITTEE_THRESHOLD,
        MorosError::CommitteeQuorumNotMet
    );
    Ok(())
}

fn batch_phase(yes_count: u32, no_count: u32) -> MarketPhase {
    if yes_count == 0 || no_count == 0 {
        MarketPhase::Refunding
    } else {
        MarketPhase::Batched
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
struct SettlementAmounts {
    gross_pool: u64,
    protocol_fee: u64,
    net_pool: u64,
    payout_amount: u64,
}

fn calculate_settlement(
    ticket_amount: u64,
    order_count: u32,
    winners: u32,
    fee_bps: u16,
) -> Result<SettlementAmounts> {
    require!(winners > 0, MorosError::NoWinners);
    require!(
        fee_bps > 0 && fee_bps <= MAX_PROTOCOL_FEE_BPS,
        MorosError::InvalidProtocolFee
    );
    let gross_pool = (ticket_amount as u128)
        .checked_mul(order_count as u128)
        .ok_or_else(|| error!(MorosError::ArithmeticOverflow))?;
    let protocol_fee = gross_pool
        .checked_mul(fee_bps as u128)
        .and_then(|value| value.checked_div(BASIS_POINTS_DENOMINATOR))
        .ok_or_else(|| error!(MorosError::ArithmeticOverflow))?;
    let net_pool = gross_pool
        .checked_sub(protocol_fee)
        .ok_or_else(|| error!(MorosError::ArithmeticOverflow))?;
    let payout_amount = net_pool
        .checked_div(winners as u128)
        .ok_or_else(|| error!(MorosError::ArithmeticOverflow))?;

    Ok(SettlementAmounts {
        gross_pool: u64::try_from(gross_pool)
            .map_err(|_| error!(MorosError::ArithmeticOverflow))?,
        protocol_fee: u64::try_from(protocol_fee)
            .map_err(|_| error!(MorosError::ArithmeticOverflow))?,
        net_pool: u64::try_from(net_pool).map_err(|_| error!(MorosError::ArithmeticOverflow))?,
        payout_amount: u64::try_from(payout_amount)
            .map_err(|_| error!(MorosError::ArithmeticOverflow))?,
    })
}

fn transfer_from_vault<'info>(
    market: &Account<'info, Market>,
    vault: &Account<'info, TokenAccount>,
    destination: &Account<'info, TokenAccount>,
    collateral_mint: &Account<'info, Mint>,
    token_program: &Program<'info, Token>,
    amount: u64,
) -> Result<()> {
    require!(vault.amount >= amount, MorosError::InsufficientVaultBalance);
    let market_id_bytes = market.market_id.to_le_bytes();
    let bump = [market.bump];
    let signer_seeds: &[&[u8]] = &[MARKET_SEED, &market_id_bytes, &bump];
    let signer = &[signer_seeds];
    let transfer_accounts = TransferChecked {
        from: vault.to_account_info(),
        mint: collateral_mint.to_account_info(),
        to: destination.to_account_info(),
        authority: market.to_account_info(),
    };
    token::transfer_checked(
        CpiContext::new_with_signer(token_program.key(), transfer_accounts, signer),
        amount,
        collateral_mint.decimals,
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn committee_requires_three_distinct_nonzero_keys() {
        let one = Pubkey::new_unique();
        let two = Pubkey::new_unique();
        let three = Pubkey::new_unique();
        assert!(valid_committee(&[one, two, three]));
        assert!(!valid_committee(&[one, one, three]));
        assert!(!valid_committee(&[one, two, Pubkey::default()]));
    }

    #[test]
    fn one_sided_batch_refunds_before_resolution() {
        assert_eq!(batch_phase(3, 0), MarketPhase::Refunding);
        assert_eq!(batch_phase(0, 3), MarketPhase::Refunding);
        assert_eq!(batch_phase(2, 1), MarketPhase::Batched);
    }

    #[test]
    fn settlement_collects_one_percent_from_gross_pool() {
        let settlement = calculate_settlement(TICKET_AMOUNT, 3, 2, 100).unwrap();
        assert_eq!(
            settlement,
            SettlementAmounts {
                gross_pool: 3_000_000,
                protocol_fee: 30_000,
                net_pool: 2_970_000,
                payout_amount: 1_485_000,
            }
        );
    }

    #[test]
    fn settlement_rejects_invalid_fee_and_zero_winners() {
        assert!(calculate_settlement(TICKET_AMOUNT, 3, 2, 0).is_err());
        assert!(calculate_settlement(TICKET_AMOUNT, 3, 2, 301).is_err());
        assert!(calculate_settlement(TICKET_AMOUNT, 3, 0, 100).is_err());
    }

    #[test]
    fn settlement_rejects_values_that_do_not_fit_u64() {
        assert!(calculate_settlement(u64::MAX, 2, 1, 100).is_err());
    }
}

pub mod constants;
pub mod error;
pub mod lmsr;
pub mod state;
pub mod txline;
pub mod zk;

use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, TransferChecked};
use solana_sha256_hasher::hashv;

pub use constants::*;
pub use state::*;
pub use txline::StatValidationInput;

use error::NortiaError;

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
                && args.keeper_reward_bps <= MAX_KEEPER_REWARD_BPS
                && valid_committee(&args.committee)
                && args.placement_verifier != Pubkey::default()
                && args.redeem_verifier != Pubkey::default()
                && args.placement_verifier != args.redeem_verifier
                && ctx.accounts.collateral_mint.decimals == USDC_DECIMALS,
            NortiaError::InvalidProtocolConfiguration
        );

        let protocol = &mut ctx.accounts.protocol;
        protocol.bump = ctx.bumps.protocol;
        protocol.authority = ctx.accounts.authority.key();
        protocol.treasury_owner = args.treasury_owner;
        protocol.fee_bps = args.fee_bps;
        protocol.keeper_reward_bps = args.keeper_reward_bps;
        protocol.collateral_mint = ctx.accounts.collateral_mint.key();
        protocol.token_program = ctx.accounts.token_program.key();
        protocol.txline_program = TXLINE_PROGRAM_ID;
        protocol.committee = args.committee;
        protocol.placement_verifier = args.placement_verifier;
        protocol.redeem_verifier = args.redeem_verifier;

        emit!(ProtocolInitialized {
            protocol: protocol.key(),
            authority: protocol.authority,
            treasury_owner: protocol.treasury_owner,
            collateral_mint: protocol.collateral_mint,
            fee_bps: protocol.fee_bps,
            keeper_reward_bps: protocol.keeper_reward_bps,
            committee: protocol.committee,
            placement_verifier: protocol.placement_verifier,
            redeem_verifier: protocol.redeem_verifier,
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
            args.market_id > 0
                && args.question_hash != [0; 32]
                && args.rules_hash != [0; 32]
                && args.category == MarketCategory::Sports
                && args.resolver_kind == ResolverKind::TxlineStatV2
                && args.fixture_id > 0
                && (0..=MAX_TOTAL_GOALS_THRESHOLD).contains(&args.total_goals_threshold)
                && args.fixture_start_ts > 0
                && now < args.lock_ts
                && args.lock_ts < args.batch_deadline_ts
                && args.batch_deadline_ts < args.resolution_deadline_ts
                && args.fixture_start_ts < args.resolution_deadline_ts
                && live_timing_valid,
            NortiaError::InvalidMarketConfiguration
        );

        let protocol = &ctx.accounts.protocol;
        let market = &mut ctx.accounts.market;
        market.bump = ctx.bumps.market;
        market.vault_bump = ctx.bumps.vault;
        market.market_id = args.market_id;
        market.authority = ctx.accounts.creator.key();
        market.category = args.category;
        market.resolver_kind = args.resolver_kind;
        market.question_hash = args.question_hash;
        market.rules_hash = args.rules_hash;
        market.fixture_id = args.fixture_id;
        market.market_mode = args.market_mode;
        market.fixture_start_ts = args.fixture_start_ts;
        market.score_key_a = PARTICIPANT_ONE_GOALS_KEY;
        market.score_key_b = PARTICIPANT_TWO_GOALS_KEY;
        market.total_goals_threshold = args.total_goals_threshold;
        market.collateral_mint = protocol.collateral_mint;
        market.token_program = protocol.token_program;
        market.ticket_amount = TICKET_AMOUNT;
        market.fee_bps = protocol.fee_bps;
        market.keeper_reward_bps = protocol.keeper_reward_bps;
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
        market.committee = protocol.committee;
        market.placement_verifier = protocol.placement_verifier;
        market.redeem_verifier = protocol.redeem_verifier;
        market.gross_pool = 0;
        market.protocol_fee = 0;
        market.keeper_reward = 0;
        market.treasury_fee = 0;
        market.net_pool = 0;
        market.payout_amount = 0;
        market.payout_remainder = 0;
        market.claimed_count = 0;
        market.refunded_count = 0;
        market.settled_at = 0;
        market.txline_proof_ts = 0;
        market.final_seq = 0;
        market.daily_scores_root = Pubkey::default();
        market.settlement_evidence_hash = [0; 32];
        market.score_a = 0;
        market.score_b = 0;

        emit!(MarketCreated {
            market: market.key(),
            market_id: market.market_id,
            authority: market.authority,
            category: market.category,
            resolver_kind: market.resolver_kind,
            question_hash: market.question_hash,
            rules_hash: market.rules_hash,
            fixture_id: market.fixture_id,
            total_goals_threshold: market.total_goals_threshold,
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
        require!(market.phase == MarketPhase::Open, NortiaError::InvalidPhase);
        require!(now < market.lock_ts, NortiaError::MarketLocked);
        require!(args.commitment != [0; 32], NortiaError::ZeroCommitment);
        require!(
            args.share_commitments.iter().all(|value| *value != [0; 32]),
            NortiaError::ZeroCommitment
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
            .ok_or_else(|| error!(NortiaError::ArithmeticOverflow))?;

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
        require!(market.phase == MarketPhase::Open, NortiaError::InvalidPhase);
        require!(now >= market.lock_ts, NortiaError::TooEarly);
        require!(
            now <= market.batch_deadline_ts,
            NortiaError::DeadlineElapsed
        );
        require!(args.commitment_root != [0; 32], NortiaError::ZeroCommitment);
        require!(market.order_count > 0, NortiaError::NoOrders);
        require!(
            args.yes_count.checked_add(args.no_count) == Some(market.order_count),
            NortiaError::BatchCountMismatch
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
            NortiaError::InvalidPhase
        );
        require!(
            now <= ctx.accounts.market.resolution_deadline_ts,
            NortiaError::DeadlineElapsed
        );
        require!(final_seq > 0, NortiaError::InvalidScorePayload);

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
            ctx.accounts.market.keeper_reward_bps,
        )?;
        require!(
            ctx.accounts.vault.amount >= settlement.gross_pool,
            NortiaError::InsufficientVaultBalance
        );

        let score_a = payload.stats[0].stat.value;
        let score_b = payload.stats[1].stat.value;
        let mut evidence_bytes = Vec::new();
        payload
            .serialize(&mut evidence_bytes)
            .map_err(|_| error!(NortiaError::InvalidScorePayload))?;
        let final_seq_bytes = final_seq.to_le_bytes();
        let settlement_evidence_hash = hashv(&[
            evidence_bytes.as_slice(),
            ctx.accounts.daily_scores_merkle_roots.key.as_ref(),
            &final_seq_bytes,
        ])
        .to_bytes();
        {
            let market = &mut ctx.accounts.market;
            market.outcome = outcome;
            market.gross_pool = settlement.gross_pool;
            market.protocol_fee = settlement.protocol_fee;
            market.keeper_reward = settlement.keeper_reward;
            market.treasury_fee = settlement.treasury_fee;
            market.net_pool = settlement.net_pool;
            market.payout_amount = settlement.payout_amount;
            market.payout_remainder = settlement.payout_remainder;
            market.phase = MarketPhase::Resolved;
            market.settled_at = now;
            market.txline_proof_ts = payload.ts;
            market.final_seq = final_seq;
            market.daily_scores_root = ctx.accounts.daily_scores_merkle_roots.key();
            market.settlement_evidence_hash = settlement_evidence_hash;
            market.score_a = score_a;
            market.score_b = score_b;
        }

        transfer_from_vault(
            &ctx.accounts.market,
            &ctx.accounts.vault,
            &ctx.accounts.treasury_token,
            &ctx.accounts.collateral_mint,
            &ctx.accounts.token_program,
            settlement.treasury_fee,
        )?;
        transfer_from_vault(
            &ctx.accounts.market,
            &ctx.accounts.vault,
            &ctx.accounts.keeper_token,
            &ctx.accounts.collateral_mint,
            &ctx.accounts.token_program,
            settlement.keeper_reward,
        )?;

        emit!(ProtocolFeeCollected {
            market: ctx.accounts.market.key(),
            treasury_owner: ctx.accounts.market.treasury_owner,
            treasury_token: ctx.accounts.treasury_token.key(),
            gross_pool: settlement.gross_pool,
            fee_bps: ctx.accounts.market.fee_bps,
            treasury_amount: settlement.treasury_fee,
            keeper: ctx.accounts.keeper.key(),
            keeper_amount: settlement.keeper_reward,
        });
        emit!(MarketResolved {
            market: ctx.accounts.market.key(),
            outcome,
            score_a,
            score_b,
            gross_pool: settlement.gross_pool,
            protocol_fee: settlement.protocol_fee,
            keeper_reward: settlement.keeper_reward,
            treasury_fee: settlement.treasury_fee,
            net_pool: settlement.net_pool,
            payout_amount: settlement.payout_amount,
            payout_remainder: settlement.payout_remainder,
            settlement_evidence_hash,
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
        require!(timed_out, NortiaError::TooEarly);
        market.phase = if market.order_count == 0 {
            MarketPhase::Closed
        } else {
            MarketPhase::Refunding
        };
        if market.phase == MarketPhase::Closed {
            emit!(MarketClosed {
                market: market.key()
            });
        } else {
            emit!(RefundsOpened {
                market: market.key()
            });
        }
        Ok(())
    }

    pub fn refund_order(ctx: Context<RefundOrder>) -> Result<()> {
        require!(
            ctx.accounts.market.phase == MarketPhase::Refunding,
            NortiaError::InvalidPhase
        );
        require!(!ctx.accounts.order.refunded, NortiaError::AlreadyRefunded);

        ctx.accounts.order.refunded = true;
        ctx.accounts.market.refunded_count = ctx
            .accounts
            .market
            .refunded_count
            .checked_add(1)
            .ok_or_else(|| error!(NortiaError::ArithmeticOverflow))?;
        if ctx.accounts.market.refunded_count == ctx.accounts.market.order_count {
            ctx.accounts.market.phase = MarketPhase::Closed;
            emit!(MarketClosed {
                market: ctx.accounts.market.key(),
            });
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
            NortiaError::InvalidPhase
        );
        require!(
            ctx.accounts.market.payout_amount > 0,
            NortiaError::NoWinners
        );
        require!(
            ctx.accounts.market.claimed_count < ctx.accounts.market.winner_count(),
            NortiaError::NoWinners
        );
        zk::verify_redeem(
            &ctx.accounts.market,
            &ctx.accounts.recipient_owner.key(),
            &args.nullifier_hash,
            &args.proof,
            &args.public_witness,
            &ctx.accounts.redeem_verifier,
        )?;

        let is_final_claim =
            ctx.accounts.market.claimed_count + 1 == ctx.accounts.market.winner_count();
        let amount = if is_final_claim {
            ctx.accounts
                .market
                .payout_amount
                .checked_add(ctx.accounts.market.payout_remainder)
                .ok_or_else(|| error!(NortiaError::ArithmeticOverflow))?
        } else {
            ctx.accounts.market.payout_amount
        };
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
            .ok_or_else(|| error!(NortiaError::ArithmeticOverflow))?;
        if ctx.accounts.market.claimed_count == ctx.accounts.market.winner_count() {
            ctx.accounts.market.phase = MarketPhase::Closed;
            emit!(MarketClosed {
                market: ctx.accounts.market.key(),
            });
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
    #[account(
        mut,
        address = PROTOCOL_AUTHORITY @ NortiaError::InvalidProtocolConfiguration
    )]
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
        address = DEVNET_USDC_MINT @ NortiaError::InvalidCollateralMint,
        constraint = collateral_mint.decimals == USDC_DECIMALS
            @ NortiaError::InvalidCollateralMint
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
            @ NortiaError::InvalidCollateralMint,
        constraint = protocol.token_program == token_program.key()
            @ NortiaError::InvalidTokenAccount,
        constraint = protocol.txline_program == TXLINE_PROGRAM_ID
            @ NortiaError::InvalidTxlineProgram
    )]
    pub protocol: Account<'info, ProtocolConfig>,
    #[account(
        constraint = collateral_mint.decimals == USDC_DECIMALS
            @ NortiaError::InvalidCollateralMint
    )]
    pub collateral_mint: Account<'info, Mint>,
    #[account(
        init,
        payer = creator,
        space = Market::SPACE,
        seeds = [MARKET_SEED, creator.key().as_ref(), &args.market_id.to_le_bytes()],
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
        seeds = [MARKET_SEED, market.authority.as_ref(), &market.market_id.to_le_bytes()],
        bump = market.bump,
        constraint = market.collateral_mint == collateral_mint.key()
            @ NortiaError::InvalidCollateralMint,
        constraint = market.token_program == token_program.key()
            @ NortiaError::InvalidTokenAccount
    )]
    pub market: Box<Account<'info, Market>>,
    pub collateral_mint: Account<'info, Mint>,
    #[account(
        mut,
        constraint = payer_token.owner == payer.key()
            @ NortiaError::InvalidTokenAccount,
        constraint = payer_token.mint == market.collateral_mint
            @ NortiaError::InvalidTokenAccount
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
        seeds = [MARKET_SEED, market.authority.as_ref(), &market.market_id.to_le_bytes()],
        bump = market.bump
    )]
    pub market: Box<Account<'info, Market>>,
}

#[derive(Accounts)]
pub struct ResolveMarket<'info> {
    #[account(mut)]
    pub keeper: Signer<'info>,
    #[account(
        mut,
        seeds = [MARKET_SEED, market.authority.as_ref(), &market.market_id.to_le_bytes()],
        bump = market.bump,
        constraint = market.collateral_mint == collateral_mint.key()
            @ NortiaError::InvalidCollateralMint,
        constraint = market.token_program == token_program.key()
            @ NortiaError::InvalidTokenAccount,
        constraint = market.treasury_owner == treasury_token.owner
            @ NortiaError::InvalidTreasury
    )]
    pub market: Box<Account<'info, Market>>,
    pub collateral_mint: Box<Account<'info, Mint>>,
    #[account(
        mut,
        seeds = [VAULT_SEED, market.key().as_ref()],
        bump = market.vault_bump,
        token::mint = collateral_mint,
        token::authority = market
    )]
    pub vault: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        constraint = treasury_token.mint == market.collateral_mint
            @ NortiaError::InvalidTreasury
    )]
    pub treasury_token: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        constraint = keeper_token.owner == keeper.key()
            @ NortiaError::InvalidTokenAccount,
        constraint = keeper_token.mint == market.collateral_mint
            @ NortiaError::InvalidTokenAccount
    )]
    pub keeper_token: Box<Account<'info, TokenAccount>>,
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
        seeds = [MARKET_SEED, market.authority.as_ref(), &market.market_id.to_le_bytes()],
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
        seeds = [MARKET_SEED, market.authority.as_ref(), &market.market_id.to_le_bytes()],
        bump = market.bump,
        constraint = market.collateral_mint == collateral_mint.key()
            @ NortiaError::InvalidCollateralMint,
        constraint = market.token_program == token_program.key()
            @ NortiaError::InvalidTokenAccount
    )]
    pub market: Box<Account<'info, Market>>,
    pub collateral_mint: Account<'info, Mint>,
    #[account(
        mut,
        constraint = order.market == market.key() @ NortiaError::InvalidOrder,
        constraint = order.payer == payer.key() @ NortiaError::InvalidOrder
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
            @ NortiaError::InvalidTokenAccount,
        constraint = payer_token.mint == market.collateral_mint
            @ NortiaError::InvalidTokenAccount
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
        seeds = [MARKET_SEED, market.authority.as_ref(), &market.market_id.to_le_bytes()],
        bump = market.bump,
        constraint = market.collateral_mint == collateral_mint.key()
            @ NortiaError::InvalidCollateralMint,
        constraint = market.token_program == token_program.key()
            @ NortiaError::InvalidTokenAccount
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
            @ NortiaError::InvalidTokenAccount,
        constraint = recipient_token.mint == market.collateral_mint
            @ NortiaError::InvalidTokenAccount
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
                NortiaError::DuplicateCommitteeSigner
            );
        }
    }
    let quorum = committee
        .iter()
        .filter(|configured| signers.iter().any(|account| account.key == *configured))
        .count();
    require!(
        quorum >= COMMITTEE_THRESHOLD,
        NortiaError::CommitteeQuorumNotMet
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
    keeper_reward: u64,
    treasury_fee: u64,
    net_pool: u64,
    payout_amount: u64,
    payout_remainder: u64,
}

fn calculate_settlement(
    ticket_amount: u64,
    order_count: u32,
    winners: u32,
    fee_bps: u16,
    keeper_reward_bps: u16,
) -> Result<SettlementAmounts> {
    require!(winners > 0, NortiaError::NoWinners);
    require!(
        fee_bps > 0 && fee_bps <= MAX_PROTOCOL_FEE_BPS,
        NortiaError::InvalidProtocolFee
    );
    require!(
        keeper_reward_bps <= MAX_KEEPER_REWARD_BPS,
        NortiaError::InvalidProtocolFee
    );
    let gross_pool = (ticket_amount as u128)
        .checked_mul(order_count as u128)
        .ok_or_else(|| error!(NortiaError::ArithmeticOverflow))?;
    let protocol_fee = gross_pool
        .checked_mul(fee_bps as u128)
        .and_then(|value| value.checked_div(BASIS_POINTS_DENOMINATOR))
        .ok_or_else(|| error!(NortiaError::ArithmeticOverflow))?;
    let net_pool = gross_pool
        .checked_sub(protocol_fee)
        .ok_or_else(|| error!(NortiaError::ArithmeticOverflow))?;
    let keeper_reward = protocol_fee
        .checked_mul(keeper_reward_bps as u128)
        .and_then(|value| value.checked_div(BASIS_POINTS_DENOMINATOR))
        .ok_or_else(|| error!(NortiaError::ArithmeticOverflow))?;
    let treasury_fee = protocol_fee
        .checked_sub(keeper_reward)
        .ok_or_else(|| error!(NortiaError::ArithmeticOverflow))?;
    let payout_amount = net_pool
        .checked_div(winners as u128)
        .ok_or_else(|| error!(NortiaError::ArithmeticOverflow))?;
    let payout_remainder = net_pool
        .checked_rem(winners as u128)
        .ok_or_else(|| error!(NortiaError::ArithmeticOverflow))?;

    Ok(SettlementAmounts {
        gross_pool: u64::try_from(gross_pool)
            .map_err(|_| error!(NortiaError::ArithmeticOverflow))?,
        protocol_fee: u64::try_from(protocol_fee)
            .map_err(|_| error!(NortiaError::ArithmeticOverflow))?,
        keeper_reward: u64::try_from(keeper_reward)
            .map_err(|_| error!(NortiaError::ArithmeticOverflow))?,
        treasury_fee: u64::try_from(treasury_fee)
            .map_err(|_| error!(NortiaError::ArithmeticOverflow))?,
        net_pool: u64::try_from(net_pool).map_err(|_| error!(NortiaError::ArithmeticOverflow))?,
        payout_amount: u64::try_from(payout_amount)
            .map_err(|_| error!(NortiaError::ArithmeticOverflow))?,
        payout_remainder: u64::try_from(payout_remainder)
            .map_err(|_| error!(NortiaError::ArithmeticOverflow))?,
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
    require!(
        vault.amount >= amount,
        NortiaError::InsufficientVaultBalance
    );
    let market_id_bytes = market.market_id.to_le_bytes();
    let bump = [market.bump];
    let signer_seeds: &[&[u8]] = &[
        MARKET_SEED,
        market.authority.as_ref(),
        &market_id_bytes,
        &bump,
    ];
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
    fn deployment_identity_is_pinned_to_devnet_configuration() {
        assert_ne!(PROTOCOL_AUTHORITY, Pubkey::default());
        assert_eq!(
            DEVNET_USDC_MINT.to_string(),
            "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"
        );
        assert_eq!(
            TXLINE_PROGRAM_ID.to_string(),
            "6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J"
        );
    }

    #[test]
    fn protocol_space_matches_serialized_configuration() {
        let config = ProtocolConfig {
            bump: 1,
            authority: Pubkey::new_unique(),
            treasury_owner: Pubkey::new_unique(),
            fee_bps: 100,
            keeper_reward_bps: 1_000,
            collateral_mint: Pubkey::new_unique(),
            token_program: Pubkey::new_unique(),
            txline_program: TXLINE_PROGRAM_ID,
            committee: [
                Pubkey::new_unique(),
                Pubkey::new_unique(),
                Pubkey::new_unique(),
            ],
            placement_verifier: Pubkey::new_unique(),
            redeem_verifier: Pubkey::new_unique(),
        };
        let mut data = Vec::new();
        config.try_serialize(&mut data).unwrap();
        assert_eq!(ProtocolConfig::SPACE, data.len());
    }

    #[test]
    fn one_sided_batch_refunds_before_resolution() {
        assert_eq!(batch_phase(3, 0), MarketPhase::Refunding);
        assert_eq!(batch_phase(0, 3), MarketPhase::Refunding);
        assert_eq!(batch_phase(2, 1), MarketPhase::Batched);
    }

    #[test]
    fn settlement_collects_one_percent_from_gross_pool() {
        let settlement = calculate_settlement(TICKET_AMOUNT, 3, 2, 100, 1_000).unwrap();
        assert_eq!(
            settlement,
            SettlementAmounts {
                gross_pool: 3_000_000,
                protocol_fee: 30_000,
                keeper_reward: 3_000,
                treasury_fee: 27_000,
                net_pool: 2_970_000,
                payout_amount: 1_485_000,
                payout_remainder: 0,
            }
        );
    }

    #[test]
    fn settlement_assigns_division_dust_to_the_final_winner() {
        let settlement = calculate_settlement(1, 3, 2, 100, 1_000).unwrap();
        assert_eq!(settlement.payout_amount, 1);
        assert_eq!(settlement.payout_remainder, 1);
        assert_eq!(
            settlement.protocol_fee + settlement.payout_amount * 2 + settlement.payout_remainder,
            settlement.gross_pool
        );
    }

    #[test]
    fn settlement_rejects_invalid_fee_and_zero_winners() {
        assert!(calculate_settlement(TICKET_AMOUNT, 3, 2, 0, 1_000).is_err());
        assert!(calculate_settlement(TICKET_AMOUNT, 3, 2, 301, 1_000).is_err());
        assert!(calculate_settlement(TICKET_AMOUNT, 3, 2, 100, 5_001).is_err());
        assert!(calculate_settlement(TICKET_AMOUNT, 3, 0, 100, 1_000).is_err());
    }

    #[test]
    fn settlement_rejects_values_that_do_not_fit_u64() {
        assert!(calculate_settlement(u64::MAX, 2, 1, 100, 1_000).is_err());
    }
}

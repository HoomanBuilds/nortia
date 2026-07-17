pub mod constants;
pub mod error;
pub mod lmsr;
pub mod oracles;
pub mod state;
pub mod switchboard;
pub mod txline;
pub mod zk;

use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, TransferChecked};
use core::cmp::max;
use pyth_solana_receiver_sdk::price_update::PriceUpdateV2;
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

    pub fn initialize_engine(
        ctx: Context<InitializeEngine>,
        args: InitializeEngineArgs,
    ) -> Result<()> {
        require!(
            args.treasury_fee_share_bps > 0 && args.treasury_fee_share_bps < FEE_SPLIT_DENOMINATOR,
            NortiaError::InvalidEngineConfiguration
        );
        let engine = &mut ctx.accounts.engine;
        engine.bump = ctx.bumps.engine;
        engine.version = EngineConfig::VERSION;
        engine.authority = ctx.accounts.authority.key();
        engine.treasury_owner = ctx.accounts.protocol.treasury_owner;
        engine.collateral_mint = ctx.accounts.protocol.collateral_mint;
        engine.token_program = ctx.accounts.protocol.token_program;
        engine.treasury_fee_share_bps = args.treasury_fee_share_bps;
        engine.pyth_receiver_program = PYTH_RECEIVER_PROGRAM_ID;
        engine.switchboard_quote_program = SWITCHBOARD_QUOTE_PROGRAM_ID;
        engine.paused = false;
        emit!(EngineInitialized {
            engine: engine.key(),
            authority: engine.authority,
            treasury_owner: engine.treasury_owner,
            collateral_mint: engine.collateral_mint,
            treasury_fee_share_bps: engine.treasury_fee_share_bps,
            pyth_receiver_program: engine.pyth_receiver_program,
            switchboard_quote_program: engine.switchboard_quote_program,
        });
        Ok(())
    }

    pub fn initialize_hybrid_market(
        ctx: Context<InitializeHybridMarket>,
        args: InitializeHybridMarketArgs,
    ) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        require!(!ctx.accounts.engine.paused, NortiaError::InvalidPhase);
        require!(
            args.market_id > 0
                && args.question_hash != [0; 32]
                && args.rules_hash != [0; 32]
                && args.outcome_labels_hash != [0; 32]
                && args.trading_mode == HybridTradingMode::Continuous
                && args.rounding_reserve >= HYBRID_ROUNDING_RESERVE
                && args.max_trade_shares >= lmsr::MIN_TRADE_SHARES
                && args.max_trade_shares <= lmsr::MAX_TRADE_SHARES
                && args.trade_fee_bps <= lmsr::MAX_TRADING_FEE_BPS
                && now < args.lock_ts
                && args.lock_ts <= args.resolve_not_before_ts
                && args.resolve_not_before_ts < args.resolution_deadline_ts,
            NortiaError::InvalidMarketConfiguration
        );
        validate_oracle_config(&args.category, &args.oracle, args.resolve_not_before_ts)?;
        let initial_subsidy =
            lmsr::required_subsidy(args.liquidity_parameter, args.rounding_reserve)
                .map_err(|_| error!(NortiaError::InvalidLmsrState))?;
        let resolver_security_cap = if args.oracle.resolver == OracleResolverV2::OptimisticV1 {
            require!(
                args.oracle.bond_amount >= initial_subsidy,
                NortiaError::InvalidOracleConfiguration
            );
            args.oracle.bond_amount
        } else {
            u64::MAX
        };

        let market = &mut ctx.accounts.market;
        market.bump = ctx.bumps.market;
        market.vault_bump = ctx.bumps.vault;
        market.version = HybridMarket::VERSION;
        market.market_id = args.market_id;
        market.creator = ctx.accounts.creator.key();
        market.liquidity_owner = ctx.accounts.creator.key();
        market.category = args.category;
        market.trading_mode = args.trading_mode;
        market.pricing_model = HybridPricingModel::Lmsr;
        market.question_hash = args.question_hash;
        market.rules_hash = args.rules_hash;
        market.outcome_labels_hash = args.outcome_labels_hash;
        market.collateral_mint = ctx.accounts.engine.collateral_mint;
        market.token_program = ctx.accounts.engine.token_program;
        market.treasury_owner = ctx.accounts.engine.treasury_owner;
        market.oracle_config = ctx.accounts.oracle_config.key();
        market.liquidity_parameter = args.liquidity_parameter;
        market.initial_subsidy = initial_subsidy;
        market.rounding_reserve = args.rounding_reserve;
        market.max_trade_shares = args.max_trade_shares;
        market.resolver_security_cap = resolver_security_cap;
        market.yes_quantity = 0;
        market.no_quantity = 0;
        market.trade_fee_bps = args.trade_fee_bps;
        market.treasury_fee_share_bps = ctx.accounts.engine.treasury_fee_share_bps;
        market.open_ts = now;
        market.lock_ts = args.lock_ts;
        market.resolve_not_before_ts = args.resolve_not_before_ts;
        market.resolution_deadline_ts = args.resolution_deadline_ts;
        market.phase = HybridPhase::Open;
        market.outcome = HybridMarket::OUTCOME_UNSET;
        market.trade_count = 0;
        market.volume = 0;
        market.treasury_fees = 0;
        market.liquidity_fees = 0;
        market.outstanding_liability = 0;
        market.redeemed_liability = 0;
        market.settled_at = 0;
        market.settlement_evidence_hash = [0; 32];

        let oracle = &mut ctx.accounts.oracle_config;
        oracle.bump = ctx.bumps.oracle_config;
        oracle.version = OracleConfig::VERSION;
        oracle.market = market.key();
        oracle.resolver = args.oracle.resolver;
        oracle.source_program = args.oracle.source_program;
        oracle.source_queue = args.oracle.source_queue;
        oracle.source_id = args.oracle.source_id;
        oracle.comparator = args.oracle.comparator;
        oracle.threshold = args.oracle.threshold;
        oracle.threshold_exponent = args.oracle.threshold_exponent;
        oracle.observation_ts = args.oracle.observation_ts;
        oracle.observation_window_secs = args.oracle.observation_window_secs;
        oracle.max_staleness_secs = args.oracle.max_staleness_secs;
        oracle.max_staleness_slots = args.oracle.max_staleness_slots;
        oracle.max_confidence_bps = args.oracle.max_confidence_bps;
        oracle.min_samples = args.oracle.min_samples;
        oracle.challenge_period_secs = args.oracle.challenge_period_secs;
        oracle.bond_amount = args.oracle.bond_amount;
        oracle.config_hash = args.oracle.config_hash;
        oracle.optimistic_proposal = Pubkey::default();
        oracle.consumed = false;

        transfer_to_vault(
            &ctx.accounts.creator,
            &ctx.accounts.creator_token,
            &ctx.accounts.vault,
            &ctx.accounts.collateral_mint,
            &ctx.accounts.token_program,
            initial_subsidy,
        )?;

        emit!(HybridMarketCreated {
            market: market.key(),
            market_id: market.market_id,
            creator: market.creator,
            category: market.category,
            resolver: oracle.resolver,
            liquidity_parameter: market.liquidity_parameter,
            initial_subsidy: market.initial_subsidy,
            trade_fee_bps: market.trade_fee_bps,
            resolver_security_cap: market.resolver_security_cap,
            lock_ts: market.lock_ts,
        });
        Ok(())
    }

    pub fn initialize_position(ctx: Context<InitializePosition>) -> Result<()> {
        require!(
            ctx.accounts.market.phase == HybridPhase::Open,
            NortiaError::InvalidPhase
        );
        let position = &mut ctx.accounts.position;
        position.bump = ctx.bumps.position;
        position.version = Position::VERSION;
        position.market = ctx.accounts.market.key();
        position.owner = ctx.accounts.owner.key();
        position.yes_shares = 0;
        position.no_shares = 0;
        position.total_spent = 0;
        position.total_proceeds = 0;
        position.settled_amount = 0;
        position.settled = false;
        emit!(HybridPositionOpened {
            market: position.market,
            position: position.key(),
            owner: position.owner,
        });
        Ok(())
    }

    pub fn publish_hybrid_metadata(
        ctx: Context<PublishHybridMetadata>,
        args: PublishHybridMetadataArgs,
    ) -> Result<()> {
        validate_hybrid_metadata(&ctx.accounts.market, &args)?;
        let now = Clock::get()?.unix_timestamp;
        let metadata = &mut ctx.accounts.metadata;
        metadata.bump = ctx.bumps.metadata;
        metadata.version = HybridMarketMetadata::VERSION;
        metadata.market = ctx.accounts.market.key();
        metadata.creator = ctx.accounts.creator.key();
        metadata.question = args.question;
        metadata.rules = args.rules;
        metadata.yes_label = args.yes_label;
        metadata.no_label = args.no_label;
        metadata.reference_url = args.reference_url;
        metadata.published_at = now;
        emit!(HybridMetadataPublished {
            market: metadata.market,
            metadata: metadata.key(),
            creator: metadata.creator,
            published_at: now,
        });
        Ok(())
    }

    pub fn buy_hybrid_shares(ctx: Context<TradeHybridShares>, args: TradeSharesArgs) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        validate_hybrid_trade(&ctx.accounts.market, &args, now)?;
        let side = lmsr_side(args.side)?;
        let quantities = lmsr_quantities(&ctx.accounts.market);
        let quote = lmsr::quote_buy(
            quantities,
            ctx.accounts.market.liquidity_parameter,
            side,
            args.shares,
            ctx.accounts.market.trade_fee_bps,
        )
        .map_err(|_| error!(NortiaError::InvalidLmsrState))?;
        require!(
            quote.total_amount <= args.amount_guard,
            NortiaError::PriceGuardExceeded
        );
        let (treasury_fee, liquidity_fee) =
            split_hybrid_fee(quote.fee_amount, ctx.accounts.market.treasury_fee_share_bps)?;
        let projected_vault = ctx
            .accounts
            .vault
            .amount
            .checked_add(quote.raw_amount)
            .ok_or_else(|| error!(NortiaError::ArithmeticOverflow))?;
        require!(
            projected_vault >= max(quote.after.yes, quote.after.no),
            NortiaError::InsolventMarket
        );
        validate_resolver_security_cap(ctx.accounts.market.resolver_security_cap, quote.after)?;

        apply_position_buy(&mut ctx.accounts.position, side, &quote)?;
        apply_market_trade(
            &mut ctx.accounts.market,
            &quote,
            treasury_fee,
            liquidity_fee,
        )?;

        transfer_to_vault(
            &ctx.accounts.owner,
            &ctx.accounts.owner_token,
            &ctx.accounts.vault,
            &ctx.accounts.collateral_mint,
            &ctx.accounts.token_program,
            quote.raw_amount,
        )?;
        transfer_from_owner(
            &ctx.accounts.owner,
            &ctx.accounts.owner_token,
            &ctx.accounts.treasury_token,
            &ctx.accounts.collateral_mint,
            &ctx.accounts.token_program,
            treasury_fee,
        )?;
        transfer_from_owner(
            &ctx.accounts.owner,
            &ctx.accounts.owner_token,
            &ctx.accounts.liquidity_token,
            &ctx.accounts.collateral_mint,
            &ctx.accounts.token_program,
            liquidity_fee,
        )?;
        emit_hybrid_trade(
            &ctx.accounts.market,
            ctx.accounts.position.key(),
            &ctx.accounts.position,
            &quote,
        );
        Ok(())
    }

    pub fn sell_hybrid_shares(
        ctx: Context<TradeHybridShares>,
        args: TradeSharesArgs,
    ) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        validate_hybrid_trade(&ctx.accounts.market, &args, now)?;
        let side = lmsr_side(args.side)?;
        require!(
            position_shares(&ctx.accounts.position, side) >= args.shares,
            NortiaError::InsufficientPosition
        );
        let quantities = lmsr_quantities(&ctx.accounts.market);
        let quote = lmsr::quote_sell(
            quantities,
            ctx.accounts.market.liquidity_parameter,
            side,
            args.shares,
            ctx.accounts.market.trade_fee_bps,
        )
        .map_err(|_| error!(NortiaError::InvalidLmsrState))?;
        require!(
            quote.total_amount >= args.amount_guard,
            NortiaError::PriceGuardExceeded
        );
        let (treasury_fee, liquidity_fee) =
            split_hybrid_fee(quote.fee_amount, ctx.accounts.market.treasury_fee_share_bps)?;
        let projected_vault = ctx
            .accounts
            .vault
            .amount
            .checked_sub(quote.raw_amount)
            .ok_or_else(|| error!(NortiaError::InsufficientVaultBalance))?;
        require!(
            projected_vault >= max(quote.after.yes, quote.after.no),
            NortiaError::InsolventMarket
        );

        apply_position_sell(&mut ctx.accounts.position, side, &quote)?;
        apply_market_trade(
            &mut ctx.accounts.market,
            &quote,
            treasury_fee,
            liquidity_fee,
        )?;

        transfer_from_hybrid_vault(
            &ctx.accounts.market,
            &ctx.accounts.vault,
            &ctx.accounts.owner_token,
            &ctx.accounts.collateral_mint,
            &ctx.accounts.token_program,
            quote.total_amount,
        )?;
        transfer_from_hybrid_vault(
            &ctx.accounts.market,
            &ctx.accounts.vault,
            &ctx.accounts.treasury_token,
            &ctx.accounts.collateral_mint,
            &ctx.accounts.token_program,
            treasury_fee,
        )?;
        transfer_from_hybrid_vault(
            &ctx.accounts.market,
            &ctx.accounts.vault,
            &ctx.accounts.liquidity_token,
            &ctx.accounts.collateral_mint,
            &ctx.accounts.token_program,
            liquidity_fee,
        )?;
        emit_hybrid_trade(
            &ctx.accounts.market,
            ctx.accounts.position.key(),
            &ctx.accounts.position,
            &quote,
        );
        Ok(())
    }

    pub fn lock_hybrid_market(ctx: Context<LockHybridMarket>) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        require!(
            ctx.accounts.market.phase == HybridPhase::Open,
            NortiaError::InvalidPhase
        );
        require!(now >= ctx.accounts.market.lock_ts, NortiaError::TooEarly);
        ctx.accounts.market.phase = HybridPhase::Locked;
        emit!(HybridMarketLocked {
            market: ctx.accounts.market.key(),
            locked_at: now,
        });
        Ok(())
    }

    pub fn resolve_hybrid_with_pyth(ctx: Context<ResolveHybridWithPyth>) -> Result<()> {
        let clock = Clock::get()?;
        let observation = oracles::validate_pyth_observation(
            &ctx.accounts.price_update,
            &ctx.accounts.oracle_config,
            &clock,
        )?;
        let value_bytes = observation.value.to_le_bytes();
        let exponent_bytes = observation.exponent.to_le_bytes();
        let timestamp_bytes = observation.timestamp.to_le_bytes();
        let confidence_bytes = observation.confidence.to_le_bytes();
        let previous_timestamp_bytes = ctx
            .accounts
            .price_update
            .price_message
            .prev_publish_time
            .to_le_bytes();
        let ema_price_bytes = ctx
            .accounts
            .price_update
            .price_message
            .ema_price
            .to_le_bytes();
        let ema_confidence_bytes = ctx
            .accounts
            .price_update
            .price_message
            .ema_conf
            .to_le_bytes();
        let posted_slot_bytes = ctx.accounts.price_update.posted_slot.to_le_bytes();
        let evidence_hash = hashv(&[
            b"nortia-pyth-resolution-v1",
            ctx.accounts.market.key().as_ref(),
            ctx.accounts.oracle_config.config_hash.as_ref(),
            ctx.accounts.oracle_config.source_id.as_ref(),
            ctx.accounts.price_update.key().as_ref(),
            ctx.accounts.price_update.write_authority.as_ref(),
            &value_bytes,
            &exponent_bytes,
            &timestamp_bytes,
            &previous_timestamp_bytes,
            &confidence_bytes,
            &ema_price_bytes,
            &ema_confidence_bytes,
            &posted_slot_bytes,
        ])
        .to_bytes();
        finalize_hybrid_resolution(
            &mut ctx.accounts.market,
            &mut ctx.accounts.oracle_config,
            &mut ctx.accounts.receipt,
            FinalizeHybridResolutionArgs {
                receipt_bump: ctx.bumps.receipt,
                source_account: ctx.accounts.price_update.key(),
                observation,
                evidence_hash,
                now: clock.unix_timestamp,
                vault_balance: ctx.accounts.vault.amount,
                timeout: false,
            },
        )
    }

    pub fn resolve_hybrid_with_txline(
        ctx: Context<ResolveHybridWithTxline>,
        payload: StatValidationInput,
    ) -> Result<()> {
        let clock = Clock::get()?;
        let observation = txline::resolve_hybrid_total_goals(
            &ctx.accounts.market,
            &ctx.accounts.oracle_config,
            &payload,
            &ctx.accounts.daily_scores_merkle_roots,
            &ctx.accounts.txline_program,
            clock.unix_timestamp,
        )?;
        let mut evidence_bytes = Vec::new();
        payload
            .serialize(&mut evidence_bytes)
            .map_err(|_| error!(NortiaError::InvalidScorePayload))?;
        let evidence_hash = hashv(&[
            b"nortia-txline-resolution-v2",
            ctx.accounts.market.key().as_ref(),
            ctx.accounts.oracle_config.config_hash.as_ref(),
            ctx.accounts.oracle_config.source_id.as_ref(),
            TXLINE_PROGRAM_ID.as_ref(),
            ctx.accounts.daily_scores_merkle_roots.key.as_ref(),
            evidence_bytes.as_slice(),
        ])
        .to_bytes();
        finalize_hybrid_resolution(
            &mut ctx.accounts.market,
            &mut ctx.accounts.oracle_config,
            &mut ctx.accounts.receipt,
            FinalizeHybridResolutionArgs {
                receipt_bump: ctx.bumps.receipt,
                source_account: ctx.accounts.daily_scores_merkle_roots.key(),
                observation,
                evidence_hash,
                now: clock.unix_timestamp,
                vault_balance: ctx.accounts.vault.amount,
                timeout: false,
            },
        )
    }

    pub fn resolve_hybrid_with_switchboard(
        ctx: Context<ResolveHybridWithSwitchboard>,
    ) -> Result<()> {
        let clock = Clock::get()?;
        let observation = switchboard::validate_switchboard_account(
            &ctx.accounts.quote_account,
            &ctx.accounts.oracle_config,
            &clock,
        )?;
        let value_bytes = observation.value.to_le_bytes();
        let exponent_bytes = observation.exponent.to_le_bytes();
        let timestamp_bytes = observation.timestamp.to_le_bytes();
        let slot_bytes = observation.slot.to_le_bytes();
        let quote_data = ctx
            .accounts
            .quote_account
            .try_borrow_data()
            .map_err(|_| error!(NortiaError::InvalidSwitchboardQuote))?;
        let evidence_hash = hashv(&[
            b"nortia-switchboard-resolution-v1",
            ctx.accounts.market.key().as_ref(),
            ctx.accounts.oracle_config.config_hash.as_ref(),
            ctx.accounts.oracle_config.source_queue.as_ref(),
            ctx.accounts.oracle_config.source_id.as_ref(),
            ctx.accounts.quote_account.key().as_ref(),
            &value_bytes,
            &exponent_bytes,
            &timestamp_bytes,
            &slot_bytes,
            &[observation.sample_count],
            quote_data.as_ref(),
        ])
        .to_bytes();
        drop(quote_data);
        finalize_hybrid_resolution(
            &mut ctx.accounts.market,
            &mut ctx.accounts.oracle_config,
            &mut ctx.accounts.receipt,
            FinalizeHybridResolutionArgs {
                receipt_bump: ctx.bumps.receipt,
                source_account: ctx.accounts.quote_account.key(),
                observation,
                evidence_hash,
                now: clock.unix_timestamp,
                vault_balance: ctx.accounts.vault.amount,
                timeout: false,
            },
        )
    }

    pub fn propose_optimistic_resolution(
        ctx: Context<ProposeOptimisticResolution>,
        args: ProposeOptimisticArgs,
    ) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let evidence = OptimisticEvidence {
            outcome: args.outcome,
            hash: &args.assertion_hash,
            uri: &args.evidence_uri,
        };
        let challenge_deadline = validate_optimistic_proposal(
            ctx.accounts.market.key(),
            &ctx.accounts.market,
            &ctx.accounts.oracle_config,
            evidence,
            now,
        )?;

        let proposal = &mut ctx.accounts.proposal;
        proposal.bump = ctx.bumps.proposal;
        proposal.bond_vault_bump = ctx.bumps.bond_vault;
        proposal.version = OptimisticProposal::VERSION;
        proposal.market = ctx.accounts.market.key();
        proposal.proposer = ctx.accounts.proposer.key();
        proposal.proposer_token = ctx.accounts.proposer_token.key();
        proposal.proposed_outcome = args.outcome;
        proposal.assertion_hash = args.assertion_hash;
        proposal.assertion_evidence_uri = args.evidence_uri;
        proposal.proposed_at = now;
        proposal.challenge_deadline = challenge_deadline;
        proposal.challenger = Pubkey::default();
        proposal.challenger_token = Pubkey::default();
        proposal.challenged_outcome = HybridMarket::OUTCOME_UNSET;
        proposal.challenge_hash = [0; 32];
        proposal.challenge_evidence_uri = String::new();
        proposal.challenged_at = 0;
        proposal.bond_amount = ctx.accounts.oracle_config.bond_amount;
        proposal.proposer_payout = 0;
        proposal.challenger_payout = 0;
        proposal.treasury_payout = 0;
        proposal.proposer_claimed = false;
        proposal.challenger_claimed = false;
        proposal.treasury_claimed = false;
        proposal.finalized = false;
        proposal.winner = Pubkey::default();
        proposal.decision_hash = [0; 32];

        ctx.accounts.oracle_config.optimistic_proposal = proposal.key();
        ctx.accounts.market.phase = HybridPhase::Resolving;
        transfer_to_vault(
            &ctx.accounts.proposer,
            &ctx.accounts.proposer_token,
            &ctx.accounts.bond_vault,
            &ctx.accounts.collateral_mint,
            &ctx.accounts.token_program,
            proposal.bond_amount,
        )?;
        emit!(OptimisticResolutionProposed {
            market: ctx.accounts.market.key(),
            proposal: proposal.key(),
            proposer: proposal.proposer,
            outcome: proposal.proposed_outcome,
            assertion_hash: proposal.assertion_hash,
            evidence_uri: proposal.assertion_evidence_uri.clone(),
            bond_amount: proposal.bond_amount,
            challenge_deadline,
        });
        Ok(())
    }

    pub fn challenge_optimistic_resolution(
        ctx: Context<ChallengeOptimisticResolution>,
        args: ChallengeOptimisticArgs,
    ) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let evidence = OptimisticEvidence {
            outcome: args.outcome,
            hash: &args.challenge_hash,
            uri: &args.evidence_uri,
        };
        validate_optimistic_challenge(
            ctx.accounts.market.key(),
            &ctx.accounts.market,
            &ctx.accounts.proposal,
            ctx.accounts.challenger.key(),
            evidence,
            now,
        )?;
        let proposal = &mut ctx.accounts.proposal;
        transfer_to_vault(
            &ctx.accounts.challenger,
            &ctx.accounts.challenger_token,
            &ctx.accounts.bond_vault,
            &ctx.accounts.collateral_mint,
            &ctx.accounts.token_program,
            proposal.bond_amount,
        )?;
        proposal.challenger = ctx.accounts.challenger.key();
        proposal.challenger_token = ctx.accounts.challenger_token.key();
        proposal.challenged_outcome = args.outcome;
        proposal.challenge_hash = args.challenge_hash;
        proposal.challenge_evidence_uri = args.evidence_uri;
        proposal.challenged_at = now;
        ctx.accounts.market.phase = HybridPhase::Disputed;
        emit!(OptimisticResolutionChallenged {
            market: ctx.accounts.market.key(),
            proposal: proposal.key(),
            challenger: proposal.challenger,
            outcome: proposal.challenged_outcome,
            challenge_hash: proposal.challenge_hash,
            evidence_uri: proposal.challenge_evidence_uri.clone(),
            bond_amount: proposal.bond_amount,
        });
        Ok(())
    }

    pub fn finalize_optimistic_resolution(
        ctx: Context<FinalizeOptimisticResolution>,
    ) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let (outcome, timed_out) =
            optimistic_finalize_outcome(&ctx.accounts.market, &ctx.accounts.proposal, now)?;
        let evidence_hash = hashv(&[
            if timed_out {
                b"nortia-optimistic-proposal-timeout-v1"
            } else {
                b"nortia-optimistic-unchallenged-v1"
            },
            ctx.accounts.market.key().as_ref(),
            ctx.accounts.oracle_config.config_hash.as_ref(),
            ctx.accounts.proposal.key().as_ref(),
            ctx.accounts.proposal.assertion_hash.as_ref(),
            &[ctx.accounts.proposal.proposed_outcome],
            &ctx.accounts.proposal.proposed_at.to_le_bytes(),
            &ctx.accounts.proposal.challenge_deadline.to_le_bytes(),
        ])
        .to_bytes();
        finalize_hybrid_resolution(
            &mut ctx.accounts.market,
            &mut ctx.accounts.oracle_config,
            &mut ctx.accounts.receipt,
            FinalizeHybridResolutionArgs {
                receipt_bump: ctx.bumps.receipt,
                source_account: ctx.accounts.proposal.key(),
                observation: optimistic_observation(outcome, now),
                evidence_hash,
                now,
                vault_balance: ctx.accounts.vault.amount,
                timeout: timed_out,
            },
        )?;
        let bond_amount = ctx.accounts.proposal.bond_amount;
        record_optimistic_payouts(&mut ctx.accounts.proposal, bond_amount, 0, 0)?;
        ctx.accounts.proposal.finalized = true;
        ctx.accounts.proposal.winner = if timed_out {
            Pubkey::default()
        } else {
            ctx.accounts.proposal.proposer
        };
        ctx.accounts.proposal.decision_hash = evidence_hash;
        emit!(OptimisticResolutionFinalized {
            market: ctx.accounts.market.key(),
            proposal: ctx.accounts.proposal.key(),
            outcome,
            winner: ctx.accounts.proposal.winner,
            winner_payout: if timed_out {
                0
            } else {
                ctx.accounts.proposal.bond_amount
            },
            treasury_fee: 0,
            decision_hash: evidence_hash,
            invalid_refund: timed_out,
        });
        Ok(())
    }

    pub fn arbitrate_optimistic_resolution(
        ctx: Context<ArbitrateOptimisticResolution>,
        args: ArbitrateOptimisticArgs,
    ) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let proposal = &ctx.accounts.proposal;
        validate_optimistic_arbitration(
            &ctx.accounts.market,
            proposal,
            args.outcome,
            &args.decision_hash,
            now,
        )?;
        verify_committee_quorum(&ctx.accounts.protocol.committee, ctx.remaining_accounts)?;
        let winner = if args.outcome == proposal.proposed_outcome {
            proposal.proposer
        } else {
            proposal.challenger
        };
        let (winner_payout, treasury_fee) = optimistic_dispute_payout(proposal.bond_amount)?;
        let evidence_hash = hashv(&[
            b"nortia-optimistic-arbitration-v1",
            ctx.accounts.market.key().as_ref(),
            ctx.accounts.oracle_config.config_hash.as_ref(),
            ctx.accounts.proposal.key().as_ref(),
            proposal.assertion_hash.as_ref(),
            proposal.challenge_hash.as_ref(),
            args.decision_hash.as_ref(),
            winner.as_ref(),
            &[args.outcome],
        ])
        .to_bytes();
        finalize_hybrid_resolution(
            &mut ctx.accounts.market,
            &mut ctx.accounts.oracle_config,
            &mut ctx.accounts.receipt,
            FinalizeHybridResolutionArgs {
                receipt_bump: ctx.bumps.receipt,
                source_account: ctx.accounts.proposal.key(),
                observation: optimistic_observation(args.outcome, now),
                evidence_hash,
                now,
                vault_balance: ctx.accounts.vault.amount,
                timeout: false,
            },
        )?;
        let proposal = &mut ctx.accounts.proposal;
        let (proposer_payout, challenger_payout) = if winner == proposal.proposer {
            (winner_payout, 0)
        } else {
            (0, winner_payout)
        };
        record_optimistic_payouts(proposal, proposer_payout, challenger_payout, treasury_fee)?;
        proposal.finalized = true;
        proposal.winner = winner;
        proposal.decision_hash = args.decision_hash;
        emit!(OptimisticResolutionFinalized {
            market: ctx.accounts.market.key(),
            proposal: proposal.key(),
            outcome: args.outcome,
            winner,
            winner_payout,
            treasury_fee,
            decision_hash: args.decision_hash,
            invalid_refund: false,
        });
        Ok(())
    }

    pub fn timeout_optimistic_dispute(ctx: Context<TimeoutOptimisticDispute>) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        require!(
            ctx.accounts.market.phase == HybridPhase::Disputed
                && !ctx.accounts.proposal.finalized
                && ctx.accounts.proposal.challenger != Pubkey::default()
                && now > ctx.accounts.market.resolution_deadline_ts,
            NortiaError::InvalidPhase
        );
        let evidence_hash = hashv(&[
            b"nortia-optimistic-dispute-timeout-v1",
            ctx.accounts.market.key().as_ref(),
            ctx.accounts.oracle_config.config_hash.as_ref(),
            ctx.accounts.proposal.key().as_ref(),
            ctx.accounts.proposal.assertion_hash.as_ref(),
            ctx.accounts.proposal.challenge_hash.as_ref(),
            &ctx.accounts.market.resolution_deadline_ts.to_le_bytes(),
        ])
        .to_bytes();
        finalize_hybrid_resolution(
            &mut ctx.accounts.market,
            &mut ctx.accounts.oracle_config,
            &mut ctx.accounts.receipt,
            FinalizeHybridResolutionArgs {
                receipt_bump: ctx.bumps.receipt,
                source_account: ctx.accounts.proposal.key(),
                observation: optimistic_observation(HybridMarket::OUTCOME_INVALID, now),
                evidence_hash,
                now,
                vault_balance: ctx.accounts.vault.amount,
                timeout: true,
            },
        )?;
        let bond_amount = ctx.accounts.proposal.bond_amount;
        record_optimistic_payouts(&mut ctx.accounts.proposal, bond_amount, bond_amount, 0)?;
        ctx.accounts.proposal.finalized = true;
        ctx.accounts.proposal.winner = Pubkey::default();
        ctx.accounts.proposal.decision_hash = evidence_hash;
        emit!(OptimisticResolutionFinalized {
            market: ctx.accounts.market.key(),
            proposal: ctx.accounts.proposal.key(),
            outcome: HybridMarket::OUTCOME_INVALID,
            winner: Pubkey::default(),
            winner_payout: 0,
            treasury_fee: 0,
            decision_hash: evidence_hash,
            invalid_refund: true,
        });
        Ok(())
    }

    pub fn claim_optimistic_bond(ctx: Context<ClaimOptimisticBond>) -> Result<()> {
        let claimant = ctx.accounts.claimant.key();
        let amount = prepare_optimistic_bond_claim(
            &mut ctx.accounts.proposal,
            ctx.accounts.market.treasury_owner,
            claimant,
        )?;
        transfer_from_hybrid_vault(
            &ctx.accounts.market,
            &ctx.accounts.bond_vault,
            &ctx.accounts.destination,
            &ctx.accounts.collateral_mint,
            &ctx.accounts.token_program,
            amount,
        )?;
        emit!(OptimisticBondClaimed {
            market: ctx.accounts.market.key(),
            proposal: ctx.accounts.proposal.key(),
            claimant,
            destination: ctx.accounts.destination.key(),
            amount,
        });
        Ok(())
    }

    pub fn resolve_hybrid_timeout(ctx: Context<ResolveHybridTimeout>) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        require!(
            ctx.accounts.oracle_config.optimistic_proposal == Pubkey::default(),
            NortiaError::InvalidPhase
        );
        let deadline_bytes = ctx.accounts.market.resolution_deadline_ts.to_le_bytes();
        let evidence_hash = hashv(&[
            b"nortia-oracle-timeout-v1",
            ctx.accounts.market.key().as_ref(),
            ctx.accounts.oracle_config.config_hash.as_ref(),
            &deadline_bytes,
        ])
        .to_bytes();
        finalize_hybrid_resolution(
            &mut ctx.accounts.market,
            &mut ctx.accounts.oracle_config,
            &mut ctx.accounts.receipt,
            FinalizeHybridResolutionArgs {
                receipt_bump: ctx.bumps.receipt,
                source_account: Pubkey::default(),
                observation: oracles::NormalizedObservation {
                    outcome: HybridMarket::OUTCOME_INVALID,
                    value: 0,
                    exponent: 0,
                    timestamp: now,
                    slot: 0,
                    confidence: 0,
                    sample_count: 0,
                },
                evidence_hash,
                now,
                vault_balance: ctx.accounts.vault.amount,
                timeout: true,
            },
        )
    }

    pub fn settle_hybrid_position(ctx: Context<SettleHybridPosition>) -> Result<()> {
        require!(
            ctx.accounts.market.phase == HybridPhase::Resolved,
            NortiaError::InvalidPhase
        );
        require!(
            !ctx.accounts.position.settled,
            NortiaError::PositionAlreadySettled
        );
        let amount = hybrid_position_payout(&ctx.accounts.position, ctx.accounts.market.outcome)?;
        require!(
            ctx.accounts.market.outstanding_liability >= amount,
            NortiaError::InsolventMarket
        );
        let projected_vault = ctx
            .accounts
            .vault
            .amount
            .checked_sub(amount)
            .ok_or_else(|| error!(NortiaError::InsufficientVaultBalance))?;
        ctx.accounts.position.settled = true;
        ctx.accounts.position.settled_amount = amount;
        ctx.accounts.market.outstanding_liability -= amount;
        ctx.accounts.market.redeemed_liability = ctx
            .accounts
            .market
            .redeemed_liability
            .checked_add(amount)
            .ok_or_else(|| error!(NortiaError::ArithmeticOverflow))?;
        let closed = close_hybrid_market_if_drained(&mut ctx.accounts.market, projected_vault)?;
        if amount > 0 {
            transfer_from_hybrid_vault(
                &ctx.accounts.market,
                &ctx.accounts.vault,
                &ctx.accounts.owner_token,
                &ctx.accounts.collateral_mint,
                &ctx.accounts.token_program,
                amount,
            )?;
        }
        emit!(HybridPositionSettled {
            market: ctx.accounts.market.key(),
            position: ctx.accounts.position.key(),
            owner: ctx.accounts.owner.key(),
            outcome: ctx.accounts.market.outcome,
            amount,
        });
        if closed {
            emit!(HybridMarketClosed {
                market: ctx.accounts.market.key(),
                closed_at: Clock::get()?.unix_timestamp,
            });
        }
        Ok(())
    }

    pub fn withdraw_hybrid_liquidity(ctx: Context<WithdrawHybridLiquidity>) -> Result<()> {
        require!(
            ctx.accounts.market.phase == HybridPhase::Resolved,
            NortiaError::InvalidPhase
        );
        let amount = ctx
            .accounts
            .vault
            .amount
            .checked_sub(ctx.accounts.market.outstanding_liability)
            .ok_or_else(|| error!(NortiaError::InsolventMarket))?;
        require!(amount > 0, NortiaError::ZeroCommitment);
        let projected_vault = ctx
            .accounts
            .vault
            .amount
            .checked_sub(amount)
            .ok_or_else(|| error!(NortiaError::InsufficientVaultBalance))?;
        let closed = close_hybrid_market_if_drained(&mut ctx.accounts.market, projected_vault)?;
        transfer_from_hybrid_vault(
            &ctx.accounts.market,
            &ctx.accounts.vault,
            &ctx.accounts.liquidity_token,
            &ctx.accounts.collateral_mint,
            &ctx.accounts.token_program,
            amount,
        )?;
        emit!(HybridLiquidityWithdrawn {
            market: ctx.accounts.market.key(),
            liquidity_owner: ctx.accounts.liquidity_owner.key(),
            amount,
            outstanding_liability: ctx.accounts.market.outstanding_liability,
        });
        if closed {
            emit!(HybridMarketClosed {
                market: ctx.accounts.market.key(),
                closed_at: Clock::get()?.unix_timestamp,
            });
        }
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

#[derive(Accounts)]
pub struct InitializeEngine<'info> {
    #[account(
        mut,
        address = protocol.authority @ NortiaError::InvalidEngineConfiguration
    )]
    pub authority: Signer<'info>,
    #[account(
        seeds = [PROTOCOL_SEED],
        bump = protocol.bump,
        constraint = protocol.collateral_mint == DEVNET_USDC_MINT
            @ NortiaError::InvalidCollateralMint
    )]
    pub protocol: Account<'info, ProtocolConfig>,
    #[account(
        init,
        payer = authority,
        space = EngineConfig::SPACE,
        seeds = [ENGINE_SEED],
        bump
    )]
    pub engine: Account<'info, EngineConfig>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(args: InitializeHybridMarketArgs)]
pub struct InitializeHybridMarket<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,
    #[account(
        seeds = [ENGINE_SEED],
        bump = engine.bump,
        constraint = engine.collateral_mint == collateral_mint.key()
            @ NortiaError::InvalidCollateralMint,
        constraint = engine.token_program == token_program.key()
            @ NortiaError::InvalidTokenAccount
    )]
    pub engine: Account<'info, EngineConfig>,
    #[account(
        address = engine.collateral_mint @ NortiaError::InvalidCollateralMint,
        constraint = collateral_mint.decimals == USDC_DECIMALS
            @ NortiaError::InvalidCollateralMint
    )]
    pub collateral_mint: Account<'info, Mint>,
    #[account(
        mut,
        constraint = creator_token.owner == creator.key()
            @ NortiaError::InvalidTokenAccount,
        constraint = creator_token.mint == collateral_mint.key()
            @ NortiaError::InvalidTokenAccount
    )]
    pub creator_token: Account<'info, TokenAccount>,
    #[account(
        init,
        payer = creator,
        space = HybridMarket::SPACE,
        seeds = [HYBRID_MARKET_SEED, creator.key().as_ref(), &args.market_id.to_le_bytes()],
        bump
    )]
    pub market: Box<Account<'info, HybridMarket>>,
    #[account(
        init,
        payer = creator,
        space = OracleConfig::SPACE,
        seeds = [ORACLE_CONFIG_SEED, market.key().as_ref()],
        bump
    )]
    pub oracle_config: Box<Account<'info, OracleConfig>>,
    #[account(
        init,
        payer = creator,
        seeds = [HYBRID_VAULT_SEED, market.key().as_ref()],
        bump,
        token::mint = collateral_mint,
        token::authority = market
    )]
    pub vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct InitializePosition<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(
        seeds = [HYBRID_MARKET_SEED, market.creator.as_ref(), &market.market_id.to_le_bytes()],
        bump = market.bump
    )]
    pub market: Box<Account<'info, HybridMarket>>,
    #[account(
        init,
        payer = owner,
        space = Position::SPACE,
        seeds = [POSITION_SEED, market.key().as_ref(), owner.key().as_ref()],
        bump
    )]
    pub position: Account<'info, Position>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct PublishHybridMetadata<'info> {
    #[account(
        mut,
        address = market.creator @ NortiaError::InvalidMarketMetadata
    )]
    pub creator: Signer<'info>,
    #[account(
        seeds = [HYBRID_MARKET_SEED, market.creator.as_ref(), &market.market_id.to_le_bytes()],
        bump = market.bump
    )]
    pub market: Box<Account<'info, HybridMarket>>,
    #[account(
        init,
        payer = creator,
        space = HybridMarketMetadata::SPACE,
        seeds = [HYBRID_METADATA_SEED, market.key().as_ref()],
        bump
    )]
    pub metadata: Box<Account<'info, HybridMarketMetadata>>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct TradeHybridShares<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(
        mut,
        seeds = [HYBRID_MARKET_SEED, market.creator.as_ref(), &market.market_id.to_le_bytes()],
        bump = market.bump,
        constraint = market.collateral_mint == collateral_mint.key()
            @ NortiaError::InvalidCollateralMint,
        constraint = market.token_program == token_program.key()
            @ NortiaError::InvalidTokenAccount,
        constraint = market.treasury_owner == treasury_token.owner
            @ NortiaError::InvalidTreasury,
        constraint = market.liquidity_owner == liquidity_token.owner
            @ NortiaError::InvalidTokenAccount
    )]
    pub market: Box<Account<'info, HybridMarket>>,
    #[account(
        mut,
        seeds = [POSITION_SEED, market.key().as_ref(), owner.key().as_ref()],
        bump = position.bump,
        constraint = position.market == market.key() @ NortiaError::InvalidPosition,
        constraint = position.owner == owner.key() @ NortiaError::InvalidPosition,
        constraint = !position.settled @ NortiaError::PositionAlreadySettled
    )]
    pub position: Box<Account<'info, Position>>,
    pub collateral_mint: Box<Account<'info, Mint>>,
    #[account(
        mut,
        constraint = owner_token.owner == owner.key()
            @ NortiaError::InvalidTokenAccount,
        constraint = owner_token.mint == collateral_mint.key()
            @ NortiaError::InvalidTokenAccount
    )]
    pub owner_token: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        seeds = [HYBRID_VAULT_SEED, market.key().as_ref()],
        bump = market.vault_bump,
        token::mint = collateral_mint,
        token::authority = market
    )]
    pub vault: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        constraint = treasury_token.mint == collateral_mint.key()
            @ NortiaError::InvalidTreasury
    )]
    pub treasury_token: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        constraint = liquidity_token.mint == collateral_mint.key()
            @ NortiaError::InvalidTokenAccount
    )]
    pub liquidity_token: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct LockHybridMarket<'info> {
    #[account(
        mut,
        seeds = [HYBRID_MARKET_SEED, market.creator.as_ref(), &market.market_id.to_le_bytes()],
        bump = market.bump
    )]
    pub market: Account<'info, HybridMarket>,
}

#[derive(Accounts)]
pub struct ResolveHybridWithPyth<'info> {
    #[account(mut)]
    pub keeper: Signer<'info>,
    #[account(
        mut,
        seeds = [HYBRID_MARKET_SEED, market.creator.as_ref(), &market.market_id.to_le_bytes()],
        bump = market.bump,
        constraint = market.oracle_config == oracle_config.key()
            @ NortiaError::InvalidOracleConfiguration,
        constraint = market.collateral_mint == vault.mint
            @ NortiaError::InvalidCollateralMint
    )]
    pub market: Box<Account<'info, HybridMarket>>,
    #[account(
        mut,
        seeds = [ORACLE_CONFIG_SEED, market.key().as_ref()],
        bump = oracle_config.bump,
        constraint = oracle_config.market == market.key()
            @ NortiaError::InvalidOracleConfiguration,
        constraint = oracle_config.resolver == OracleResolverV2::PythPriceV2
            @ NortiaError::InvalidOracleConfiguration,
        constraint = !oracle_config.consumed @ NortiaError::ResolutionReplay
    )]
    pub oracle_config: Box<Account<'info, OracleConfig>>,
    #[account(
        init,
        payer = keeper,
        space = ResolutionReceipt::SPACE,
        seeds = [RESOLUTION_RECEIPT_SEED, market.key().as_ref()],
        bump
    )]
    pub receipt: Box<Account<'info, ResolutionReceipt>>,
    pub price_update: Box<Account<'info, PriceUpdateV2>>,
    #[account(
        seeds = [HYBRID_VAULT_SEED, market.key().as_ref()],
        bump = market.vault_bump,
        token::mint = market.collateral_mint,
        token::authority = market
    )]
    pub vault: Box<Account<'info, TokenAccount>>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ResolveHybridWithTxline<'info> {
    #[account(mut)]
    pub keeper: Signer<'info>,
    #[account(
        mut,
        seeds = [HYBRID_MARKET_SEED, market.creator.as_ref(), &market.market_id.to_le_bytes()],
        bump = market.bump,
        constraint = market.oracle_config == oracle_config.key()
            @ NortiaError::InvalidOracleConfiguration,
        constraint = market.collateral_mint == vault.mint
            @ NortiaError::InvalidCollateralMint
    )]
    pub market: Box<Account<'info, HybridMarket>>,
    #[account(
        mut,
        seeds = [ORACLE_CONFIG_SEED, market.key().as_ref()],
        bump = oracle_config.bump,
        constraint = oracle_config.market == market.key()
            @ NortiaError::InvalidOracleConfiguration,
        constraint = oracle_config.resolver == OracleResolverV2::TxlineStatV2
            @ NortiaError::InvalidOracleConfiguration,
        constraint = !oracle_config.consumed @ NortiaError::ResolutionReplay
    )]
    pub oracle_config: Box<Account<'info, OracleConfig>>,
    #[account(
        init,
        payer = keeper,
        space = ResolutionReceipt::SPACE,
        seeds = [RESOLUTION_RECEIPT_SEED, market.key().as_ref()],
        bump
    )]
    pub receipt: Box<Account<'info, ResolutionReceipt>>,
    #[account(
        seeds = [HYBRID_VAULT_SEED, market.key().as_ref()],
        bump = market.vault_bump,
        token::mint = market.collateral_mint,
        token::authority = market
    )]
    pub vault: Box<Account<'info, TokenAccount>>,
    /// CHECK: Ownership and PDA derivation are checked against the pinned TxLINE program.
    pub daily_scores_merkle_roots: UncheckedAccount<'info>,
    /// CHECK: The address and executable flag are checked against the pinned TxLINE ID.
    pub txline_program: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ResolveHybridWithSwitchboard<'info> {
    #[account(mut)]
    pub keeper: Signer<'info>,
    #[account(
        mut,
        seeds = [HYBRID_MARKET_SEED, market.creator.as_ref(), &market.market_id.to_le_bytes()],
        bump = market.bump,
        constraint = market.oracle_config == oracle_config.key()
            @ NortiaError::InvalidOracleConfiguration,
        constraint = market.collateral_mint == vault.mint
            @ NortiaError::InvalidCollateralMint
    )]
    pub market: Box<Account<'info, HybridMarket>>,
    #[account(
        mut,
        seeds = [ORACLE_CONFIG_SEED, market.key().as_ref()],
        bump = oracle_config.bump,
        constraint = oracle_config.market == market.key()
            @ NortiaError::InvalidOracleConfiguration,
        constraint = oracle_config.resolver == OracleResolverV2::SwitchboardQuoteV1
            @ NortiaError::InvalidOracleConfiguration,
        constraint = !oracle_config.consumed @ NortiaError::ResolutionReplay
    )]
    pub oracle_config: Box<Account<'info, OracleConfig>>,
    #[account(
        init,
        payer = keeper,
        space = ResolutionReceipt::SPACE,
        seeds = [RESOLUTION_RECEIPT_SEED, market.key().as_ref()],
        bump
    )]
    pub receipt: Box<Account<'info, ResolutionReceipt>>,
    #[account(
        seeds = [HYBRID_VAULT_SEED, market.key().as_ref()],
        bump = market.vault_bump,
        token::mint = market.collateral_mint,
        token::authority = market
    )]
    pub vault: Box<Account<'info, TokenAccount>>,
    /// CHECK: Owner, canonical PDA, queue, feed, samples, and payload are verified in the handler.
    pub quote_account: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ProposeOptimisticResolution<'info> {
    #[account(mut)]
    pub proposer: Signer<'info>,
    #[account(
        mut,
        seeds = [HYBRID_MARKET_SEED, market.creator.as_ref(), &market.market_id.to_le_bytes()],
        bump = market.bump,
        constraint = market.oracle_config == oracle_config.key()
            @ NortiaError::InvalidOracleConfiguration,
        constraint = market.collateral_mint == collateral_mint.key()
            @ NortiaError::InvalidCollateralMint
    )]
    pub market: Box<Account<'info, HybridMarket>>,
    #[account(
        mut,
        seeds = [ORACLE_CONFIG_SEED, market.key().as_ref()],
        bump = oracle_config.bump,
        constraint = oracle_config.market == market.key()
            @ NortiaError::InvalidOracleConfiguration,
        constraint = oracle_config.resolver == OracleResolverV2::OptimisticV1
            @ NortiaError::InvalidOracleConfiguration,
        constraint = !oracle_config.consumed @ NortiaError::ResolutionReplay
    )]
    pub oracle_config: Box<Account<'info, OracleConfig>>,
    #[account(
        init,
        payer = proposer,
        space = OptimisticProposal::SPACE,
        seeds = [OPTIMISTIC_PROPOSAL_SEED, market.key().as_ref()],
        bump
    )]
    pub proposal: Box<Account<'info, OptimisticProposal>>,
    #[account(
        init,
        payer = proposer,
        seeds = [OPTIMISTIC_BOND_VAULT_SEED, market.key().as_ref()],
        bump,
        token::mint = collateral_mint,
        token::authority = market
    )]
    pub bond_vault: Box<Account<'info, TokenAccount>>,
    pub collateral_mint: Box<Account<'info, Mint>>,
    #[account(
        mut,
        constraint = proposer_token.owner == proposer.key()
            @ NortiaError::InvalidTokenAccount,
        constraint = proposer_token.mint == collateral_mint.key()
            @ NortiaError::InvalidTokenAccount
    )]
    pub proposer_token: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ChallengeOptimisticResolution<'info> {
    #[account(mut)]
    pub challenger: Signer<'info>,
    #[account(
        mut,
        seeds = [HYBRID_MARKET_SEED, market.creator.as_ref(), &market.market_id.to_le_bytes()],
        bump = market.bump,
        constraint = market.oracle_config == oracle_config.key()
            @ NortiaError::InvalidOracleConfiguration,
        constraint = market.collateral_mint == collateral_mint.key()
            @ NortiaError::InvalidCollateralMint
    )]
    pub market: Box<Account<'info, HybridMarket>>,
    #[account(
        seeds = [ORACLE_CONFIG_SEED, market.key().as_ref()],
        bump = oracle_config.bump,
        constraint = oracle_config.market == market.key()
            @ NortiaError::InvalidOracleConfiguration,
        constraint = oracle_config.optimistic_proposal == proposal.key()
            @ NortiaError::InvalidAssertion,
        constraint = !oracle_config.consumed @ NortiaError::ResolutionReplay
    )]
    pub oracle_config: Box<Account<'info, OracleConfig>>,
    #[account(
        mut,
        seeds = [OPTIMISTIC_PROPOSAL_SEED, market.key().as_ref()],
        bump = proposal.bump,
        constraint = proposal.market == market.key() @ NortiaError::InvalidAssertion
    )]
    pub proposal: Box<Account<'info, OptimisticProposal>>,
    #[account(
        mut,
        seeds = [OPTIMISTIC_BOND_VAULT_SEED, market.key().as_ref()],
        bump = proposal.bond_vault_bump,
        token::mint = collateral_mint,
        token::authority = market
    )]
    pub bond_vault: Box<Account<'info, TokenAccount>>,
    pub collateral_mint: Box<Account<'info, Mint>>,
    #[account(
        mut,
        constraint = challenger_token.owner == challenger.key()
            @ NortiaError::InvalidTokenAccount,
        constraint = challenger_token.mint == collateral_mint.key()
            @ NortiaError::InvalidTokenAccount
    )]
    pub challenger_token: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct FinalizeOptimisticResolution<'info> {
    #[account(mut)]
    pub keeper: Signer<'info>,
    #[account(
        mut,
        seeds = [HYBRID_MARKET_SEED, market.creator.as_ref(), &market.market_id.to_le_bytes()],
        bump = market.bump,
        constraint = market.oracle_config == oracle_config.key()
            @ NortiaError::InvalidOracleConfiguration,
        constraint = market.collateral_mint == vault.mint
            @ NortiaError::InvalidCollateralMint
    )]
    pub market: Box<Account<'info, HybridMarket>>,
    #[account(
        mut,
        seeds = [ORACLE_CONFIG_SEED, market.key().as_ref()],
        bump = oracle_config.bump,
        constraint = oracle_config.optimistic_proposal == proposal.key()
            @ NortiaError::InvalidAssertion,
        constraint = !oracle_config.consumed @ NortiaError::ResolutionReplay
    )]
    pub oracle_config: Box<Account<'info, OracleConfig>>,
    #[account(
        mut,
        seeds = [OPTIMISTIC_PROPOSAL_SEED, market.key().as_ref()],
        bump = proposal.bump,
        constraint = proposal.market == market.key() @ NortiaError::InvalidAssertion
    )]
    pub proposal: Box<Account<'info, OptimisticProposal>>,
    #[account(
        init,
        payer = keeper,
        space = ResolutionReceipt::SPACE,
        seeds = [RESOLUTION_RECEIPT_SEED, market.key().as_ref()],
        bump
    )]
    pub receipt: Box<Account<'info, ResolutionReceipt>>,
    #[account(
        seeds = [HYBRID_VAULT_SEED, market.key().as_ref()],
        bump = market.vault_bump,
        token::mint = market.collateral_mint,
        token::authority = market
    )]
    pub vault: Box<Account<'info, TokenAccount>>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ArbitrateOptimisticResolution<'info> {
    #[account(mut)]
    pub keeper: Signer<'info>,
    #[account(
        seeds = [PROTOCOL_SEED],
        bump = protocol.bump,
        constraint = protocol.treasury_owner == market.treasury_owner
            @ NortiaError::InvalidTreasury
    )]
    pub protocol: Box<Account<'info, ProtocolConfig>>,
    #[account(
        mut,
        seeds = [HYBRID_MARKET_SEED, market.creator.as_ref(), &market.market_id.to_le_bytes()],
        bump = market.bump,
        constraint = market.oracle_config == oracle_config.key()
            @ NortiaError::InvalidOracleConfiguration,
        constraint = market.collateral_mint == vault.mint
            @ NortiaError::InvalidCollateralMint
    )]
    pub market: Box<Account<'info, HybridMarket>>,
    #[account(
        mut,
        seeds = [ORACLE_CONFIG_SEED, market.key().as_ref()],
        bump = oracle_config.bump,
        constraint = oracle_config.optimistic_proposal == proposal.key()
            @ NortiaError::InvalidAssertion,
        constraint = !oracle_config.consumed @ NortiaError::ResolutionReplay
    )]
    pub oracle_config: Box<Account<'info, OracleConfig>>,
    #[account(
        mut,
        seeds = [OPTIMISTIC_PROPOSAL_SEED, market.key().as_ref()],
        bump = proposal.bump,
        constraint = proposal.market == market.key() @ NortiaError::InvalidAssertion
    )]
    pub proposal: Box<Account<'info, OptimisticProposal>>,
    #[account(
        init,
        payer = keeper,
        space = ResolutionReceipt::SPACE,
        seeds = [RESOLUTION_RECEIPT_SEED, market.key().as_ref()],
        bump
    )]
    pub receipt: Box<Account<'info, ResolutionReceipt>>,
    #[account(
        seeds = [HYBRID_VAULT_SEED, market.key().as_ref()],
        bump = market.vault_bump,
        token::mint = market.collateral_mint,
        token::authority = market
    )]
    pub vault: Box<Account<'info, TokenAccount>>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct TimeoutOptimisticDispute<'info> {
    #[account(mut)]
    pub keeper: Signer<'info>,
    #[account(
        mut,
        seeds = [HYBRID_MARKET_SEED, market.creator.as_ref(), &market.market_id.to_le_bytes()],
        bump = market.bump,
        constraint = market.oracle_config == oracle_config.key()
            @ NortiaError::InvalidOracleConfiguration,
        constraint = market.collateral_mint == vault.mint
            @ NortiaError::InvalidCollateralMint
    )]
    pub market: Box<Account<'info, HybridMarket>>,
    #[account(
        mut,
        seeds = [ORACLE_CONFIG_SEED, market.key().as_ref()],
        bump = oracle_config.bump,
        constraint = oracle_config.optimistic_proposal == proposal.key()
            @ NortiaError::InvalidAssertion,
        constraint = !oracle_config.consumed @ NortiaError::ResolutionReplay
    )]
    pub oracle_config: Box<Account<'info, OracleConfig>>,
    #[account(
        mut,
        seeds = [OPTIMISTIC_PROPOSAL_SEED, market.key().as_ref()],
        bump = proposal.bump,
        constraint = proposal.market == market.key() @ NortiaError::InvalidAssertion
    )]
    pub proposal: Box<Account<'info, OptimisticProposal>>,
    #[account(
        init,
        payer = keeper,
        space = ResolutionReceipt::SPACE,
        seeds = [RESOLUTION_RECEIPT_SEED, market.key().as_ref()],
        bump
    )]
    pub receipt: Box<Account<'info, ResolutionReceipt>>,
    #[account(
        seeds = [HYBRID_VAULT_SEED, market.key().as_ref()],
        bump = market.vault_bump,
        token::mint = market.collateral_mint,
        token::authority = market
    )]
    pub vault: Box<Account<'info, TokenAccount>>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ClaimOptimisticBond<'info> {
    pub claimant: Signer<'info>,
    #[account(
        seeds = [HYBRID_MARKET_SEED, market.creator.as_ref(), &market.market_id.to_le_bytes()],
        bump = market.bump,
        constraint = market.collateral_mint == collateral_mint.key()
            @ NortiaError::InvalidCollateralMint
    )]
    pub market: Box<Account<'info, HybridMarket>>,
    #[account(
        mut,
        seeds = [OPTIMISTIC_PROPOSAL_SEED, market.key().as_ref()],
        bump = proposal.bump,
        constraint = proposal.market == market.key() @ NortiaError::InvalidAssertion
    )]
    pub proposal: Box<Account<'info, OptimisticProposal>>,
    #[account(
        mut,
        seeds = [OPTIMISTIC_BOND_VAULT_SEED, market.key().as_ref()],
        bump = proposal.bond_vault_bump,
        token::mint = collateral_mint,
        token::authority = market
    )]
    pub bond_vault: Box<Account<'info, TokenAccount>>,
    pub collateral_mint: Box<Account<'info, Mint>>,
    #[account(
        mut,
        constraint = destination.owner == claimant.key()
            @ NortiaError::InvalidTokenAccount,
        constraint = destination.mint == collateral_mint.key()
            @ NortiaError::InvalidTokenAccount
    )]
    pub destination: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct ResolveHybridTimeout<'info> {
    #[account(mut)]
    pub keeper: Signer<'info>,
    #[account(
        mut,
        seeds = [HYBRID_MARKET_SEED, market.creator.as_ref(), &market.market_id.to_le_bytes()],
        bump = market.bump,
        constraint = market.oracle_config == oracle_config.key()
            @ NortiaError::InvalidOracleConfiguration,
        constraint = market.collateral_mint == vault.mint
            @ NortiaError::InvalidCollateralMint
    )]
    pub market: Box<Account<'info, HybridMarket>>,
    #[account(
        mut,
        seeds = [ORACLE_CONFIG_SEED, market.key().as_ref()],
        bump = oracle_config.bump,
        constraint = oracle_config.market == market.key()
            @ NortiaError::InvalidOracleConfiguration,
        constraint = !oracle_config.consumed @ NortiaError::ResolutionReplay
    )]
    pub oracle_config: Box<Account<'info, OracleConfig>>,
    #[account(
        init,
        payer = keeper,
        space = ResolutionReceipt::SPACE,
        seeds = [RESOLUTION_RECEIPT_SEED, market.key().as_ref()],
        bump
    )]
    pub receipt: Box<Account<'info, ResolutionReceipt>>,
    #[account(
        seeds = [HYBRID_VAULT_SEED, market.key().as_ref()],
        bump = market.vault_bump,
        token::mint = market.collateral_mint,
        token::authority = market
    )]
    pub vault: Box<Account<'info, TokenAccount>>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SettleHybridPosition<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(
        mut,
        seeds = [HYBRID_MARKET_SEED, market.creator.as_ref(), &market.market_id.to_le_bytes()],
        bump = market.bump,
        constraint = market.collateral_mint == collateral_mint.key()
            @ NortiaError::InvalidCollateralMint,
        constraint = market.token_program == token_program.key()
            @ NortiaError::InvalidTokenAccount
    )]
    pub market: Box<Account<'info, HybridMarket>>,
    #[account(
        mut,
        seeds = [POSITION_SEED, market.key().as_ref(), owner.key().as_ref()],
        bump = position.bump,
        constraint = position.market == market.key() @ NortiaError::InvalidPosition,
        constraint = position.owner == owner.key() @ NortiaError::InvalidPosition
    )]
    pub position: Account<'info, Position>,
    pub collateral_mint: Account<'info, Mint>,
    #[account(
        mut,
        seeds = [HYBRID_VAULT_SEED, market.key().as_ref()],
        bump = market.vault_bump,
        token::mint = collateral_mint,
        token::authority = market
    )]
    pub vault: Account<'info, TokenAccount>,
    #[account(
        mut,
        constraint = owner_token.owner == owner.key()
            @ NortiaError::InvalidTokenAccount,
        constraint = owner_token.mint == collateral_mint.key()
            @ NortiaError::InvalidTokenAccount
    )]
    pub owner_token: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct WithdrawHybridLiquidity<'info> {
    #[account(mut)]
    pub liquidity_owner: Signer<'info>,
    #[account(
        mut,
        seeds = [HYBRID_MARKET_SEED, market.creator.as_ref(), &market.market_id.to_le_bytes()],
        bump = market.bump,
        constraint = market.liquidity_owner == liquidity_owner.key()
            @ NortiaError::InvalidTokenAccount,
        constraint = market.collateral_mint == collateral_mint.key()
            @ NortiaError::InvalidCollateralMint,
        constraint = market.token_program == token_program.key()
            @ NortiaError::InvalidTokenAccount
    )]
    pub market: Box<Account<'info, HybridMarket>>,
    pub collateral_mint: Account<'info, Mint>,
    #[account(
        mut,
        seeds = [HYBRID_VAULT_SEED, market.key().as_ref()],
        bump = market.vault_bump,
        token::mint = collateral_mint,
        token::authority = market
    )]
    pub vault: Account<'info, TokenAccount>,
    #[account(
        mut,
        constraint = liquidity_token.owner == liquidity_owner.key()
            @ NortiaError::InvalidTokenAccount,
        constraint = liquidity_token.mint == collateral_mint.key()
            @ NortiaError::InvalidTokenAccount
    )]
    pub liquidity_token: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

struct FinalizeHybridResolutionArgs {
    receipt_bump: u8,
    source_account: Pubkey,
    observation: oracles::NormalizedObservation,
    evidence_hash: [u8; 32],
    now: i64,
    vault_balance: u64,
    timeout: bool,
}

fn finalize_hybrid_resolution(
    market: &mut HybridMarket,
    oracle: &mut OracleConfig,
    receipt: &mut ResolutionReceipt,
    args: FinalizeHybridResolutionArgs,
) -> Result<()> {
    let FinalizeHybridResolutionArgs {
        receipt_bump,
        source_account,
        observation,
        evidence_hash,
        now,
        vault_balance,
        timeout,
    } = args;
    require!(
        market.phase == HybridPhase::Open
            || market.phase == HybridPhase::Locked
            || market.phase == HybridPhase::Resolving
            || market.phase == HybridPhase::Disputed,
        NortiaError::InvalidPhase
    );
    require!(now >= market.lock_ts, NortiaError::MarketLocked);
    require!(
        now >= market.resolve_not_before_ts,
        NortiaError::MarketNotReadyForResolution
    );
    if timeout {
        require!(now > market.resolution_deadline_ts, NortiaError::TooEarly);
        require!(
            observation.outcome == HybridMarket::OUTCOME_INVALID,
            NortiaError::InvalidOutcome
        );
    } else {
        require!(
            now <= market.resolution_deadline_ts,
            NortiaError::DeadlineElapsed
        );
        require!(
            observation.outcome == HybridMarket::OUTCOME_YES
                || observation.outcome == HybridMarket::OUTCOME_NO,
            NortiaError::InvalidOutcome
        );
    }
    require!(!oracle.consumed, NortiaError::ResolutionReplay);
    require!(evidence_hash != [0; 32], NortiaError::ZeroCommitment);
    let liability =
        hybrid_market_liability(market.yes_quantity, market.no_quantity, observation.outcome)?;
    require!(vault_balance >= liability, NortiaError::InsolventMarket);

    oracle.consumed = true;
    market.phase = HybridPhase::Resolved;
    market.outcome = observation.outcome;
    market.outstanding_liability = liability;
    market.settled_at = now;
    market.settlement_evidence_hash = evidence_hash;

    receipt.bump = receipt_bump;
    receipt.version = ResolutionReceipt::VERSION;
    receipt.market = oracle.market;
    receipt.resolver = oracle.resolver;
    receipt.outcome = observation.outcome;
    receipt.observation_value = observation.value;
    receipt.observation_exponent = observation.exponent;
    receipt.observation_ts = observation.timestamp;
    receipt.observation_slot = observation.slot;
    receipt.confidence = observation.confidence;
    receipt.sample_count = observation.sample_count;
    receipt.source_queue = oracle.source_queue;
    receipt.source_id = oracle.source_id;
    receipt.source_account = source_account;
    receipt.evidence_hash = evidence_hash;
    receipt.finalized_at = now;

    emit!(HybridMarketResolved {
        market: oracle.market,
        outcome: market.outcome,
        resolver: oracle.resolver,
        outstanding_liability: market.outstanding_liability,
        evidence_hash,
        settled_at: now,
    });
    Ok(())
}

fn hybrid_market_liability(yes_quantity: u64, no_quantity: u64, outcome: u8) -> Result<u64> {
    match outcome {
        HybridMarket::OUTCOME_YES => Ok(yes_quantity),
        HybridMarket::OUTCOME_NO => Ok(no_quantity),
        HybridMarket::OUTCOME_INVALID => yes_quantity
            .checked_add(no_quantity)
            .map(|shares| shares / 2)
            .ok_or_else(|| error!(NortiaError::ArithmeticOverflow)),
        _ => err!(NortiaError::InvalidOutcome),
    }
}

struct OptimisticEvidence<'a> {
    outcome: u8,
    hash: &'a [u8; 32],
    uri: &'a str,
}

fn validate_optimistic_proposal(
    market_key: Pubkey,
    market: &HybridMarket,
    oracle: &OracleConfig,
    evidence: OptimisticEvidence,
    now: i64,
) -> Result<i64> {
    require!(
        market.phase == HybridPhase::Open || market.phase == HybridPhase::Locked,
        NortiaError::InvalidPhase
    );
    require!(
        now >= market.lock_ts
            && now >= market.resolve_not_before_ts
            && now >= oracle.observation_ts
            && now <= market.resolution_deadline_ts,
        NortiaError::MarketNotReadyForResolution
    );
    let observation_window_end = oracle
        .observation_ts
        .checked_add(oracle.observation_window_secs as i64)
        .ok_or_else(|| error!(NortiaError::ArithmeticOverflow))?;
    require!(
        now <= observation_window_end,
        NortiaError::InvalidObservationTime
    );
    require!(
        valid_optimistic_evidence_uri(evidence.uri)
            && *evidence.hash
                == optimistic_evidence_hash(
                    b"nortia-optimistic-assertion-v1",
                    market_key,
                    evidence.outcome,
                    evidence.uri,
                )
            && (evidence.outcome == HybridMarket::OUTCOME_YES
                || evidence.outcome == HybridMarket::OUTCOME_NO)
            && oracle.optimistic_proposal == Pubkey::default()
            && !oracle.consumed,
        NortiaError::InvalidAssertion
    );
    let challenge_deadline = now
        .checked_add(oracle.challenge_period_secs as i64)
        .ok_or_else(|| error!(NortiaError::ArithmeticOverflow))?;
    require!(
        challenge_deadline < market.resolution_deadline_ts,
        NortiaError::ChallengeWindowClosed
    );
    Ok(challenge_deadline)
}

fn validate_optimistic_challenge(
    market_key: Pubkey,
    market: &HybridMarket,
    proposal: &OptimisticProposal,
    challenger: Pubkey,
    evidence: OptimisticEvidence,
    now: i64,
) -> Result<()> {
    require!(
        market.phase == HybridPhase::Resolving && !proposal.finalized,
        NortiaError::InvalidPhase
    );
    require!(
        now <= proposal.challenge_deadline,
        NortiaError::ChallengeWindowClosed
    );
    require!(
        proposal.challenger == Pubkey::default()
            && challenger != proposal.proposer
            && evidence.outcome != proposal.proposed_outcome
            && (evidence.outcome == HybridMarket::OUTCOME_YES
                || evidence.outcome == HybridMarket::OUTCOME_NO)
            && valid_optimistic_evidence_uri(evidence.uri)
            && *evidence.hash
                == optimistic_evidence_hash(
                    b"nortia-optimistic-challenge-v1",
                    market_key,
                    evidence.outcome,
                    evidence.uri,
                ),
        NortiaError::InvalidAssertion
    );
    Ok(())
}

fn valid_optimistic_evidence_uri(value: &str) -> bool {
    let prefix_length = if value.starts_with("https://") {
        8
    } else if value.starts_with("ipfs://") || value.starts_with("ar://") {
        value.find("://").map_or(0, |index| index + 3)
    } else {
        0
    };
    prefix_length > 0
        && value.len() <= MAX_OPTIMISTIC_EVIDENCE_URI_BYTES
        && value.trim() == value
        && value.len() > prefix_length
        && value.is_ascii()
        && !value.chars().any(char::is_whitespace)
        && !value.chars().any(char::is_control)
}

fn optimistic_evidence_hash(
    domain: &[u8],
    market: Pubkey,
    outcome: u8,
    evidence_uri: &str,
) -> [u8; 32] {
    hashv(&[domain, market.as_ref(), &[outcome], evidence_uri.as_bytes()]).to_bytes()
}

fn optimistic_finalize_outcome(
    market: &HybridMarket,
    proposal: &OptimisticProposal,
    now: i64,
) -> Result<(u8, bool)> {
    let timed_out = now > market.resolution_deadline_ts;
    require!(
        market.phase == HybridPhase::Resolving
            && !proposal.finalized
            && proposal.challenger == Pubkey::default(),
        NortiaError::InvalidPhase
    );
    if timed_out {
        Ok((HybridMarket::OUTCOME_INVALID, true))
    } else {
        require!(
            now > proposal.challenge_deadline,
            NortiaError::ChallengeWindowClosed
        );
        Ok((proposal.proposed_outcome, false))
    }
}

fn validate_optimistic_arbitration(
    market: &HybridMarket,
    proposal: &OptimisticProposal,
    outcome: u8,
    decision_hash: &[u8; 32],
    now: i64,
) -> Result<()> {
    require!(
        market.phase == HybridPhase::Disputed
            && !proposal.finalized
            && proposal.challenger != Pubkey::default()
            && now <= market.resolution_deadline_ts,
        NortiaError::InvalidPhase
    );
    require!(
        *decision_hash != [0; 32]
            && (outcome == proposal.proposed_outcome || outcome == proposal.challenged_outcome),
        NortiaError::InvalidDisputeDecision
    );
    Ok(())
}

fn optimistic_observation(outcome: u8, now: i64) -> oracles::NormalizedObservation {
    oracles::NormalizedObservation {
        outcome,
        value: outcome as i128,
        exponent: 0,
        timestamp: now,
        slot: 0,
        confidence: 0,
        sample_count: 0,
    }
}

fn optimistic_dispute_payout(bond_amount: u64) -> Result<(u64, u64)> {
    let treasury_fee = (bond_amount as u128)
        .checked_mul(OPTIMISTIC_DISPUTE_FEE_BPS as u128)
        .and_then(|value| value.checked_div(FEE_SPLIT_DENOMINATOR as u128))
        .and_then(|value| u64::try_from(value).ok())
        .ok_or_else(|| error!(NortiaError::ArithmeticOverflow))?;
    let winner_payout = bond_amount
        .checked_mul(2)
        .and_then(|value| value.checked_sub(treasury_fee))
        .ok_or_else(|| error!(NortiaError::ArithmeticOverflow))?;
    Ok((winner_payout, treasury_fee))
}

fn record_optimistic_payouts(
    proposal: &mut OptimisticProposal,
    proposer_payout: u64,
    challenger_payout: u64,
    treasury_payout: u64,
) -> Result<()> {
    require!(
        !proposal.finalized
            && proposal.proposer_payout == 0
            && proposal.challenger_payout == 0
            && proposal.treasury_payout == 0
            && !proposal.proposer_claimed
            && !proposal.challenger_claimed
            && !proposal.treasury_claimed,
        NortiaError::InvalidPhase
    );
    let deposited_bonds = if proposal.challenger == Pubkey::default() {
        proposal.bond_amount
    } else {
        proposal
            .bond_amount
            .checked_mul(2)
            .ok_or_else(|| error!(NortiaError::ArithmeticOverflow))?
    };
    let recorded_payouts = proposer_payout
        .checked_add(challenger_payout)
        .and_then(|amount| amount.checked_add(treasury_payout))
        .ok_or_else(|| error!(NortiaError::ArithmeticOverflow))?;
    require!(
        recorded_payouts == deposited_bonds,
        NortiaError::InvalidDisputeDecision
    );
    proposal.proposer_payout = proposer_payout;
    proposal.challenger_payout = challenger_payout;
    proposal.treasury_payout = treasury_payout;
    Ok(())
}

fn prepare_optimistic_bond_claim(
    proposal: &mut OptimisticProposal,
    treasury_owner: Pubkey,
    claimant: Pubkey,
) -> Result<u64> {
    require!(proposal.finalized, NortiaError::InvalidPhase);
    let claim_proposer =
        claimant == proposal.proposer && proposal.proposer_payout > 0 && !proposal.proposer_claimed;
    let claim_challenger = claimant == proposal.challenger
        && proposal.challenger_payout > 0
        && !proposal.challenger_claimed;
    let claim_treasury =
        claimant == treasury_owner && proposal.treasury_payout > 0 && !proposal.treasury_claimed;
    let mut amount = 0u64;
    if claim_proposer {
        amount = amount
            .checked_add(proposal.proposer_payout)
            .ok_or_else(|| error!(NortiaError::ArithmeticOverflow))?;
    }
    if claim_challenger {
        amount = amount
            .checked_add(proposal.challenger_payout)
            .ok_or_else(|| error!(NortiaError::ArithmeticOverflow))?;
    }
    if claim_treasury {
        amount = amount
            .checked_add(proposal.treasury_payout)
            .ok_or_else(|| error!(NortiaError::ArithmeticOverflow))?;
    }
    require!(amount > 0, NortiaError::NoOptimisticBondPayout);
    proposal.proposer_claimed |= claim_proposer;
    proposal.challenger_claimed |= claim_challenger;
    proposal.treasury_claimed |= claim_treasury;
    Ok(amount)
}

fn validate_oracle_config(
    category: &MarketCategory,
    args: &OracleConfigArgs,
    resolve_not_before_ts: i64,
) -> Result<()> {
    require!(
        args.source_id != [0; 32]
            && args.config_hash != [0; 32]
            && args.observation_ts >= resolve_not_before_ts
            && args.observation_window_secs > 0,
        NortiaError::InvalidOracleConfiguration
    );
    match args.resolver {
        OracleResolverV2::TxlineStatV2 => require!(
            *category == MarketCategory::Sports
                && args.source_program == TXLINE_PROGRAM_ID
                && args.source_queue == Pubkey::default()
                && args.threshold_exponent == 0
                && i32::try_from(args.threshold).is_ok()
                && args.max_staleness_secs > 0
                && args.max_staleness_slots == 0
                && args.bond_amount == 0
                && txline::fixture_id_from_source_id(&args.source_id).is_ok(),
            NortiaError::InvalidOracleConfiguration
        ),
        OracleResolverV2::PythPriceV2 => require!(
            args.source_program == PYTH_RECEIVER_PROGRAM_ID
                && args.source_queue == Pubkey::default()
                && (-18..=18).contains(&args.threshold_exponent)
                && args.max_staleness_secs > 0
                && args.max_staleness_slots == 0
                && args.max_confidence_bps > 0
                && args.max_confidence_bps <= FEE_SPLIT_DENOMINATOR
                && args.bond_amount == 0,
            NortiaError::InvalidOracleConfiguration
        ),
        OracleResolverV2::SwitchboardQuoteV1 => require!(
            *category != MarketCategory::Sports
                && *category != MarketCategory::Crypto
                && args.source_program == SWITCHBOARD_QUOTE_PROGRAM_ID
                && args.source_queue == SWITCHBOARD_DEVNET_QUEUE
                && (-18..=18).contains(&args.threshold_exponent)
                && args.max_staleness_secs == 0
                && args.max_staleness_slots > 0
                && args.max_confidence_bps == 0
                && (2..=8).contains(&args.min_samples)
                && args.bond_amount == 0,
            NortiaError::InvalidOracleConfiguration
        ),
        OracleResolverV2::OptimisticV1 => require!(
            *category != MarketCategory::Sports
                && *category != MarketCategory::Crypto
                && args.source_program == crate::ID
                && args.source_queue == Pubkey::default()
                && args.threshold == 0
                && args.threshold_exponent == 0
                && args.max_staleness_secs == 0
                && args.max_staleness_slots == 0
                && args.max_confidence_bps == 0
                && args.min_samples == 0
                && args.challenge_period_secs >= 3_600
                && args.bond_amount >= MIN_OPTIMISTIC_BOND,
            NortiaError::InvalidOracleConfiguration
        ),
        OracleResolverV2::UmaWormholeV1 | OracleResolverV2::ChainlinkReportV1 => {
            return err!(NortiaError::ResolverNotEnabled)
        }
    }
    Ok(())
}

fn validate_hybrid_metadata(market: &HybridMarket, args: &PublishHybridMetadataArgs) -> Result<()> {
    let valid_text = |value: &str, maximum: usize, allow_newlines: bool| {
        !value.is_empty()
            && value.len() <= maximum
            && value.trim() == value
            && value
                .chars()
                .all(|character| !character.is_control() || (allow_newlines && character == '\n'))
    };
    let reference_valid = args.reference_url.is_empty()
        || (args.reference_url.len() <= MAX_REFERENCE_URL_BYTES
            && args.reference_url.trim() == args.reference_url
            && !args.reference_url.chars().any(char::is_control)
            && (args.reference_url.starts_with("https://")
                || args.reference_url.starts_with("ipfs://")
                || args.reference_url.starts_with("ar://")));
    let mut outcome_labels = Vec::with_capacity(
        args.yes_label
            .len()
            .saturating_add(args.no_label.len())
            .saturating_add(1),
    );
    outcome_labels.extend_from_slice(args.yes_label.as_bytes());
    outcome_labels.push(b'\n');
    outcome_labels.extend_from_slice(args.no_label.as_bytes());
    require!(
        valid_text(&args.question, MAX_QUESTION_BYTES, false)
            && valid_text(&args.rules, MAX_RULES_BYTES, true)
            && valid_text(&args.yes_label, MAX_OUTCOME_LABEL_BYTES, false)
            && valid_text(&args.no_label, MAX_OUTCOME_LABEL_BYTES, false)
            && args.yes_label != args.no_label
            && reference_valid
            && hashv(&[args.question.as_bytes()]).to_bytes() == market.question_hash
            && hashv(&[args.rules.as_bytes()]).to_bytes() == market.rules_hash
            && hashv(&[outcome_labels.as_slice()]).to_bytes() == market.outcome_labels_hash,
        NortiaError::InvalidMarketMetadata
    );
    Ok(())
}

fn validate_hybrid_trade(market: &HybridMarket, args: &TradeSharesArgs, now: i64) -> Result<()> {
    require!(market.phase == HybridPhase::Open, NortiaError::InvalidPhase);
    require!(now < market.lock_ts, NortiaError::MarketLocked);
    require!(now <= args.deadline_ts, NortiaError::TradeDeadlineElapsed);
    require!(
        args.shares >= lmsr::MIN_TRADE_SHARES && args.shares <= market.max_trade_shares,
        NortiaError::InvalidLmsrState
    );
    Ok(())
}

fn lmsr_side(side: u8) -> Result<lmsr::OutcomeSide> {
    match side {
        0 => Ok(lmsr::OutcomeSide::No),
        1 => Ok(lmsr::OutcomeSide::Yes),
        _ => err!(NortiaError::InvalidOutcome),
    }
}

fn side_value(side: lmsr::OutcomeSide) -> u8 {
    match side {
        lmsr::OutcomeSide::No => 0,
        lmsr::OutcomeSide::Yes => 1,
    }
}

fn lmsr_quantities(market: &HybridMarket) -> lmsr::MarketQuantities {
    lmsr::MarketQuantities {
        yes: market.yes_quantity,
        no: market.no_quantity,
    }
}

fn validate_resolver_security_cap(
    security_cap: u64,
    quantities: lmsr::MarketQuantities,
) -> Result<()> {
    require!(
        max(quantities.yes, quantities.no) <= security_cap,
        NortiaError::ResolverSecurityCapExceeded
    );
    Ok(())
}

fn position_shares(position: &Position, side: lmsr::OutcomeSide) -> u64 {
    match side {
        lmsr::OutcomeSide::Yes => position.yes_shares,
        lmsr::OutcomeSide::No => position.no_shares,
    }
}

fn split_hybrid_fee(fee: u64, treasury_share_bps: u16) -> Result<(u64, u64)> {
    require!(
        treasury_share_bps < FEE_SPLIT_DENOMINATOR,
        NortiaError::InvalidProtocolFee
    );
    let treasury = (fee as u128)
        .checked_mul(treasury_share_bps as u128)
        .and_then(|value| value.checked_div(FEE_SPLIT_DENOMINATOR as u128))
        .ok_or_else(|| error!(NortiaError::ArithmeticOverflow))?;
    let treasury = u64::try_from(treasury).map_err(|_| error!(NortiaError::ArithmeticOverflow))?;
    let liquidity = fee
        .checked_sub(treasury)
        .ok_or_else(|| error!(NortiaError::ArithmeticOverflow))?;
    Ok((treasury, liquidity))
}

fn apply_position_buy(
    position: &mut Position,
    side: lmsr::OutcomeSide,
    quote: &lmsr::TradeQuote,
) -> Result<()> {
    match side {
        lmsr::OutcomeSide::Yes => {
            position.yes_shares = position
                .yes_shares
                .checked_add(quote.shares)
                .ok_or_else(|| error!(NortiaError::ArithmeticOverflow))?;
        }
        lmsr::OutcomeSide::No => {
            position.no_shares = position
                .no_shares
                .checked_add(quote.shares)
                .ok_or_else(|| error!(NortiaError::ArithmeticOverflow))?;
        }
    }
    position.total_spent = position
        .total_spent
        .checked_add(quote.total_amount)
        .ok_or_else(|| error!(NortiaError::ArithmeticOverflow))?;
    Ok(())
}

fn apply_position_sell(
    position: &mut Position,
    side: lmsr::OutcomeSide,
    quote: &lmsr::TradeQuote,
) -> Result<()> {
    match side {
        lmsr::OutcomeSide::Yes => {
            position.yes_shares = position
                .yes_shares
                .checked_sub(quote.shares)
                .ok_or_else(|| error!(NortiaError::InsufficientPosition))?;
        }
        lmsr::OutcomeSide::No => {
            position.no_shares = position
                .no_shares
                .checked_sub(quote.shares)
                .ok_or_else(|| error!(NortiaError::InsufficientPosition))?;
        }
    }
    position.total_proceeds = position
        .total_proceeds
        .checked_add(quote.total_amount)
        .ok_or_else(|| error!(NortiaError::ArithmeticOverflow))?;
    Ok(())
}

fn apply_market_trade(
    market: &mut HybridMarket,
    quote: &lmsr::TradeQuote,
    treasury_fee: u64,
    liquidity_fee: u64,
) -> Result<()> {
    market.yes_quantity = quote.after.yes;
    market.no_quantity = quote.after.no;
    market.trade_count = market
        .trade_count
        .checked_add(1)
        .ok_or_else(|| error!(NortiaError::ArithmeticOverflow))?;
    market.volume = market
        .volume
        .checked_add(quote.raw_amount)
        .ok_or_else(|| error!(NortiaError::ArithmeticOverflow))?;
    market.treasury_fees = market
        .treasury_fees
        .checked_add(treasury_fee)
        .ok_or_else(|| error!(NortiaError::ArithmeticOverflow))?;
    market.liquidity_fees = market
        .liquidity_fees
        .checked_add(liquidity_fee)
        .ok_or_else(|| error!(NortiaError::ArithmeticOverflow))?;
    Ok(())
}

fn emit_hybrid_trade(
    market: &HybridMarket,
    position_key: Pubkey,
    position: &Position,
    quote: &lmsr::TradeQuote,
) {
    emit!(HybridTradeExecuted {
        market: position.market,
        position: position_key,
        owner: position.owner,
        direction: match quote.direction {
            lmsr::TradeDirection::Buy => 0,
            lmsr::TradeDirection::Sell => 1,
        },
        side: side_value(quote.side),
        shares: quote.shares,
        raw_amount: quote.raw_amount,
        fee_amount: quote.fee_amount,
        total_amount: quote.total_amount,
        before_yes_probability: quote.before_yes_probability,
        after_yes_probability: quote.after_yes_probability,
        yes_quantity: market.yes_quantity,
        no_quantity: market.no_quantity,
    });
}

fn hybrid_position_payout(position: &Position, outcome: u8) -> Result<u64> {
    match outcome {
        HybridMarket::OUTCOME_YES => Ok(position.yes_shares),
        HybridMarket::OUTCOME_NO => Ok(position.no_shares),
        HybridMarket::OUTCOME_INVALID => position
            .yes_shares
            .checked_add(position.no_shares)
            .map(|shares| shares / 2)
            .ok_or_else(|| error!(NortiaError::ArithmeticOverflow)),
        _ => err!(NortiaError::InvalidOutcome),
    }
}

fn close_hybrid_market_if_drained(market: &mut HybridMarket, projected_vault: u64) -> Result<bool> {
    require!(
        market.phase == HybridPhase::Resolved && projected_vault >= market.outstanding_liability,
        NortiaError::InsolventMarket
    );
    if market.outstanding_liability == 0 && projected_vault == 0 {
        market.phase = HybridPhase::Closed;
        Ok(true)
    } else {
        Ok(false)
    }
}

fn transfer_to_vault<'info>(
    owner: &Signer<'info>,
    source: &Account<'info, TokenAccount>,
    vault: &Account<'info, TokenAccount>,
    collateral_mint: &Account<'info, Mint>,
    token_program: &Program<'info, Token>,
    amount: u64,
) -> Result<()> {
    transfer_from_owner(owner, source, vault, collateral_mint, token_program, amount)
}

fn transfer_from_owner<'info>(
    owner: &Signer<'info>,
    source: &Account<'info, TokenAccount>,
    destination: &Account<'info, TokenAccount>,
    collateral_mint: &Account<'info, Mint>,
    token_program: &Program<'info, Token>,
    amount: u64,
) -> Result<()> {
    if amount == 0 {
        return Ok(());
    }
    let transfer_accounts = TransferChecked {
        from: source.to_account_info(),
        mint: collateral_mint.to_account_info(),
        to: destination.to_account_info(),
        authority: owner.to_account_info(),
    };
    token::transfer_checked(
        CpiContext::new(token_program.key(), transfer_accounts),
        amount,
        collateral_mint.decimals,
    )
}

fn transfer_from_hybrid_vault<'info>(
    market: &Account<'info, HybridMarket>,
    vault: &Account<'info, TokenAccount>,
    destination: &Account<'info, TokenAccount>,
    collateral_mint: &Account<'info, Mint>,
    token_program: &Program<'info, Token>,
    amount: u64,
) -> Result<()> {
    if amount == 0 {
        return Ok(());
    }
    require!(
        vault.amount >= amount,
        NortiaError::InsufficientVaultBalance
    );
    let market_id_bytes = market.market_id.to_le_bytes();
    let bump = [market.bump];
    let signer_seeds: &[&[u8]] = &[
        HYBRID_MARKET_SEED,
        market.creator.as_ref(),
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

    fn resolution_market() -> HybridMarket {
        HybridMarket {
            bump: 1,
            vault_bump: 2,
            version: HybridMarket::VERSION,
            market_id: 9,
            creator: Pubkey::new_unique(),
            liquidity_owner: Pubkey::new_unique(),
            category: MarketCategory::Crypto,
            trading_mode: HybridTradingMode::Continuous,
            pricing_model: HybridPricingModel::Lmsr,
            question_hash: [1; 32],
            rules_hash: [2; 32],
            outcome_labels_hash: [3; 32],
            collateral_mint: DEVNET_USDC_MINT,
            token_program: anchor_spl::token::ID,
            treasury_owner: Pubkey::new_unique(),
            oracle_config: Pubkey::new_unique(),
            liquidity_parameter: 10_000_000,
            initial_subsidy: 6_931_474,
            rounding_reserve: 2,
            max_trade_shares: 10_000_000,
            resolver_security_cap: u64::MAX,
            yes_quantity: 8_000_000,
            no_quantity: 4_000_000,
            trade_fee_bps: 100,
            treasury_fee_share_bps: 7_000,
            open_ts: 1_000,
            lock_ts: 1_900,
            resolve_not_before_ts: 2_000,
            resolution_deadline_ts: 2_200,
            phase: HybridPhase::Locked,
            outcome: HybridMarket::OUTCOME_UNSET,
            trade_count: 2,
            volume: 5_000_000,
            treasury_fees: 35_000,
            liquidity_fees: 15_000,
            outstanding_liability: 0,
            redeemed_liability: 0,
            settled_at: 0,
            settlement_evidence_hash: [0; 32],
        }
    }

    fn resolution_oracle(market: Pubkey) -> OracleConfig {
        OracleConfig {
            bump: 3,
            version: OracleConfig::VERSION,
            market,
            resolver: OracleResolverV2::PythPriceV2,
            source_program: PYTH_RECEIVER_PROGRAM_ID,
            source_queue: Pubkey::default(),
            source_id: [7; 32],
            comparator: ValueComparator::GreaterThanOrEqual,
            threshold: 100_000,
            threshold_exponent: -3,
            observation_ts: 2_000,
            observation_window_secs: 30,
            max_staleness_secs: 5,
            max_staleness_slots: 0,
            max_confidence_bps: 100,
            min_samples: 1,
            challenge_period_secs: 0,
            bond_amount: 0,
            config_hash: [8; 32],
            optimistic_proposal: Pubkey::default(),
            consumed: false,
        }
    }

    fn empty_receipt() -> ResolutionReceipt {
        ResolutionReceipt {
            bump: 0,
            version: 0,
            market: Pubkey::default(),
            resolver: OracleResolverV2::PythPriceV2,
            outcome: HybridMarket::OUTCOME_UNSET,
            observation_value: 0,
            observation_exponent: 0,
            observation_ts: 0,
            observation_slot: 0,
            confidence: 0,
            sample_count: 0,
            source_queue: Pubkey::default(),
            source_id: [0; 32],
            source_account: Pubkey::default(),
            evidence_hash: [0; 32],
            finalized_at: 0,
        }
    }

    fn resolution_args(
        outcome: u8,
        now: i64,
        vault_balance: u64,
        timeout: bool,
    ) -> FinalizeHybridResolutionArgs {
        FinalizeHybridResolutionArgs {
            receipt_bump: 4,
            source_account: Pubkey::new_unique(),
            observation: oracles::NormalizedObservation {
                outcome,
                value: 100_000_000,
                exponent: -6,
                timestamp: 2_001,
                slot: 100,
                confidence: 500_000,
                sample_count: 0,
            },
            evidence_hash: [9; 32],
            now,
            vault_balance,
            timeout,
        }
    }

    fn optimistic_oracle_args() -> OracleConfigArgs {
        OracleConfigArgs {
            resolver: OracleResolverV2::OptimisticV1,
            source_program: crate::ID,
            source_queue: Pubkey::default(),
            source_id: [7; 32],
            comparator: ValueComparator::Equal,
            threshold: 0,
            threshold_exponent: 0,
            observation_ts: 2_000,
            observation_window_secs: 7_200,
            max_staleness_secs: 0,
            max_staleness_slots: 0,
            max_confidence_bps: 0,
            min_samples: 0,
            challenge_period_secs: 3_600,
            bond_amount: MIN_OPTIMISTIC_BOND,
            config_hash: [8; 32],
        }
    }

    fn optimistic_proposal() -> OptimisticProposal {
        OptimisticProposal {
            bump: 1,
            bond_vault_bump: 2,
            version: OptimisticProposal::VERSION,
            market: Pubkey::new_unique(),
            proposer: Pubkey::new_unique(),
            proposer_token: Pubkey::new_unique(),
            proposed_outcome: HybridMarket::OUTCOME_YES,
            assertion_hash: [3; 32],
            assertion_evidence_uri: "https://example.com/assertion".to_string(),
            proposed_at: 2_010,
            challenge_deadline: 2_110,
            challenger: Pubkey::default(),
            challenger_token: Pubkey::default(),
            challenged_outcome: HybridMarket::OUTCOME_UNSET,
            challenge_hash: [0; 32],
            challenge_evidence_uri: String::new(),
            challenged_at: 0,
            bond_amount: MIN_OPTIMISTIC_BOND,
            proposer_payout: 0,
            challenger_payout: 0,
            treasury_payout: 0,
            proposer_claimed: false,
            challenger_claimed: false,
            treasury_claimed: false,
            finalized: false,
            winner: Pubkey::default(),
            decision_hash: [0; 32],
        }
    }

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
        assert_eq!(PYTH_RECEIVER_PROGRAM_ID, pyth_solana_receiver_sdk::ID);
        assert_eq!(
            SWITCHBOARD_DEVNET_QUEUE.to_string(),
            "EYiAmGSdsQTuCw413V5BzaruWuCCSDgTPtBGvLkXHbe7"
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

    #[test]
    fn hybrid_fee_split_assigns_rounding_to_liquidity() {
        assert_eq!(split_hybrid_fee(100, 7_000).unwrap(), (70, 30));
        assert_eq!(split_hybrid_fee(1, 7_000).unwrap(), (0, 1));
        assert!(split_hybrid_fee(100, 10_000).is_err());
    }

    #[test]
    fn hybrid_position_payout_covers_binary_and_invalid_results() {
        let position = Position {
            bump: 1,
            version: Position::VERSION,
            market: Pubkey::new_unique(),
            owner: Pubkey::new_unique(),
            yes_shares: 5_000_000,
            no_shares: 3_000_000,
            total_spent: 4_000_000,
            total_proceeds: 0,
            settled_amount: 0,
            settled: false,
        };
        assert_eq!(
            hybrid_position_payout(&position, HybridMarket::OUTCOME_YES).unwrap(),
            5_000_000
        );
        assert_eq!(
            hybrid_position_payout(&position, HybridMarket::OUTCOME_NO).unwrap(),
            3_000_000
        );
        assert_eq!(
            hybrid_position_payout(&position, HybridMarket::OUTCOME_INVALID).unwrap(),
            4_000_000
        );
        assert!(hybrid_position_payout(&position, HybridMarket::OUTCOME_UNSET).is_err());
    }

    #[test]
    fn hybrid_market_closes_only_after_liability_and_vault_are_drained() {
        let mut market = resolution_market();
        market.phase = HybridPhase::Resolved;
        market.outstanding_liability = 5_000_000;
        assert!(!close_hybrid_market_if_drained(&mut market, 5_000_000).unwrap());
        assert_eq!(market.phase, HybridPhase::Resolved);

        market.outstanding_liability = 0;
        assert!(!close_hybrid_market_if_drained(&mut market, 1).unwrap());
        assert!(close_hybrid_market_if_drained(&mut market, 0).unwrap());
        assert_eq!(market.phase, HybridPhase::Closed);
    }

    #[test]
    fn hybrid_resolution_finalizes_binary_liability_and_receipt() {
        let mut market = resolution_market();
        let market_key = Pubkey::new_unique();
        let mut oracle = resolution_oracle(market_key);
        let mut receipt = empty_receipt();

        finalize_hybrid_resolution(
            &mut market,
            &mut oracle,
            &mut receipt,
            resolution_args(HybridMarket::OUTCOME_YES, 2_050, 8_000_000, false),
        )
        .unwrap();

        assert_eq!(market.phase, HybridPhase::Resolved);
        assert_eq!(market.outcome, HybridMarket::OUTCOME_YES);
        assert_eq!(market.outstanding_liability, 8_000_000);
        assert_eq!(market.settlement_evidence_hash, [9; 32]);
        assert!(oracle.consumed);
        assert_eq!(receipt.market, market_key);
        assert_eq!(receipt.outcome, HybridMarket::OUTCOME_YES);
        assert_eq!(receipt.source_id, [7; 32]);
    }

    #[test]
    fn hybrid_resolution_rejects_replay_and_insolvency() {
        let mut market = resolution_market();
        let mut oracle = resolution_oracle(Pubkey::new_unique());
        let mut receipt = empty_receipt();
        oracle.consumed = true;
        assert!(finalize_hybrid_resolution(
            &mut market,
            &mut oracle,
            &mut receipt,
            resolution_args(HybridMarket::OUTCOME_YES, 2_050, 8_000_000, false),
        )
        .is_err());

        oracle.consumed = false;
        assert!(finalize_hybrid_resolution(
            &mut market,
            &mut oracle,
            &mut receipt,
            resolution_args(HybridMarket::OUTCOME_YES, 2_050, 7_999_999, false),
        )
        .is_err());
    }

    #[test]
    fn hybrid_timeout_only_opens_after_deadline_and_refunds_half() {
        let mut market = resolution_market();
        let mut oracle = resolution_oracle(Pubkey::new_unique());
        let mut receipt = empty_receipt();
        assert!(finalize_hybrid_resolution(
            &mut market,
            &mut oracle,
            &mut receipt,
            resolution_args(HybridMarket::OUTCOME_INVALID, 2_200, 6_000_000, true),
        )
        .is_err());

        finalize_hybrid_resolution(
            &mut market,
            &mut oracle,
            &mut receipt,
            resolution_args(HybridMarket::OUTCOME_INVALID, 2_201, 6_000_000, true),
        )
        .unwrap();
        assert_eq!(market.outcome, HybridMarket::OUTCOME_INVALID);
        assert_eq!(market.outstanding_liability, 6_000_000);
    }

    #[test]
    fn hybrid_normal_resolution_rejects_late_and_premature_calls() {
        let mut market = resolution_market();
        let mut oracle = resolution_oracle(Pubkey::new_unique());
        let mut receipt = empty_receipt();
        assert!(finalize_hybrid_resolution(
            &mut market,
            &mut oracle,
            &mut receipt,
            resolution_args(HybridMarket::OUTCOME_YES, 1_999, 8_000_000, false),
        )
        .is_err());
        assert!(finalize_hybrid_resolution(
            &mut market,
            &mut oracle,
            &mut receipt,
            resolution_args(HybridMarket::OUTCOME_YES, 2_201, 8_000_000, false),
        )
        .is_err());
    }

    #[test]
    fn oracle_templates_reject_disabled_and_mismatched_resolvers() {
        let mut oracle = OracleConfigArgs {
            resolver: OracleResolverV2::PythPriceV2,
            source_program: PYTH_RECEIVER_PROGRAM_ID,
            source_queue: Pubkey::default(),
            source_id: [1; 32],
            comparator: ValueComparator::GreaterThan,
            threshold: 100_000,
            threshold_exponent: -2,
            observation_ts: 2_000,
            observation_window_secs: 60,
            max_staleness_secs: 60,
            max_staleness_slots: 0,
            max_confidence_bps: 100,
            min_samples: 1,
            challenge_period_secs: 0,
            bond_amount: 0,
            config_hash: [2; 32],
        };
        assert!(validate_oracle_config(&MarketCategory::Crypto, &oracle, 2_000).is_ok());
        oracle.threshold_exponent = -19;
        assert!(validate_oracle_config(&MarketCategory::Crypto, &oracle, 2_000).is_err());
        oracle.threshold_exponent = -2;
        oracle.source_program = Pubkey::new_unique();
        assert!(validate_oracle_config(&MarketCategory::Crypto, &oracle, 2_000).is_err());
        oracle.source_program = PYTH_RECEIVER_PROGRAM_ID;
        oracle.resolver = OracleResolverV2::UmaWormholeV1;
        assert!(validate_oracle_config(&MarketCategory::Politics, &oracle, 2_000).is_err());
    }

    #[test]
    fn txline_template_requires_sports_fixture_and_integer_threshold() {
        let mut oracle = OracleConfigArgs {
            resolver: OracleResolverV2::TxlineStatV2,
            source_program: TXLINE_PROGRAM_ID,
            source_queue: Pubkey::default(),
            source_id: txline::txline_source_id(42).unwrap(),
            comparator: ValueComparator::GreaterThan,
            threshold: 2,
            threshold_exponent: 0,
            observation_ts: 2_000,
            observation_window_secs: 60,
            max_staleness_secs: 30,
            max_staleness_slots: 0,
            max_confidence_bps: 0,
            min_samples: 1,
            challenge_period_secs: 0,
            bond_amount: 0,
            config_hash: [2; 32],
        };
        assert!(validate_oracle_config(&MarketCategory::Sports, &oracle, 2_000).is_ok());
        assert!(validate_oracle_config(&MarketCategory::Crypto, &oracle, 2_000).is_err());
        oracle.threshold_exponent = -1;
        assert!(validate_oracle_config(&MarketCategory::Sports, &oracle, 2_000).is_err());
        oracle.threshold_exponent = 0;
        oracle.source_id[8] = 1;
        assert!(validate_oracle_config(&MarketCategory::Sports, &oracle, 2_000).is_err());
    }

    #[test]
    fn switchboard_template_requires_queue_slots_and_multiple_samples() {
        let mut oracle = OracleConfigArgs {
            resolver: OracleResolverV2::SwitchboardQuoteV1,
            source_program: SWITCHBOARD_QUOTE_PROGRAM_ID,
            source_queue: SWITCHBOARD_DEVNET_QUEUE,
            source_id: [7; 32],
            comparator: ValueComparator::GreaterThanOrEqual,
            threshold: 100_000_000_000_000_000_000,
            threshold_exponent: -18,
            observation_ts: 2_000,
            observation_window_secs: 60,
            max_staleness_secs: 0,
            max_staleness_slots: 20,
            max_confidence_bps: 0,
            min_samples: 2,
            challenge_period_secs: 0,
            bond_amount: 0,
            config_hash: [2; 32],
        };
        assert!(validate_oracle_config(&MarketCategory::Other, &oracle, 2_000).is_ok());
        assert!(validate_oracle_config(&MarketCategory::Crypto, &oracle, 2_000).is_err());
        oracle.min_samples = 1;
        assert!(validate_oracle_config(&MarketCategory::Other, &oracle, 2_000).is_err());
        oracle.min_samples = 2;
        oracle.source_queue = Pubkey::default();
        assert!(validate_oracle_config(&MarketCategory::Other, &oracle, 2_000).is_err());
        oracle.source_queue = SWITCHBOARD_DEVNET_QUEUE;
        oracle.max_staleness_slots = 0;
        assert!(validate_oracle_config(&MarketCategory::Other, &oracle, 2_000).is_err());
    }

    #[test]
    fn optimistic_template_is_bonded_and_restricted_to_long_tail_categories() {
        let mut oracle = optimistic_oracle_args();
        for category in [
            MarketCategory::Politics,
            MarketCategory::Technology,
            MarketCategory::Culture,
            MarketCategory::Other,
        ] {
            assert!(validate_oracle_config(&category, &oracle, 2_000).is_ok());
        }
        assert!(validate_oracle_config(&MarketCategory::Sports, &oracle, 2_000).is_err());
        assert!(validate_oracle_config(&MarketCategory::Crypto, &oracle, 2_000).is_err());

        oracle.bond_amount = MIN_OPTIMISTIC_BOND - 1;
        assert!(validate_oracle_config(&MarketCategory::Politics, &oracle, 2_000).is_err());
        oracle.bond_amount = MIN_OPTIMISTIC_BOND;
        oracle.challenge_period_secs = 3_599;
        assert!(validate_oracle_config(&MarketCategory::Politics, &oracle, 2_000).is_err());
        oracle.challenge_period_secs = 3_600;
        oracle.min_samples = 1;
        assert!(validate_oracle_config(&MarketCategory::Politics, &oracle, 2_000).is_err());
        oracle.min_samples = 0;
        oracle.max_staleness_secs = 1;
        assert!(validate_oracle_config(&MarketCategory::Politics, &oracle, 2_000).is_err());
    }

    #[test]
    fn optimistic_dispute_fee_is_charged_only_to_the_losing_bond() {
        assert_eq!(
            optimistic_dispute_payout(MIN_OPTIMISTIC_BOND).unwrap(),
            (19_500_000, 500_000)
        );
        assert!(optimistic_dispute_payout(u64::MAX).is_err());
    }

    #[test]
    fn optimistic_security_cap_bounds_each_binary_liability() {
        let at_cap = lmsr::MarketQuantities {
            yes: MIN_OPTIMISTIC_BOND,
            no: MIN_OPTIMISTIC_BOND - 1,
        };
        assert!(validate_resolver_security_cap(MIN_OPTIMISTIC_BOND, at_cap).is_ok());
        let over_cap = lmsr::MarketQuantities {
            yes: MIN_OPTIMISTIC_BOND + 1,
            no: 0,
        };
        assert!(validate_resolver_security_cap(MIN_OPTIMISTIC_BOND, over_cap).is_err());
    }

    #[test]
    fn optimistic_evidence_matches_the_client_hash_vector() {
        let hash = optimistic_evidence_hash(
            b"nortia-optimistic-assertion-v1",
            Pubkey::default(),
            HybridMarket::OUTCOME_YES,
            "https://example.com/final-result",
        );
        assert_eq!(
            hash,
            [
                0x07, 0xf9, 0xae, 0xd9, 0x2b, 0x70, 0x67, 0x66, 0x80, 0xb5, 0x3e, 0x40, 0x26, 0x34,
                0x15, 0xa1, 0x9b, 0xdc, 0x2f, 0x64, 0x04, 0xb3, 0xf1, 0xb3, 0x87, 0x8e, 0x0c, 0xe9,
                0x1f, 0x2e, 0x41, 0xef,
            ]
        );
        assert!(!valid_optimistic_evidence_uri(
            " https://example.com/result"
        ));
        assert!(!valid_optimistic_evidence_uri("javascript:alert(1)"));
        assert!(!valid_optimistic_evidence_uri(
            "https://example.com/résultat"
        ));
        assert!(!valid_optimistic_evidence_uri(&format!(
            "https://example.com/{}",
            "x".repeat(MAX_OPTIMISTIC_EVIDENCE_URI_BYTES)
        )));
    }

    #[test]
    fn optimistic_lifecycle_enforces_windows_and_opposing_assertions() {
        let mut market = resolution_market();
        market.category = MarketCategory::Politics;
        market.phase = HybridPhase::Locked;
        market.lock_ts = 1_900;
        market.resolve_not_before_ts = 2_000;
        market.resolution_deadline_ts = 6_000;
        let mut oracle = resolution_oracle(Pubkey::new_unique());
        oracle.resolver = OracleResolverV2::OptimisticV1;
        oracle.observation_ts = 2_000;
        oracle.observation_window_secs = 3_000;
        oracle.challenge_period_secs = 3_600;
        oracle.bond_amount = MIN_OPTIMISTIC_BOND;
        let market_key = Pubkey::new_unique();
        let assertion_uri = "https://example.com/final-result";
        let assertion_hash = optimistic_evidence_hash(
            b"nortia-optimistic-assertion-v1",
            market_key,
            HybridMarket::OUTCOME_YES,
            assertion_uri,
        );

        assert_eq!(
            validate_optimistic_proposal(
                market_key,
                &market,
                &oracle,
                OptimisticEvidence {
                    outcome: HybridMarket::OUTCOME_YES,
                    hash: &assertion_hash,
                    uri: assertion_uri,
                },
                2_010,
            )
            .unwrap(),
            5_610
        );
        let invalid_hash = optimistic_evidence_hash(
            b"nortia-optimistic-assertion-v1",
            market_key,
            HybridMarket::OUTCOME_INVALID,
            assertion_uri,
        );
        assert!(validate_optimistic_proposal(
            market_key,
            &market,
            &oracle,
            OptimisticEvidence {
                outcome: HybridMarket::OUTCOME_INVALID,
                hash: &invalid_hash,
                uri: assertion_uri,
            },
            2_010,
        )
        .is_err());
        assert!(validate_optimistic_proposal(
            market_key,
            &market,
            &oracle,
            OptimisticEvidence {
                outcome: HybridMarket::OUTCOME_YES,
                hash: &assertion_hash,
                uri: assertion_uri,
            },
            2_401,
        )
        .is_err());

        let mut proposal = optimistic_proposal();
        proposal.market = market_key;
        market.phase = HybridPhase::Resolving;
        let challenge_uri = "ipfs://bafy-opposing-evidence";
        let challenge_hash = optimistic_evidence_hash(
            b"nortia-optimistic-challenge-v1",
            market_key,
            HybridMarket::OUTCOME_NO,
            challenge_uri,
        );
        assert!(validate_optimistic_challenge(
            market_key,
            &market,
            &proposal,
            Pubkey::new_unique(),
            OptimisticEvidence {
                outcome: HybridMarket::OUTCOME_NO,
                hash: &challenge_hash,
                uri: challenge_uri,
            },
            2_110,
        )
        .is_ok());
        let same_outcome_hash = optimistic_evidence_hash(
            b"nortia-optimistic-challenge-v1",
            market_key,
            HybridMarket::OUTCOME_YES,
            challenge_uri,
        );
        assert!(validate_optimistic_challenge(
            market_key,
            &market,
            &proposal,
            Pubkey::new_unique(),
            OptimisticEvidence {
                outcome: HybridMarket::OUTCOME_YES,
                hash: &same_outcome_hash,
                uri: challenge_uri,
            },
            2_110,
        )
        .is_err());
        assert!(validate_optimistic_challenge(
            market_key,
            &market,
            &proposal,
            Pubkey::new_unique(),
            OptimisticEvidence {
                outcome: HybridMarket::OUTCOME_NO,
                hash: &challenge_hash,
                uri: challenge_uri,
            },
            2_111,
        )
        .is_err());

        assert_eq!(
            optimistic_finalize_outcome(&market, &proposal, 2_111).unwrap(),
            (HybridMarket::OUTCOME_YES, false)
        );
        assert!(optimistic_finalize_outcome(&market, &proposal, 2_110).is_err());

        proposal.challenger = Pubkey::new_unique();
        proposal.challenged_outcome = HybridMarket::OUTCOME_NO;
        proposal.challenge_hash = challenge_hash;
        proposal.challenge_evidence_uri = challenge_uri.to_string();
        market.phase = HybridPhase::Disputed;
        assert!(validate_optimistic_arbitration(
            &market,
            &proposal,
            HybridMarket::OUTCOME_NO,
            &[6; 32],
            5_999,
        )
        .is_ok());
        assert!(validate_optimistic_arbitration(
            &market,
            &proposal,
            HybridMarket::OUTCOME_INVALID,
            &[6; 32],
            5_999,
        )
        .is_err());
        assert!(validate_optimistic_arbitration(
            &market,
            &proposal,
            HybridMarket::OUTCOME_NO,
            &[6; 32],
            6_001,
        )
        .is_err());
    }

    #[test]
    fn optimistic_finalize_invalidates_after_the_hard_deadline() {
        let mut market = resolution_market();
        market.phase = HybridPhase::Resolving;
        market.resolution_deadline_ts = 2_200;
        let proposal = optimistic_proposal();
        assert_eq!(
            optimistic_finalize_outcome(&market, &proposal, 2_201).unwrap(),
            (HybridMarket::OUTCOME_INVALID, true)
        );
    }

    #[test]
    fn optimistic_bond_payouts_conserve_the_separate_vault() {
        let mut proposal = optimistic_proposal();
        record_optimistic_payouts(&mut proposal, MIN_OPTIMISTIC_BOND, 0, 0).unwrap();
        assert_eq!(proposal.proposer_payout, MIN_OPTIMISTIC_BOND);
        assert_eq!(proposal.challenger_payout, 0);
        assert_eq!(proposal.treasury_payout, 0);

        let mut disputed = optimistic_proposal();
        disputed.challenger = Pubkey::new_unique();
        let (winner_payout, treasury_fee) = optimistic_dispute_payout(MIN_OPTIMISTIC_BOND).unwrap();
        record_optimistic_payouts(&mut disputed, 0, winner_payout, treasury_fee).unwrap();
        assert_eq!(
            disputed.challenger_payout + disputed.treasury_payout,
            MIN_OPTIMISTIC_BOND * 2
        );

        let mut invalid = optimistic_proposal();
        invalid.challenger = Pubkey::new_unique();
        assert!(record_optimistic_payouts(&mut invalid, MIN_OPTIMISTIC_BOND, 0, 0).is_err());
    }

    #[test]
    fn optimistic_bond_claim_is_replay_safe_and_destination_independent() {
        let mut proposal = optimistic_proposal();
        proposal.finalized = true;
        proposal.proposer_payout = MIN_OPTIMISTIC_BOND;
        let proposer = proposal.proposer;
        assert_eq!(
            prepare_optimistic_bond_claim(&mut proposal, Pubkey::new_unique(), proposer).unwrap(),
            MIN_OPTIMISTIC_BOND
        );
        assert!(
            prepare_optimistic_bond_claim(&mut proposal, Pubkey::new_unique(), proposer,).is_err()
        );
        assert!(prepare_optimistic_bond_claim(
            &mut proposal,
            Pubkey::new_unique(),
            Pubkey::new_unique(),
        )
        .is_err());
    }

    fn metadata_fixture() -> (HybridMarket, PublishHybridMetadataArgs) {
        let args = PublishHybridMetadataArgs {
            question: "Will BTC be above 120000 USD?".to_string(),
            rules: "Use the fully verified timestamped Pyth BTC/USD update.".to_string(),
            yes_label: "YES".to_string(),
            no_label: "NO".to_string(),
            reference_url: "https://pyth.network/price-feeds/crypto-btc-usd".to_string(),
        };
        let mut market = resolution_market();
        market.question_hash = hashv(&[args.question.as_bytes()]).to_bytes();
        market.rules_hash = hashv(&[args.rules.as_bytes()]).to_bytes();
        market.outcome_labels_hash = hashv(&[b"YES\nNO"]).to_bytes();
        (market, args)
    }

    #[test]
    fn hybrid_metadata_requires_exact_hashes_and_safe_text() {
        let (market, args) = metadata_fixture();
        validate_hybrid_metadata(&market, &args).unwrap();

        let mut wrong_question = args.clone();
        wrong_question.question.push('!');
        assert!(validate_hybrid_metadata(&market, &wrong_question).is_err());

        let mut untrimmed = args.clone();
        untrimmed.rules.push(' ');
        assert!(validate_hybrid_metadata(&market, &untrimmed).is_err());

        let mut bad_url = args.clone();
        bad_url.reference_url = "javascript:alert(1)".to_string();
        assert!(validate_hybrid_metadata(&market, &bad_url).is_err());

        let mut oversized = args.clone();
        oversized.question = "q".repeat(MAX_QUESTION_BYTES + 1);
        assert!(validate_hybrid_metadata(&market, &oversized).is_err());
    }

    #[test]
    fn v2_account_allocations_cover_serialized_state() {
        let engine = EngineConfig {
            bump: 1,
            version: EngineConfig::VERSION,
            authority: Pubkey::new_unique(),
            treasury_owner: Pubkey::new_unique(),
            collateral_mint: DEVNET_USDC_MINT,
            token_program: anchor_spl::token::ID,
            treasury_fee_share_bps: DEFAULT_TREASURY_FEE_SHARE_BPS,
            pyth_receiver_program: PYTH_RECEIVER_PROGRAM_ID,
            switchboard_quote_program: SWITCHBOARD_QUOTE_PROGRAM_ID,
            paused: false,
        };
        let mut engine_data = Vec::new();
        engine.try_serialize(&mut engine_data).unwrap();
        assert!(engine_data.len() <= EngineConfig::SPACE);

        let position = Position {
            bump: 1,
            version: Position::VERSION,
            market: Pubkey::new_unique(),
            owner: Pubkey::new_unique(),
            yes_shares: 1,
            no_shares: 2,
            total_spent: 3,
            total_proceeds: 4,
            settled_amount: 5,
            settled: false,
        };
        let mut position_data = Vec::new();
        position.try_serialize(&mut position_data).unwrap();
        assert!(position_data.len() <= Position::SPACE);

        let mut market_data = Vec::new();
        resolution_market().try_serialize(&mut market_data).unwrap();
        assert!(market_data.len() <= HybridMarket::SPACE);

        let mut oracle_data = Vec::new();
        resolution_oracle(Pubkey::new_unique())
            .try_serialize(&mut oracle_data)
            .unwrap();
        assert!(oracle_data.len() <= OracleConfig::SPACE);

        let mut receipt_data = Vec::new();
        empty_receipt().try_serialize(&mut receipt_data).unwrap();
        assert!(receipt_data.len() <= ResolutionReceipt::SPACE);

        let mut proposal = optimistic_proposal();
        proposal.assertion_evidence_uri = "a".repeat(MAX_OPTIMISTIC_EVIDENCE_URI_BYTES);
        proposal.challenge_evidence_uri = "c".repeat(MAX_OPTIMISTIC_EVIDENCE_URI_BYTES);
        let mut proposal_data = Vec::new();
        proposal.try_serialize(&mut proposal_data).unwrap();
        assert!(proposal_data.len() <= OptimisticProposal::SPACE);

        let metadata = HybridMarketMetadata {
            bump: 1,
            version: HybridMarketMetadata::VERSION,
            market: Pubkey::new_unique(),
            creator: Pubkey::new_unique(),
            question: "q".repeat(MAX_QUESTION_BYTES),
            rules: "r".repeat(MAX_RULES_BYTES),
            yes_label: "y".repeat(MAX_OUTCOME_LABEL_BYTES),
            no_label: "n".repeat(MAX_OUTCOME_LABEL_BYTES),
            reference_url: "u".repeat(MAX_REFERENCE_URL_BYTES),
            published_at: 1,
        };
        let mut metadata_data = Vec::new();
        metadata.try_serialize(&mut metadata_data).unwrap();
        assert!(metadata_data.len() <= HybridMarketMetadata::SPACE);
    }
}

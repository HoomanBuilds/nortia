use core::cmp::{max, min};

pub const FIXED_SCALE: u128 = 1_000_000_000_000;
pub const PROBABILITY_SCALE: u64 = 1_000_000;
pub const MIN_LIQUIDITY_PARAMETER: u64 = 10_000_000;
pub const MAX_LIQUIDITY_PARAMETER: u64 = 1_000_000_000_000;
pub const MIN_TRADE_SHARES: u64 = 10_000;
pub const MAX_TRADE_SHARES: u64 = 100_000_000_000;
pub const MAX_OUTCOME_QUANTITY: u64 = 1_000_000_000_000_000;
pub const MAX_IMBALANCE_MULTIPLIER: u64 = 20;
pub const MAX_TRADING_FEE_BPS: u16 = 1_000;
const LN_2_FIXED: u128 = 693_147_180_559;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum OutcomeSide {
    Yes,
    No,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum TradeDirection {
    Buy,
    Sell,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct MarketQuantities {
    pub yes: u64,
    pub no: u64,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct TradeQuote {
    pub direction: TradeDirection,
    pub side: OutcomeSide,
    pub shares: u64,
    pub raw_amount: u64,
    pub fee_amount: u64,
    pub total_amount: u64,
    pub average_price: u64,
    pub before_yes_probability: u64,
    pub after_yes_probability: u64,
    pub after: MarketQuantities,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum LmsrError {
    InvalidLiquidity,
    InvalidTradeSize,
    InvalidFee,
    InsufficientShares,
    QuantityOverflow,
    ImbalanceLimit,
    ArithmeticOverflow,
    ZeroAmount,
    FeeExceedsProceeds,
}

#[derive(Clone, Copy)]
struct QuoteRequest {
    direction: TradeDirection,
    side: OutcomeSide,
    shares: u64,
    fee_bps: u16,
}

pub fn required_subsidy(liquidity: u64, rounding_reserve: u64) -> Result<u64, LmsrError> {
    validate_liquidity(liquidity)?;
    let cost = mul_div_ceil(liquidity as u128, LN_2_FIXED, FIXED_SCALE)?;
    to_u64(
        cost.checked_add(rounding_reserve as u128)
            .ok_or(LmsrError::ArithmeticOverflow)?,
    )
}

pub fn cost_fixed(quantities: MarketQuantities, liquidity: u64) -> Result<u128, LmsrError> {
    validate_state(quantities, liquidity)?;
    let maximum = max(quantities.yes, quantities.no) as u128;
    let difference = quantities.yes.abs_diff(quantities.no) as u128;
    let ratio = mul_div_floor(difference, FIXED_SCALE, liquidity as u128)?;
    let tail = exp_negative_fixed(ratio)?;
    let softplus = ln_one_plus_fixed(tail)?;
    maximum
        .checked_mul(FIXED_SCALE)
        .and_then(|base| base.checked_add((liquidity as u128).checked_mul(softplus)?))
        .ok_or(LmsrError::ArithmeticOverflow)
}

pub fn yes_probability(quantities: MarketQuantities, liquidity: u64) -> Result<u64, LmsrError> {
    validate_state(quantities, liquidity)?;
    let difference = quantities.yes.abs_diff(quantities.no) as u128;
    let ratio = mul_div_floor(difference, FIXED_SCALE, liquidity as u128)?;
    let tail = exp_negative_fixed(ratio)?;
    let denominator = FIXED_SCALE
        .checked_add(tail)
        .ok_or(LmsrError::ArithmeticOverflow)?;
    let lower = to_u64(mul_div_floor(tail, PROBABILITY_SCALE as u128, denominator)?)?;
    let probability = if quantities.yes >= quantities.no {
        PROBABILITY_SCALE
            .checked_sub(lower)
            .ok_or(LmsrError::ArithmeticOverflow)?
    } else {
        lower
    };
    Ok(probability)
}

pub fn quote_buy(
    quantities: MarketQuantities,
    liquidity: u64,
    side: OutcomeSide,
    shares: u64,
    fee_bps: u16,
) -> Result<TradeQuote, LmsrError> {
    validate_trade(shares, fee_bps)?;
    let after = increase(quantities, side, shares)?;
    validate_state(after, liquidity)?;
    let before_cost = cost_fixed(quantities, liquidity)?;
    let after_cost = cost_fixed(after, liquidity)?;
    let delta = after_cost
        .checked_sub(before_cost)
        .ok_or(LmsrError::ArithmeticOverflow)?;
    let raw_amount = to_u64(div_ceil(delta, FIXED_SCALE)?)?;
    if raw_amount == 0 {
        return Err(LmsrError::ZeroAmount);
    }
    build_quote(
        QuoteRequest {
            direction: TradeDirection::Buy,
            side,
            shares,
            fee_bps,
        },
        quantities,
        after,
        liquidity,
        raw_amount,
    )
}

pub fn quote_sell(
    quantities: MarketQuantities,
    liquidity: u64,
    side: OutcomeSide,
    shares: u64,
    fee_bps: u16,
) -> Result<TradeQuote, LmsrError> {
    validate_trade(shares, fee_bps)?;
    let after = decrease(quantities, side, shares)?;
    validate_state(after, liquidity)?;
    let before_cost = cost_fixed(quantities, liquidity)?;
    let after_cost = cost_fixed(after, liquidity)?;
    let delta = before_cost
        .checked_sub(after_cost)
        .ok_or(LmsrError::ArithmeticOverflow)?;
    let raw_amount = to_u64(delta / FIXED_SCALE)?;
    if raw_amount == 0 {
        return Err(LmsrError::ZeroAmount);
    }
    build_quote(
        QuoteRequest {
            direction: TradeDirection::Sell,
            side,
            shares,
            fee_bps,
        },
        quantities,
        after,
        liquidity,
        raw_amount,
    )
}

fn build_quote(
    request: QuoteRequest,
    before: MarketQuantities,
    after: MarketQuantities,
    liquidity: u64,
    raw_amount: u64,
) -> Result<TradeQuote, LmsrError> {
    let average_price_fixed =
        mul_div_floor(raw_amount as u128, FIXED_SCALE, request.shares as u128)?;
    let bounded_price = min(average_price_fixed, FIXED_SCALE);
    let complement = FIXED_SCALE
        .checked_sub(bounded_price)
        .ok_or(LmsrError::ArithmeticOverflow)?;
    let curvature = mul_div_floor(bounded_price, complement, FIXED_SCALE)?;
    let fee_numerator = (request.shares as u128)
        .checked_mul(request.fee_bps as u128)
        .and_then(|value| value.checked_mul(curvature))
        .ok_or(LmsrError::ArithmeticOverflow)?;
    let fee_denominator = 10_000u128
        .checked_mul(FIXED_SCALE)
        .ok_or(LmsrError::ArithmeticOverflow)?;
    let fee_amount = to_u64(div_ceil(fee_numerator, fee_denominator)?)?;
    let total_amount = match request.direction {
        TradeDirection::Buy => raw_amount
            .checked_add(fee_amount)
            .ok_or(LmsrError::ArithmeticOverflow)?,
        TradeDirection::Sell => raw_amount
            .checked_sub(fee_amount)
            .ok_or(LmsrError::FeeExceedsProceeds)?,
    };
    if total_amount == 0 {
        return Err(LmsrError::ZeroAmount);
    }
    Ok(TradeQuote {
        direction: request.direction,
        side: request.side,
        shares: request.shares,
        raw_amount,
        fee_amount,
        total_amount,
        average_price: to_u64(mul_div_floor(
            bounded_price,
            PROBABILITY_SCALE as u128,
            FIXED_SCALE,
        )?)?,
        before_yes_probability: yes_probability(before, liquidity)?,
        after_yes_probability: yes_probability(after, liquidity)?,
        after,
    })
}

fn validate_liquidity(liquidity: u64) -> Result<(), LmsrError> {
    if !(MIN_LIQUIDITY_PARAMETER..=MAX_LIQUIDITY_PARAMETER).contains(&liquidity) {
        return Err(LmsrError::InvalidLiquidity);
    }
    Ok(())
}

fn validate_trade(shares: u64, fee_bps: u16) -> Result<(), LmsrError> {
    if !(MIN_TRADE_SHARES..=MAX_TRADE_SHARES).contains(&shares) {
        return Err(LmsrError::InvalidTradeSize);
    }
    if fee_bps > MAX_TRADING_FEE_BPS {
        return Err(LmsrError::InvalidFee);
    }
    Ok(())
}

fn validate_state(quantities: MarketQuantities, liquidity: u64) -> Result<(), LmsrError> {
    validate_liquidity(liquidity)?;
    if quantities.yes > MAX_OUTCOME_QUANTITY || quantities.no > MAX_OUTCOME_QUANTITY {
        return Err(LmsrError::QuantityOverflow);
    }
    let maximum_imbalance = liquidity
        .checked_mul(MAX_IMBALANCE_MULTIPLIER)
        .ok_or(LmsrError::ArithmeticOverflow)?;
    if quantities.yes.abs_diff(quantities.no) > maximum_imbalance {
        return Err(LmsrError::ImbalanceLimit);
    }
    Ok(())
}

fn increase(
    quantities: MarketQuantities,
    side: OutcomeSide,
    shares: u64,
) -> Result<MarketQuantities, LmsrError> {
    match side {
        OutcomeSide::Yes => Ok(MarketQuantities {
            yes: quantities
                .yes
                .checked_add(shares)
                .ok_or(LmsrError::QuantityOverflow)?,
            no: quantities.no,
        }),
        OutcomeSide::No => Ok(MarketQuantities {
            yes: quantities.yes,
            no: quantities
                .no
                .checked_add(shares)
                .ok_or(LmsrError::QuantityOverflow)?,
        }),
    }
}

fn decrease(
    quantities: MarketQuantities,
    side: OutcomeSide,
    shares: u64,
) -> Result<MarketQuantities, LmsrError> {
    match side {
        OutcomeSide::Yes => Ok(MarketQuantities {
            yes: quantities
                .yes
                .checked_sub(shares)
                .ok_or(LmsrError::InsufficientShares)?,
            no: quantities.no,
        }),
        OutcomeSide::No => Ok(MarketQuantities {
            yes: quantities.yes,
            no: quantities
                .no
                .checked_sub(shares)
                .ok_or(LmsrError::InsufficientShares)?,
        }),
    }
}

fn exp_negative_fixed(value: u128) -> Result<u128, LmsrError> {
    let ln_two = LN_2_FIXED;
    let power = value / ln_two;
    if power > 127 {
        return Ok(0);
    }
    let remainder = value % ln_two;
    let mut term = FIXED_SCALE;
    let mut sum = FIXED_SCALE;
    for denominator in 1..=22u128 {
        term = mul_div_floor(term, remainder, FIXED_SCALE)? / denominator;
        if denominator % 2 == 1 {
            sum = sum.checked_sub(term).ok_or(LmsrError::ArithmeticOverflow)?;
        } else {
            sum = sum.checked_add(term).ok_or(LmsrError::ArithmeticOverflow)?;
        }
    }
    Ok(sum >> power)
}

fn ln_one_plus_fixed(value: u128) -> Result<u128, LmsrError> {
    if value > FIXED_SCALE {
        return Err(LmsrError::ArithmeticOverflow);
    }
    let denominator = FIXED_SCALE
        .checked_mul(2)
        .and_then(|base| base.checked_add(value))
        .ok_or(LmsrError::ArithmeticOverflow)?;
    let ratio = mul_div_floor(value, FIXED_SCALE, denominator)?;
    let ratio_squared = mul_div_floor(ratio, ratio, FIXED_SCALE)?;
    let mut power = ratio;
    let mut sum = power;
    for denominator in (3..=33u128).step_by(2) {
        power = mul_div_floor(power, ratio_squared, FIXED_SCALE)?;
        sum = sum
            .checked_add(power / denominator)
            .ok_or(LmsrError::ArithmeticOverflow)?;
    }
    sum.checked_mul(2).ok_or(LmsrError::ArithmeticOverflow)
}

fn mul_div_floor(a: u128, b: u128, denominator: u128) -> Result<u128, LmsrError> {
    if denominator == 0 {
        return Err(LmsrError::ArithmeticOverflow);
    }
    a.checked_mul(b)
        .map(|value| value / denominator)
        .ok_or(LmsrError::ArithmeticOverflow)
}

fn mul_div_ceil(a: u128, b: u128, denominator: u128) -> Result<u128, LmsrError> {
    let value = a.checked_mul(b).ok_or(LmsrError::ArithmeticOverflow)?;
    div_ceil(value, denominator)
}

fn div_ceil(value: u128, denominator: u128) -> Result<u128, LmsrError> {
    if denominator == 0 {
        return Err(LmsrError::ArithmeticOverflow);
    }
    let quotient = value / denominator;
    if value % denominator == 0 {
        Ok(quotient)
    } else {
        quotient.checked_add(1).ok_or(LmsrError::ArithmeticOverflow)
    }
}

fn to_u64(value: u128) -> Result<u64, LmsrError> {
    u64::try_from(value).map_err(|_| LmsrError::ArithmeticOverflow)
}

#[cfg(test)]
mod tests {
    use super::*;

    const B: u64 = 100_000_000;

    #[test]
    fn initial_market_is_balanced_and_funded() {
        let quantities = MarketQuantities { yes: 0, no: 0 };
        assert_eq!(yes_probability(quantities, B), Ok(500_000));
        assert_eq!(required_subsidy(B, 2), Ok(69_314_721));
        assert!(cost_fixed(quantities, B).unwrap() > 69_314_718 * FIXED_SCALE);
    }

    #[test]
    fn same_side_demand_moves_probability_monotonically() {
        let start = MarketQuantities { yes: 0, no: 0 };
        let first = quote_buy(start, B, OutcomeSide::Yes, 10_000_000, 100).unwrap();
        let second = quote_buy(first.after, B, OutcomeSide::Yes, 10_000_000, 100).unwrap();
        assert!(first.after_yes_probability > first.before_yes_probability);
        assert!(second.after_yes_probability > first.after_yes_probability);
        assert!(second.raw_amount > first.raw_amount);
    }

    #[test]
    fn quotes_match_cross_language_vectors() {
        let first = quote_buy(
            MarketQuantities { yes: 0, no: 0 },
            B,
            OutcomeSide::Yes,
            10_000_000,
            100,
        )
        .unwrap();
        assert_eq!(first.raw_amount, 5_124_948);
        assert_eq!(first.fee_amount, 24_985);
        assert_eq!(first.after_yes_probability, 524_980);

        let second = quote_buy(
            MarketQuantities {
                yes: 75_000_000,
                no: 20_000_000,
            },
            B,
            OutcomeSide::No,
            30_000_000,
            100,
        )
        .unwrap();
        assert_eq!(second.raw_amount, 12_044_694);
        assert_eq!(second.fee_amount, 72_089);
        assert_eq!(second.after_yes_probability, 562_177);
    }

    #[test]
    fn yes_and_no_quotes_are_symmetric() {
        let start = MarketQuantities { yes: 0, no: 0 };
        let yes = quote_buy(start, B, OutcomeSide::Yes, 25_000_000, 100).unwrap();
        let no = quote_buy(start, B, OutcomeSide::No, 25_000_000, 100).unwrap();
        assert_eq!(yes.raw_amount, no.raw_amount);
        assert_eq!(yes.fee_amount, no.fee_amount);
        assert_eq!(
            yes.after_yes_probability,
            PROBABILITY_SCALE - no.after_yes_probability
        );
    }

    #[test]
    fn round_trip_cannot_profit() {
        let start = MarketQuantities { yes: 0, no: 0 };
        let buy = quote_buy(start, B, OutcomeSide::Yes, 10_000_000, 100).unwrap();
        let sell = quote_sell(buy.after, B, OutcomeSide::Yes, 10_000_000, 100).unwrap();
        assert_eq!(sell.after, start);
        assert!(buy.total_amount > sell.total_amount);
        assert!(buy.raw_amount >= sell.raw_amount);
    }

    #[test]
    fn subsidy_and_trade_cash_cover_largest_outcome() {
        let mut state = MarketQuantities { yes: 0, no: 0 };
        let mut vault = required_subsidy(B, 2).unwrap() as u128;
        for index in 0..200 {
            let side = if index % 3 == 0 {
                OutcomeSide::No
            } else {
                OutcomeSide::Yes
            };
            let quote = quote_buy(state, B, side, 100_000, 100).unwrap();
            vault += quote.raw_amount as u128;
            state = quote.after;
            assert!(vault >= max(state.yes, state.no) as u128);
        }
    }

    #[test]
    fn randomized_sequence_preserves_solvency_and_positions() {
        let mut state = MarketQuantities { yes: 0, no: 0 };
        let mut yes_position = 0u64;
        let mut no_position = 0u64;
        let mut vault = required_subsidy(B, 2).unwrap() as i128;
        let mut seed = 7u64;
        for _ in 0..5_000 {
            seed = seed.wrapping_mul(6_364_136_223_846_793_005).wrapping_add(1);
            let side = if seed & 1 == 0 {
                OutcomeSide::Yes
            } else {
                OutcomeSide::No
            };
            let position = if side == OutcomeSide::Yes {
                yes_position
            } else {
                no_position
            };
            let sell = seed & 2 != 0 && position >= MIN_TRADE_SHARES;
            let max_size = if sell {
                min(position, 2_000_000)
            } else {
                2_000_000
            };
            let steps = max_size / MIN_TRADE_SHARES;
            let shares = ((seed % steps.max(1)) + 1) * MIN_TRADE_SHARES;
            let quote = if sell {
                quote_sell(state, B, side, shares, 100).unwrap()
            } else {
                quote_buy(state, B, side, shares, 100).unwrap()
            };
            if sell {
                vault -= quote.raw_amount as i128;
                if side == OutcomeSide::Yes {
                    yes_position -= shares;
                } else {
                    no_position -= shares;
                }
            } else {
                vault += quote.raw_amount as i128;
                if side == OutcomeSide::Yes {
                    yes_position += shares;
                } else {
                    no_position += shares;
                }
            }
            state = quote.after;
            assert_eq!(state.yes, yes_position);
            assert_eq!(state.no, no_position);
            assert!(vault >= max(state.yes, state.no) as i128);
        }
    }

    #[test]
    fn invalid_boundaries_fail_closed() {
        let state = MarketQuantities { yes: 0, no: 0 };
        assert_eq!(required_subsidy(0, 0), Err(LmsrError::InvalidLiquidity));
        assert_eq!(
            quote_buy(state, B, OutcomeSide::Yes, MIN_TRADE_SHARES - 1, 0),
            Err(LmsrError::InvalidTradeSize)
        );
        assert_eq!(
            quote_buy(
                state,
                B,
                OutcomeSide::Yes,
                MIN_TRADE_SHARES,
                MAX_TRADING_FEE_BPS + 1
            ),
            Err(LmsrError::InvalidFee)
        );
        assert_eq!(
            quote_sell(state, B, OutcomeSide::Yes, MIN_TRADE_SHARES, 0),
            Err(LmsrError::InsufficientShares)
        );
        assert_eq!(
            yes_probability(
                MarketQuantities {
                    yes: B * MAX_IMBALANCE_MULTIPLIER + 1,
                    no: 0,
                },
                B,
            ),
            Err(LmsrError::ImbalanceLimit)
        );
    }
}

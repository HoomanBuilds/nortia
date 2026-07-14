export const LMSR_FIXED_SCALE = 1_000_000_000_000n;
export const LMSR_PROBABILITY_SCALE = 1_000_000n;
export const MIN_LIQUIDITY_PARAMETER = 10_000_000n;
export const MAX_LIQUIDITY_PARAMETER = 1_000_000_000_000n;
export const MIN_TRADE_SHARES = 10_000n;
export const MAX_TRADE_SHARES = 100_000_000_000n;
export const MAX_OUTCOME_QUANTITY = 1_000_000_000_000_000n;
export const MAX_IMBALANCE_MULTIPLIER = 20n;
export const MAX_TRADING_FEE_BPS = 1_000;
const LN_2_FIXED = 693_147_180_559n;

export type OutcomeSide = "yes" | "no";
export type TradeDirection = "buy" | "sell";

export type MarketQuantities = {
  yes: bigint;
  no: bigint;
};

export type TradeQuote = {
  direction: TradeDirection;
  side: OutcomeSide;
  shares: bigint;
  rawAmount: bigint;
  feeAmount: bigint;
  totalAmount: bigint;
  averagePrice: bigint;
  beforeYesProbability: bigint;
  afterYesProbability: bigint;
  after: MarketQuantities;
};

export function requiredLmsrSubsidy(liquidity: bigint, roundingReserve: bigint): bigint {
  validateLiquidity(liquidity);
  if (roundingReserve < 0n) throw new Error("rounding reserve cannot be negative");
  return mulDivCeil(liquidity, LN_2_FIXED, LMSR_FIXED_SCALE) + roundingReserve;
}

export function lmsrCostFixed(quantities: MarketQuantities, liquidity: bigint): bigint {
  validateState(quantities, liquidity);
  const maximum = quantities.yes > quantities.no ? quantities.yes : quantities.no;
  const difference = absoluteDifference(quantities.yes, quantities.no);
  const ratio = mulDivFloor(difference, LMSR_FIXED_SCALE, liquidity);
  const tail = expNegativeFixed(ratio);
  const softplus = lnOnePlusFixed(tail);
  return maximum * LMSR_FIXED_SCALE + liquidity * softplus;
}

export function lmsrYesProbability(quantities: MarketQuantities, liquidity: bigint): bigint {
  validateState(quantities, liquidity);
  const difference = absoluteDifference(quantities.yes, quantities.no);
  const ratio = mulDivFloor(difference, LMSR_FIXED_SCALE, liquidity);
  const tail = expNegativeFixed(ratio);
  const lower = mulDivFloor(tail, LMSR_PROBABILITY_SCALE, LMSR_FIXED_SCALE + tail);
  return quantities.yes >= quantities.no ? LMSR_PROBABILITY_SCALE - lower : lower;
}

export function quoteLmsrBuy(
  quantities: MarketQuantities,
  liquidity: bigint,
  side: OutcomeSide,
  shares: bigint,
  feeBps: number,
): TradeQuote {
  validateTrade(shares, feeBps);
  const after = increase(quantities, side, shares);
  validateState(after, liquidity);
  const rawAmount = divCeil(lmsrCostFixed(after, liquidity) - lmsrCostFixed(quantities, liquidity), LMSR_FIXED_SCALE);
  if (rawAmount === 0n) throw new Error("trade amount rounds to zero");
  return buildQuote("buy", quantities, after, liquidity, side, shares, rawAmount, feeBps);
}

export function quoteLmsrSell(
  quantities: MarketQuantities,
  liquidity: bigint,
  side: OutcomeSide,
  shares: bigint,
  feeBps: number,
): TradeQuote {
  validateTrade(shares, feeBps);
  const after = decrease(quantities, side, shares);
  validateState(after, liquidity);
  const rawAmount = (lmsrCostFixed(quantities, liquidity) - lmsrCostFixed(after, liquidity)) / LMSR_FIXED_SCALE;
  if (rawAmount === 0n) throw new Error("trade amount rounds to zero");
  return buildQuote("sell", quantities, after, liquidity, side, shares, rawAmount, feeBps);
}

function buildQuote(
  direction: TradeDirection,
  before: MarketQuantities,
  after: MarketQuantities,
  liquidity: bigint,
  side: OutcomeSide,
  shares: bigint,
  rawAmount: bigint,
  feeBps: number,
): TradeQuote {
  const averagePriceFixed = mulDivFloor(rawAmount, LMSR_FIXED_SCALE, shares);
  const boundedPrice = averagePriceFixed < LMSR_FIXED_SCALE ? averagePriceFixed : LMSR_FIXED_SCALE;
  const curvature = mulDivFloor(boundedPrice, LMSR_FIXED_SCALE - boundedPrice, LMSR_FIXED_SCALE);
  const feeAmount = divCeil(shares * BigInt(feeBps) * curvature, 10_000n * LMSR_FIXED_SCALE);
  const totalAmount = direction === "buy" ? rawAmount + feeAmount : rawAmount - feeAmount;
  if (totalAmount <= 0n) throw new Error("fee exceeds trade proceeds");
  return {
    direction,
    side,
    shares,
    rawAmount,
    feeAmount,
    totalAmount,
    averagePrice: mulDivFloor(boundedPrice, LMSR_PROBABILITY_SCALE, LMSR_FIXED_SCALE),
    beforeYesProbability: lmsrYesProbability(before, liquidity),
    afterYesProbability: lmsrYesProbability(after, liquidity),
    after,
  };
}

function validateLiquidity(liquidity: bigint) {
  if (liquidity < MIN_LIQUIDITY_PARAMETER || liquidity > MAX_LIQUIDITY_PARAMETER) {
    throw new Error("liquidity parameter is outside protocol bounds");
  }
}

function validateTrade(shares: bigint, feeBps: number) {
  if (shares < MIN_TRADE_SHARES || shares > MAX_TRADE_SHARES) {
    throw new Error("share amount is outside protocol bounds");
  }
  if (!Number.isSafeInteger(feeBps) || feeBps < 0 || feeBps > MAX_TRADING_FEE_BPS) {
    throw new Error("trading fee is outside protocol bounds");
  }
}

function validateState(quantities: MarketQuantities, liquidity: bigint) {
  validateLiquidity(liquidity);
  if (quantities.yes < 0n || quantities.no < 0n || quantities.yes > MAX_OUTCOME_QUANTITY || quantities.no > MAX_OUTCOME_QUANTITY) {
    throw new Error("outcome quantity is outside protocol bounds");
  }
  if (absoluteDifference(quantities.yes, quantities.no) > liquidity * MAX_IMBALANCE_MULTIPLIER) {
    throw new Error("market imbalance exceeds protocol bounds");
  }
}

function increase(quantities: MarketQuantities, side: OutcomeSide, shares: bigint): MarketQuantities {
  return side === "yes"
    ? { yes: quantities.yes + shares, no: quantities.no }
    : { yes: quantities.yes, no: quantities.no + shares };
}

function decrease(quantities: MarketQuantities, side: OutcomeSide, shares: bigint): MarketQuantities {
  if (side === "yes") {
    if (quantities.yes < shares) throw new Error("insufficient YES shares");
    return { yes: quantities.yes - shares, no: quantities.no };
  }
  if (quantities.no < shares) throw new Error("insufficient NO shares");
  return { yes: quantities.yes, no: quantities.no - shares };
}

function expNegativeFixed(value: bigint): bigint {
  const power = value / LN_2_FIXED;
  if (power > 127n) return 0n;
  const remainder = value % LN_2_FIXED;
  let term = LMSR_FIXED_SCALE;
  let sum = LMSR_FIXED_SCALE;
  for (let denominator = 1n; denominator <= 22n; denominator += 1n) {
    term = mulDivFloor(term, remainder, LMSR_FIXED_SCALE) / denominator;
    sum = denominator % 2n === 1n ? sum - term : sum + term;
  }
  return sum >> power;
}

function lnOnePlusFixed(value: bigint): bigint {
  if (value < 0n || value > LMSR_FIXED_SCALE) throw new Error("logarithm input is outside protocol bounds");
  const ratio = mulDivFloor(value, LMSR_FIXED_SCALE, 2n * LMSR_FIXED_SCALE + value);
  const ratioSquared = mulDivFloor(ratio, ratio, LMSR_FIXED_SCALE);
  let power = ratio;
  let sum = power;
  for (let denominator = 3n; denominator <= 33n; denominator += 2n) {
    power = mulDivFloor(power, ratioSquared, LMSR_FIXED_SCALE);
    sum += power / denominator;
  }
  return 2n * sum;
}

function mulDivFloor(a: bigint, b: bigint, denominator: bigint): bigint {
  if (a < 0n || b < 0n || denominator <= 0n) throw new Error("invalid unsigned division");
  return (a * b) / denominator;
}

function mulDivCeil(a: bigint, b: bigint, denominator: bigint): bigint {
  return divCeil(a * b, denominator);
}

function divCeil(value: bigint, denominator: bigint): bigint {
  if (value < 0n || denominator <= 0n) throw new Error("invalid unsigned division");
  const quotient = value / denominator;
  return value % denominator === 0n ? quotient : quotient + 1n;
}

function absoluteDifference(a: bigint, b: bigint): bigint {
  return a >= b ? a - b : b - a;
}

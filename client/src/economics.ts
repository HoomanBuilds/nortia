export const USDC_DECIMALS = 6;
export const USDC_SCALE = 10n ** BigInt(USDC_DECIMALS);
export const MAX_FEE_BPS = 300;
export const MAX_KEEPER_REWARD_BPS = 5_000;

export type SettlementAmounts = {
  grossPool: bigint;
  protocolFee: bigint;
  keeperReward: bigint;
  treasuryFee: bigint;
  netPool: bigint;
};

export function calculateSettlement(
  grossPool: bigint,
  winningAmount: bigint,
  feeBps: number,
  keeperRewardBps = 1_000,
): SettlementAmounts {
  if (grossPool <= 0n) throw new Error("gross pool must be positive");
  if (winningAmount <= 0n || winningAmount > grossPool) throw new Error("winning amount must be within the gross pool");
  if (!Number.isSafeInteger(feeBps) || feeBps < 0 || feeBps > MAX_FEE_BPS) {
    throw new Error(`fee must be between 0 and ${MAX_FEE_BPS} basis points`);
  }
  if (!Number.isSafeInteger(keeperRewardBps) || keeperRewardBps < 0 || keeperRewardBps > MAX_KEEPER_REWARD_BPS) {
    throw new Error(`keeper reward must be between 0 and ${MAX_KEEPER_REWARD_BPS} basis points`);
  }

  const protocolFee = (grossPool * BigInt(feeBps)) / 10_000n;
  const keeperReward = (protocolFee * BigInt(keeperRewardBps)) / 10_000n;
  const treasuryFee = protocolFee - keeperReward;
  const netPool = grossPool - protocolFee;
  return {
    grossPool,
    protocolFee,
    keeperReward,
    treasuryFee,
    netPool,
  };
}

export function calculatePrivatePayout(
  stakeAmount: bigint,
  wagerAmount: bigint,
  winner: boolean,
  netPool: bigint,
  winningAmount: bigint,
) {
  if (stakeAmount <= 0n || wagerAmount <= 0n || wagerAmount > stakeAmount) {
    throw new Error("wager amount must be within the public stake amount");
  }
  if (netPool < 0n || winningAmount <= 0n) throw new Error("settlement liquidity is invalid");
  const unusedCollateral = stakeAmount - wagerAmount;
  const marketPayout = winner ? (wagerAmount * netPool) / winningAmount : 0n;
  return { unusedCollateral, marketPayout, payoutAmount: unusedCollateral + marketPayout };
}

export function formatUsdc(amount: bigint, maximumFractionDigits = USDC_DECIMALS): string {
  if (maximumFractionDigits < 0 || maximumFractionDigits > USDC_DECIMALS) {
    throw new Error(`fraction digits must be between 0 and ${USDC_DECIMALS}`);
  }

  const sign = amount < 0n ? "-" : "";
  const absolute = amount < 0n ? -amount : amount;
  const whole = absolute / USDC_SCALE;
  const fraction = (absolute % USDC_SCALE).toString().padStart(USDC_DECIMALS, "0");
  const visible = fraction.slice(0, maximumFractionDigits).replace(/0+$/, "");
  return `${sign}${whole.toLocaleString("en-US")}${visible ? `.${visible}` : ""}`;
}

export function parseUsdc(value: string): bigint {
  if (!/^(0|[1-9]\d*)(\.\d{1,6})?$/.test(value)) {
    throw new Error("USDC amount must be a positive decimal with at most six places");
  }
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole!) * USDC_SCALE + BigInt(fraction.padEnd(USDC_DECIMALS, "0"));
}

export type MarketPhase = "open" | "batched" | "resolved" | "refunding" | "closed";

export function marketAction(
  phase: MarketPhase,
  now: number,
  lockTimestamp: number,
): "place" | "await-batch" | "settle" | "claim" | "refund" | "closed" {
  switch (phase) {
    case "open":
      return now < lockTimestamp ? "place" : "await-batch";
    case "batched":
      return "settle";
    case "resolved":
      return "claim";
    case "refunding":
      return "refund";
    case "closed":
      return "closed";
  }
}

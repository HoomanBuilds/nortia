export const USDC_DECIMALS = 6;
export const USDC_SCALE = 10n ** BigInt(USDC_DECIMALS);
export const MAX_FEE_BPS = 300;

export type SettlementAmounts = {
  grossPool: bigint;
  protocolFee: bigint;
  netPool: bigint;
  payoutPerWinner: bigint;
};

export function calculateSettlement(
  ticketAmount: bigint,
  orderCount: number,
  winnerCount: number,
  feeBps: number,
): SettlementAmounts {
  if (ticketAmount <= 0n) {
    throw new Error("ticket amount must be positive");
  }
  if (!Number.isSafeInteger(orderCount) || orderCount <= 0) {
    throw new Error("order count must be a positive safe integer");
  }
  if (!Number.isSafeInteger(winnerCount) || winnerCount <= 0 || winnerCount > orderCount) {
    throw new Error("winner count must be within the order count");
  }
  if (!Number.isSafeInteger(feeBps) || feeBps < 0 || feeBps > MAX_FEE_BPS) {
    throw new Error(`fee must be between 0 and ${MAX_FEE_BPS} basis points`);
  }

  const grossPool = ticketAmount * BigInt(orderCount);
  const protocolFee = (grossPool * BigInt(feeBps)) / 10_000n;
  const netPool = grossPool - protocolFee;
  return {
    grossPool,
    protocolFee,
    netPool,
    payoutPerWinner: netPool / BigInt(winnerCount),
  };
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

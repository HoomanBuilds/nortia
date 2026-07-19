import { parseUsdc } from "nortia-client/economics";

export type TradeDirection = "buy" | "sell";
export type TradeSide = "yes" | "no";

export function resolveTradeDirection(value: string | undefined): TradeDirection {
  const normalized = value?.trim().toLowerCase() || "buy";
  if (normalized !== "buy" && normalized !== "sell") {
    throw new Error("NORTIA_TRADE_DIRECTION must be buy or sell");
  }
  return normalized;
}

export function resolveTradeSide(value: string | undefined): TradeSide {
  const normalized = value?.trim().toLowerCase() || "yes";
  if (normalized !== "yes" && normalized !== "no") {
    throw new Error("NORTIA_TRADE_SIDE must be yes or no");
  }
  return normalized;
}

export function resolveTradeShares(value: string | undefined): bigint {
  const shares = parseUsdc(value?.trim() || "1");
  if (shares < 10_000n) throw new Error("NORTIA_TRADE_SHARES must be at least 0.01 shares");
  return shares;
}

export function resolveSlippageBps(value: string | undefined): number {
  const parsed = Number(value?.trim() || "100");
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > 1_000) {
    throw new Error("NORTIA_TRADE_SLIPPAGE_BPS must be an integer from 1 to 1000");
  }
  return parsed;
}

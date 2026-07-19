export type HybridPositionShares = {
  yesShares: bigint;
  noShares: bigint;
};

export type HybridOutcomeName = "yes" | "no" | "invalid" | "unset";
export type HybridPhaseName = "open" | "locked" | "resolving" | "disputed" | "resolved" | "closed";
export type HybridPositionStatus = "open" | "locked" | "resolving" | "disputed" | "closed" | "claimable" | "lost" | "settled";

export const POSITION_OWNER_OFFSET = 42;
export const HYBRID_LIQUIDITY_OWNER_OFFSET = 51;
export const PROBABILITY_SCALE = 1_000_000n;

export function hybridPositionPayout(
  position: HybridPositionShares,
  outcome: HybridOutcomeName,
): bigint {
  if (outcome === "yes") return position.yesShares;
  if (outcome === "no") return position.noShares;
  if (outcome === "invalid") return (position.yesShares + position.noShares) / 2n;
  return 0n;
}

export function hybridPositionStatus(
  phase: HybridPhaseName,
  outcome: HybridOutcomeName,
  settled: boolean,
  position: HybridPositionShares,
): HybridPositionStatus {
  if (settled) return "settled";
  if (phase !== "resolved") return phase;
  return hybridPositionPayout(position, outcome) > 0n ? "claimable" : "lost";
}

export function hybridRealizedPnl(input: {
  totalSpent: bigint;
  totalProceeds: bigint;
  payout: bigint;
}): bigint {
  return input.totalProceeds + input.payout - input.totalSpent;
}

export function hybridMarkedValue(
  position: HybridPositionShares,
  yesProbability: bigint,
): bigint {
  if (yesProbability < 0n || yesProbability > PROBABILITY_SCALE) {
    throw new Error("YES probability is outside the supported range");
  }
  const noProbability = PROBABILITY_SCALE - yesProbability;
  return (
    position.yesShares * yesProbability
    + position.noShares * noProbability
  ) / PROBABILITY_SCALE;
}

export function hybridMarkedPnl(input: {
  totalSpent: bigint;
  totalProceeds: bigint;
  markedValue: bigint;
}): bigint {
  return input.totalProceeds + input.markedValue - input.totalSpent;
}

export function withdrawableHybridLiquidity(
  vaultBalance: bigint,
  outstandingLiability: bigint,
): bigint {
  if (vaultBalance < outstandingLiability) {
    throw new Error("Hybrid market vault is insolvent");
  }
  return vaultBalance - outstandingLiability;
}

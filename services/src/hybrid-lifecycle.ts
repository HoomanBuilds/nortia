export type HybridPhase = "open" | "locked" | "resolving" | "disputed" | "resolved" | "closed";

export type HybridResolver =
  | "txline-stat-v2"
  | "pyth-price-v2"
  | "switchboard-quote-v1"
  | "optimistic-v1"
  | "uma-wormhole-v1"
  | "chainlink-report-v1";

export type OptimisticProposalState = {
  challengeDeadline: number;
  challenged: boolean;
  finalized: boolean;
};

export type HybridKeeperInput = {
  phase: HybridPhase;
  resolver: HybridResolver;
  lockTs: number;
  resolveNotBeforeTs: number;
  resolutionDeadlineTs: number;
  proposal: OptimisticProposalState | null;
};

export type HybridKeeperAction =
  | "none"
  | "lock"
  | "resolve-pyth"
  | "resolve-txline"
  | "resolve-switchboard"
  | "finalize-optimistic"
  | "timeout-optimistic-dispute"
  | "resolve-timeout";

function validateTimestamps(market: HybridKeeperInput, now: number): void {
  for (const [label, value] of [
    ["lock timestamp", market.lockTs],
    ["resolve timestamp", market.resolveNotBeforeTs],
    ["resolution deadline", market.resolutionDeadlineTs],
    ["current timestamp", now],
  ] as const) {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new Error(`${label} must be a non-negative safe integer`);
    }
  }
  if (
    market.lockTs > market.resolveNotBeforeTs
    || market.resolveNotBeforeTs >= market.resolutionDeadlineTs
  ) {
    throw new Error("hybrid market timestamps are not ordered");
  }
}

export function planHybridKeeperAction(
  market: HybridKeeperInput,
  now: number,
): HybridKeeperAction {
  validateTimestamps(market, now);
  if (market.phase === "resolved" || market.phase === "closed") return "none";

  if (now > market.resolutionDeadlineTs) {
    if (market.resolver === "optimistic-v1" && market.proposal && !market.proposal.finalized) {
      return market.proposal.challenged
        ? "timeout-optimistic-dispute"
        : "finalize-optimistic";
    }
    return "resolve-timeout";
  }

  if (now < market.lockTs) return "none";
  if (now < market.resolveNotBeforeTs) {
    return market.phase === "open" ? "lock" : "none";
  }

  const machineReady = market.phase === "open" || market.phase === "locked";
  if (market.resolver === "pyth-price-v2") return machineReady ? "resolve-pyth" : "none";
  if (market.resolver === "txline-stat-v2") return machineReady ? "resolve-txline" : "none";
  if (market.resolver === "switchboard-quote-v1") {
    return machineReady ? "resolve-switchboard" : "none";
  }
  if (market.resolver !== "optimistic-v1" || !market.proposal || market.proposal.finalized) {
    return "none";
  }
  if (
    market.phase === "resolving"
    && !market.proposal.challenged
    && now > market.proposal.challengeDeadline
  ) {
    return "finalize-optimistic";
  }
  return "none";
}

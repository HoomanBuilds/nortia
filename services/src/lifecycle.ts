export type IndexedMarket = {
  phase: "open" | "batched" | "resolved" | "refunding" | "closed";
  lockTs: number;
  batchDeadlineTs: number;
  resolutionDeadlineTs: number;
};

export type KeeperAction = "none" | "submit-batch" | "resolve" | "begin-refund";

export function planKeeperAction(market: IndexedMarket, now: number): KeeperAction {
  if (market.phase === "open") {
    if (now > market.batchDeadlineTs) return "begin-refund";
    if (now >= market.lockTs) return "submit-batch";
    return "none";
  }
  if (market.phase === "batched") {
    return now > market.resolutionDeadlineTs ? "begin-refund" : "resolve";
  }
  return "none";
}

const FRIENDLY_ERRORS: Readonly<Record<string, string>> = {
  InvalidEngineConfiguration: "The V2 market engine is not ready on this deployment.",
  InvalidMarketConfiguration: "Review the market dates, liquidity, and trade limits.",
  InvalidOracleConfiguration: "The selected resolver configuration is not supported.",
  InvalidMarketMetadata: "The question or rules no longer match this market's immutable hashes.",
  InvalidCollateralMint: "This market only accepts the configured devnet USDC mint.",
  InvalidTokenAccount: "The connected wallet needs a valid devnet USDC token account.",
  InvalidLmsrState: "The liquidity or market inventory is outside safe LMSR bounds.",
  InsufficientPosition: "Your position does not contain enough shares for this trade.",
  InsufficientVaultBalance: "The market vault cannot safely complete this trade.",
  InsolventMarket: "This trade would violate market collateral coverage.",
  PriceGuardExceeded: "The price moved beyond your slippage limit. Refresh the quote.",
  TradeDeadlineElapsed: "The quote expired. Refresh it and try again.",
  MarketLocked: "Trading has closed for this market.",
  ResolverSecurityCapExceeded: "This trade exceeds the resolver's secured exposure cap.",
  AccountNotInitialized: "A required market account is not initialized on this deployment.",
  ConstraintSeeds: "A derived market account does not match the expected address.",
};

function errorChain(cause: unknown): unknown[] {
  const chain: unknown[] = [];
  let current = cause;
  for (let depth = 0; depth < 8 && current; depth += 1) {
    chain.push(current);
    current = typeof current === "object" && "cause" in current
      ? (current as { cause?: unknown }).cause
      : null;
  }
  return chain;
}

export function translateNortiaError(cause: unknown): string {
  const chain = errorChain(cause);
  for (const item of chain) {
    const code = typeof item === "object" && item && "code" in item
      ? (item as { code?: unknown }).code
      : null;
    if (code === 4001) return "Transaction cancelled.";
    const text = item instanceof Error ? item.message : String(item);
    if (/user rejected|user denied|declined/i.test(text)) return "Transaction cancelled.";
    if (/^The creator wallet needs at least [0-9,.]+ devnet USDC$/.test(text)) return `${text}.`;
    if (text === "Resolution must be at least 20 minutes in the future") return `${text}.`;
    if (text === "Question and resolution rules are required") return `${text}.`;
    if (text === "Choose a valid resolution date and time") return `${text}.`;
    for (const [name, message] of Object.entries(FRIENDLY_ERRORS)) {
      if (text.includes(name)) return message;
    }
    if (/insufficient funds|insufficient lamports/i.test(text)) {
      return "The wallet needs more devnet SOL for account rent and transaction fees.";
    }
    if (/blockhash|timed out|429|fetch failed|network/i.test(text)) {
      return "Devnet is busy. Refresh the market state and retry.";
    }
  }
  return "The transaction could not be completed. Refresh the market state and retry.";
}

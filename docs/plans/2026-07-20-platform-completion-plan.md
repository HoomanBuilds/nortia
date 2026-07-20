# Nortia Platform Completion Plan

- Date: 2026-07-20
- Network: Solana devnet
- Product: Nortia
- Goal: Make the deployed protocol behave like a real prediction-market product from discovery through settlement

## Outcome

Nortia will present every deployed market from program state, show how its price moved, expose its trade and settlement ledger, quote execution economics before signing, and show connected-wallet positions with current value and profit or loss. Replay content remains available as a labeled TxLINE demonstration, but it is not mixed with live onchain statistics.

The current deterministic LMSR remains the execution mechanism. A CLOB is a later expansion, not a prerequisite for a credible first market. Nortia's LMSR already guarantees quotes for new markets, bounds maker loss, supports buys and sells, protects fills with amount guards and deadlines, and routes execution fees to the protocol and liquidity owner.

## Product benchmark

Current large platforms expose separate surfaces for market discovery, public market data, user positions, trade activity, and price history. Polymarket documents separate discovery, data, and trading APIs, including positions, trades, activity, open interest, and price history. Kalshi documents explicit market lifecycle states, market trade history, user fills, and final settlement.

References:

- [Polymarket API overview](https://docs.polymarket.com/api-reference/introduction)
- [Polymarket market data](https://docs.polymarket.com/market-data/overview)
- [Polymarket resolution](https://docs.polymarket.com/concepts/resolution)
- [Kalshi market lifecycle](https://docs.kalshi.com/getting_started/market_lifecycle)
- [Kalshi fills](https://docs.kalshi.com/api-reference/portfolio/get-fills)

Nortia should match those product properties while remaining honest about its different execution model:

| Product property | Large-platform pattern | Nortia implementation |
| --- | --- | --- |
| Discovery | Indexed market catalog with status and categories | Enumerate all Nortia market accounts and verified metadata from Solana |
| Price | Executable order-book or curve price | Latest deterministic LMSR marginal probability |
| History | Public price and trade history | Decode Nortia program events from confirmed market transactions |
| Execution | Quote, fee, size, guard, and transaction state | Exact-share LMSR quote with selectable slippage, payout, profit, and confirmation |
| Portfolio | Holdings, current value, P/L, and redeemability | Wallet-owned position PDAs with probability mark, cash flow, P/L, and claim state |
| Resolution | Rules, source, timing, dispute status, final receipt | Immutable metadata, oracle configuration, phase, and resolution receipt |

## State transition ownership

| Transition | Caller | Incentive | Timeout or fallback |
| --- | --- | --- | --- |
| Create market | Creator | Launch a market and earn liquidity fee share | Transaction is atomic, so failed creation leaves no market |
| Open -> Locked | Any caller or keeper | Stop stale trading and prepare settlement | Trades also enforce `lock_ts`, even if the phase update is delayed |
| Locked -> Resolved by price or sports oracle | Any funded keeper | Position holders and creator benefit from settlement | Hard deadline permits neutral invalid resolution |
| Locked -> Resolving | Bonded proposer | Recover bond after a correct undisputed assertion | Challenge period and hard deadline are immutable |
| Resolving -> Disputed | Challenger | Win the two-bond payout for correcting a bad assertion | Committee arbitration or hard-timeout invalidation |
| Resolving -> Resolved | Any caller or keeper | Proposer recovers bond and users can claim | Hard deadline invalidates an abandoned proposal |
| Disputed -> Resolved | Committee quorum plus submitter | Resolve contested public evidence | Hard deadline returns both bonds and invalidates the market |
| Resolved -> position settled | Position owner | Receive claimable USDC | Pull claim remains available without a platform service |
| Resolved -> liquidity withdrawn | Liquidity owner | Recover surplus and earned fees | Liability reserve prevents early or excessive withdrawal |

## Priority plan

### P0: Truthful live product

1. Add batched RPC discovery for every deployed public LMSR market and deployed private pool.
2. Stop using undeployed fixture cards as if they are markets. Keep only clearly labeled replay demonstrations beside onchain markets.
3. Add a public `/api/markets` endpoint for the normalized live catalog.
4. Decode confirmed program events for each market and expose price history, trades, lifecycle events, settlements, and explorer links.
5. Add a real market detail ledger with History, Activity, and Resolution sections.
6. Make the trading panel show selectable slippage, price impact, potential payout, maximum profit, wallet balance, position balance, and precise lifecycle messages.
7. Add current marked value and unrealized P/L to the wallet portfolio. Final markets continue to use exact contract payout.
8. Add tests for discovery normalization, activity decoding, and position valuation where the existing test frameworks apply.

### P1: Operations and market quality

1. Persist indexed event cursors and history in the service indexer for production RPC efficiency.
2. Add verified and featured market policy outside immutable program state, while preserving permissionless creation.
3. Add duplicate-question detection and creator reputation signals in discovery.
4. Add keeper health, last successful pass, blocked resolver reason, and pending lifecycle actions to operational endpoints.
5. Complete one canonical Pyth devnet flow: create, buy, sell, resolve, claim, and withdraw.
6. Deploy the web application and record a clean-wallet end-to-end demo.

### P2: Exchange expansion

1. Add exact-collateral buys through bounded client search and an onchain minimum-share guard.
2. Add multi-outcome complete-set markets.
3. Add signed limit orders and a batch matcher when real volume justifies a CLOB.
4. Add maker incentives only with anti-wash-volume rules and measurable depth targets.
5. Move production upgrade authority and treasury control to a reviewed multisig and timelock policy.

## Acceptance checks

- Every card labeled onchain is derived from a Nortia program account.
- The live catalog contains no invented volume, traders, prices, or status.
- Every onchain market can be opened by address without a query-string question once metadata is published.
- Price history is reconstructed from `HybridTradeExecuted` events, not decorative points.
- Every activity row links to its confirmed Solana transaction.
- Resolved markets show the final outcome, evidence hash, source account, observation time, and resolver.
- No buy or sell action is enabled at or after lock time or outside `Open`.
- A quote shows fee, price impact, slippage guard, payout, and profit before the wallet prompt.
- Portfolio rows show current marked value and P/L before resolution, then exact payout and final P/L after resolution.
- Contract, client, service, web typecheck, and production build gates pass.
- Changes are committed in logical conventional commits.

## Explicit exclusions for this pass

- No mainnet launch.
- No unsupported UMA or Chainlink claim.
- No invented keeper reward for public LMSR settlement. Position owners, creators, and the operated keeper currently supply the incentive.
- No silent fallback from a failed oracle to another oracle.
- No CLOB implementation before the live data and lifecycle product is complete.

## Completion evidence

- Program commit `91366c0` was built and upgraded on devnet at slot `477624404`.
- Pyth market `Gwg5Q44JVakT3JdNtpJQPeSCCDas4VFJpeY2zmzXQ34h` was created with verified metadata and 6.931474 USDC subsidy.
- A 2 NO-share buy and 0.5 NO-share sell moved the YES probability from 50% to 45.02% and then 46.26%.
- A post-expiry trade was rejected and the keeper confirmed the lock transition.
- Free public Hermes evidence resolved the market NO at the exact `2026-07-20T13:42:00Z` observation.
- The wallet claimed 1.5 USDC, the liquidity owner withdrew 6.209573 USDC, and the market reached `Closed` with zero vault balance.
- The live catalog, detail page, price history, activity ledger, resolution receipt, and explorer signatures reflect the confirmed devnet state.

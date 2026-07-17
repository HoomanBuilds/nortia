# Nortia Institutional Market Engine

- Date: 2026-07-20
- Status: Accepted implementation specification
- Scope: Additive V2 engine for general USDC prediction markets on Solana

## 1. Decision

Nortia V2 will use a deterministic binary LMSR as its protocol-owned liquidity backstop and price curve. The deployed fixed-ticket private pari-mutuel pool remains available as the legacy sports demo. Existing `Market`, `Order`, and `Claim` account layouts will not change.

The V2 architecture has three layers:

1. A continuous, fully collateralized LMSR engine with exact onchain quotes, buy and sell support, bounded market-maker loss, explicit price protection, and trade-time fees.
2. A resolver framework that selects the correct verification and dispute model for each market category.
3. A private frequent-batch gateway that aggregates committed orders before applying net demand to the same LMSR curve. This preserves more order privacy than a sequential private transaction can provide.

The first shippable V2 path is continuous LMSR. Private batches reuse its pricing library and reserve invariants rather than creating a second economic system.

## 2. Why the legacy pool is not enough

The current program accepts one fixed 1 USDC ticket per order. Price does not move during trading, users cannot choose size, positions cannot be sold, and payout is known only after the committee reveals aggregate counts. This is a valid private pari-mutuel pool, but it is not an exchange or an institutional market maker.

V2 must provide:

- Executable marginal and average prices.
- Deterministic price movement after every state transition.
- Variable order sizes.
- Buy and sell flows.
- Max-cost and min-proceeds protection.
- A funded and provably solvent liquidity source.
- Trade history, depth, price impact, and position accounting.
- Fees collected from executed flow.
- Resolver-specific market creation and settlement.
- Permissionless settlement and timeout recovery.

## 3. Mechanism review

### Central limit order book

A CLOB gives professional traders limit orders, maker and taker roles, spread discovery, and capital-efficient peer matching. Polymarket currently uses offchain matching with non-custodial signed orders and atomic onchain settlement.

It is the long-term execution layer for high-volume markets, but it does not guarantee a quote for a new or thin market. It also introduces matcher availability, cancellation races, stale quotes, replay protection, and a larger service surface.

Decision: add signed limit orders and batch crossing after the deterministic AMM is live. Do not make the first V2 market dependent on a centralized matcher.

### Constant-product and fixed-product AMMs

Conditional-token fixed-product AMMs are simple and familiar. However, binary outcome reserves near 0 or 1 create poor capital efficiency, and liquidity providers bear unbounded information loss as better-informed traders move the pool toward the final outcome.

Decision: do not use CPMM or FPMM as Nortia's primary pricing model.

### Sequential LMSR

For outcome quantities `q_yes` and `q_no` and liquidity parameter `b`:

```text
C(q_yes, q_no) = b * ln(exp(q_yes / b) + exp(q_no / b))

p_yes = exp(q_yes / b) / (exp(q_yes / b) + exp(q_no / b))
p_no  = 1 - p_yes

trade_cost = C(q_after) - C(q_before)
```

For a binary market, worst-case market-maker loss is bounded by:

```text
subsidy = b * ln(2)
```

Larger `b` creates deeper liquidity and lower price impact, but requires more locked subsidy. LMSR guarantees a continuous quote and makes creator risk explicit.

Decision: use LMSR as the V2 pricing and liquidity backstop.

### Private batch LMSR

A sequential transaction changes public state immediately. Observers can infer its direction and approximate size from the price change even if the instruction hides the side inside a proof. Sequential LMSR therefore cannot honestly promise private positions.

The privacy-compatible design is a frequent batch:

- Traders commit a side, size, limit price, batch ID, nonce, and refund owner.
- Maximum collateral is escrowed when the commitment is accepted.
- The committee reconstructs orders only after the batch closes.
- Complementary user flow crosses first at one uniform clearing price.
- Only residual net demand moves the LMSR state once per batch.
- Individual allocations are committed in a batch Merkle root.
- Users claim shares or refunds from committed allocations.

The initial batch verifier uses the existing 2-of-3 committee trust model and signed batch root. A later proof circuit can prove deterministic clearing and allocations without trusting committee arithmetic.

Decision: implement continuous V2 first, then the private batch gateway on the same market and math state.

## 4. Numeric representation

No floating-point arithmetic is permitted in settlement-critical code.

### External token units

- Collateral: Circle USDC on Solana.
- USDC decimals: 6.
- Share decimals: 6.
- One whole winning share pays exactly 1 USDC.
- `1_000_000` share units pay `1_000_000` USDC base units.

Outcome positions are program accounts, not freely transferable SPL tokens in V2. This avoids token mint authority and complete-set accounting complexity while preserving exact payout rights.

### Internal math units

- Quantities `q_yes`, `q_no`, `b`: unsigned share base units.
- Transcendental fixed-point scale: `1e12`.
- Probability scale: `1e6`, where `1_000_000` means 100 percent.
- Prices and costs are converted to USDC base units only at the transaction boundary.

The binary cost function is evaluated with stable log-sum-exp:

```text
m = max(q_yes, q_no)
d = abs(q_yes - q_no)
C(q_yes, q_no) = m + b * ln(1 + exp(-d / b))
```

This avoids exponentiating large positive values.

### Rounding policy

- A buy charges the ceiling of raw cost.
- A sell pays the floor of raw proceeds.
- A trading fee is rounded up.
- Settlement payouts are rounded down except for a final bounded remainder path.
- A zero-cost share increase is rejected.
- A sell that returns zero proceeds is rejected.

Rounding always favors protocol solvency. A buy then immediate sell at unchanged external state cannot produce a profit.

### Numeric bounds

- `b` must be between `10 USDC` and `1,000,000 USDC` in share base units.
- A single trade must be at least `0.01` shares.
- A single trade may not exceed the configured per-market maximum.
- `abs(q_yes - q_no) / b` is capped at 20.
- Marginal probability is constrained to the corresponding safe range, approximately 2 parts per billion to 99.9999998 percent internally.
- Account-facing prices are clamped only for display, never for cost accounting.

Exact limits are constants and are covered by boundary tests.

## 5. Collateral and solvency

At initialization, the creator transfers at least:

```text
required_subsidy = ceil(b * ln(2)) + rounding_reserve
```

The subsidy remains locked until the market is fully settled or refunded.

Ignoring separately transferred fees, the market vault invariant is:

```text
vault_balance >= conservative_cost(q_yes, q_no)
conservative_cost(q_yes, q_no) >= max(q_yes, q_no)
```

At resolution, only the winning outstanding quantity is payable. The cost function and subsidy therefore fully collateralize the largest possible winning obligation.

Every state-changing trade checks the post-transfer reserve invariant. Market creation, buys, sells, resolution, claims, and closing all use checked `u128` intermediates before converting to SPL Token `u64` amounts.

## 6. Trading state machine

```text
Draft -> Open -> Locked -> Resolving -> Resolved -> Closed
                   |           |
                   |           `-> Disputed -> Resolved
                   `-> Refunding -> Closed
```

### Draft

- Oracle configuration and canonical rules are validated.
- Creator subsidy is not yet active.
- Market cannot accept trades.

### Open

- Buy and sell are allowed before `lock_ts`.
- Every order includes a deadline and a price guard.
- Oracle configuration and question rules are immutable.

### Locked

- No new trade can execute.
- A permissionless keeper may submit resolution evidence after `resolve_not_before_ts`.

### Resolving

- Deterministic oracle evidence can finalize immediately.
- Optimistic assertions remain challengeable until their liveness period ends.

### Disputed

- Trading remains disabled.
- The configured escalation path determines the outcome.

### Resolved

- Winning positions redeem 1 USDC per share.
- Losing positions redeem zero.
- Settlement keeper reward is capped and paid only for a valid transition.

### Refunding

- Used only when the market was invalid, unsupported, or unresolved past its hard deadline.
- Refund accounting is defined per position and cannot depend on the eventual outcome.

### Closed

- All liabilities are paid or expired under explicit claim rules.
- Remaining rounding reserve and maker surplus can be withdrawn to the configured recipients.

## 7. Trade interface

V2 supports four execution calls:

- `buy_exact_shares(side, shares, max_total_cost, deadline)`
- `buy_exact_collateral(side, collateral, min_shares, deadline)`
- `sell_exact_shares(side, shares, min_net_proceeds, deadline)`
- `quote_trade(side, signed_share_delta)` as shared pure client and program math

The first onchain implementation only needs exact-share buy and sell. Exact-collateral buy can be implemented by bounded binary search in the client and enforced with `min_shares` onchain.

Each quote exposes:

- Current marginal probability.
- Post-trade marginal probability.
- Raw LMSR cost or proceeds.
- Average fill price.
- Price impact.
- Trading fee.
- Total cost or net proceeds.
- Price guard and expiry.

No UI value is called an executable price unless it is calculated from the latest confirmed market account and protected by the transaction arguments.

## 8. Fees and platform revenue

Nortia earns from executed trading volume, not only from final pool settlement.

### V2 fee model

The default taker fee is probability-sensitive:

```text
fee = ceil(shares * base_fee_rate * p * (1 - p))
```

where `p` is the conservative average execution probability at `1e12` scale. The fee is largest near 50 percent, where speculation and liquidity value are greatest, and approaches zero near certain outcomes.

Configuration limits:

- Base fee rate is immutable per market.
- Effective fee is shown before signing.
- The fee cannot exceed the protocol-wide cap.
- A minimum 1 base-unit fee applies only when the computed fee is nonzero.

Default fee distribution:

- 70 percent to the Nortia treasury.
- 30 percent to the liquidity provider or subsidy owner.

This is the implemented continuous LMSR split. A later private-batch release may define a separate solver incentive from its own fee schedule, but it cannot silently change the immutable split of an existing market. No reward is paid for failed, stale, or duplicated work.

The legacy V1 pool retains its existing 1 percent successful-settlement fee.

## 9. Versioned account model

V2 is additive so deployed V1 accounts remain decodable.

### `EngineConfig`

- Protocol authority and pause authority.
- USDC mint and token program.
- Treasury owner.
- Fee caps and default splits.
- Approved resolver programs and bridge programs.
- Version and bump.

### `HybridMarket`

- Version, bump, market ID, creator, and liquidity owner.
- Category, question hash, rules hash, outcome labels hash.
- Trading mode and pricing model.
- `q_yes`, `q_no`, `b`, initial subsidy, rounding reserve.
- Fee rate and distribution snapshot.
- Open, lock, resolve-not-before, challenge, and hard resolution deadlines.
- Phase, outcome, volume, fee totals, and position liabilities.
- Oracle config PDA and final resolution receipt PDA.
- Collateral mint, token program, vault, and settlement counters.

### `OracleConfig`

- Market and resolver kind.
- Pinned source program, queue where applicable, account, feed ID, emitter, or committee set.
- Comparator and normalized threshold.
- Observation timestamp or event identifier.
- Signed 128-bit normalized values preserve 18-decimal custom-feed precision.
- Separate second and slot freshness limits avoid treating chain slots as wall-clock time.
- Confidence, publisher, finality, and challenge parameters.
- Primary and fallback resolver policy.
- Canonical source and rules hashes.

### `Position`

- Market and owner.
- YES and NO share balances.
- Cost basis and realized proceeds for UI accounting.
- Claimed and refund state.

### `ResolutionReceipt`

- Market, resolver kind, outcome, and finalized state.
- Observation value, exponent, timestamp, sequence, confidence, and source ID.
- Evidence hash and source account.
- Proposal, challenge, and finalization timestamps.
- Proposer, challenger, bonds, and dispute reference where applicable.

### `Batch`

- Market, epoch, open and close slots.
- Commitment root and allocation root.
- Aggregate YES and NO deltas.
- Pre-state and post-state cost hashes.
- Uniform clearing price and solver.
- Committee attestations or batch-proof reference.

## 10. Multi-oracle resolver framework

Nortia does not use one oracle for every question. Each resolver has an explicit capability, failure model, and market template.

### Resolver tier A: TxLINE stat validation

Use for:

- World Cup match results.
- Score totals.
- Supported match statistics and deterministic prop conditions.

Verification:

- Pin the TxLINE program ID.
- Bind fixture ID, stat keys, predicate, proof timestamp, and daily root PDA.
- Treat an API sequence as retrieval metadata unless it is included in the TxLINE-verified payload.
- Require the final match state where the market rules require finality.
- CPI into `validate_stat_v2` and validate return-data origin.
- Derive the root PDA from the batch minimum timestamp and enforce final-stat freshness from the fixture summary maximum timestamp.

Status: implemented in V1 and V2 with CPI validation and normalized resolution receipts.

### Resolver tier A: Pyth verified price

Use for:

- Crypto price thresholds.
- Supported equities, FX, metals, indices, and macroeconomic feeds.
- Deterministic above, below, range, or change predicates.

Verification:

- Use a Pyth-owned `PriceUpdateV2` account with full verification.
- Pin the 32-byte feed ID.
- Pin the target observation time and accepted interval.
- Require the unique update that brackets the target time with `prev_publish_time < target <= publish_time`.
- Reject reports whose publish lag from the target exceeds the configured staleness bound.
- Reject prematurely published or future-dated values.
- Normalize the signed price and exponent with checked arithmetic.
- Reject confidence wider than the market's configured maximum.
- Store publish time, confidence, feed ID, price account, and evidence hash.

Timestamped markets should use an ephemeral historical price update for the specified observation time, not an arbitrary current push-feed account. A narrow time window and permissionless keepers reduce selection risk. Rules must state the exact timestamp and comparison semantics.

Push-feed accounts remain useful for low-latency charts and indicative prices. Nortia does not use the continuously updated push account as the settlement primitive for a point-in-time market. The resolver accepts a permissionlessly posted `PriceUpdateV2` for the pinned feed and verifies the unique publish interval around the market timestamp onchain.

Status: implemented in V2 with normalized receipts and invalid-market timeout handling.

Devnet provider policy: `ORACLE_PROVIDER_PROFILE=free` uses the public legacy-compatible Hermes endpoint without forwarding credentials and paces calls below its public rate limit. `managed` retains API-key and custom-origin support behind an explicit switch. Endpoint changes do not relax onchain receiver, feed, timestamp, confidence, or full-verification checks.

### Resolver tier A or B: Switchboard canonical quote

Use for:

- Deterministic custom API values.
- Weather observations from named official stations.
- Public statistics that can be reduced to one numeric value.
- Redundant financial feeds where a custom source set is required.

Verification:

- Pin the official Switchboard devnet queue and canonical quote program.
- Pin the feed hash generated from the source jobs.
- Require a quote-program-owned, single-feed canonical quote PDA derived from the pinned queue and feed hash.
- Reject authority-written quotes and require distinct oracle indices with at least two configured samples.
- Enforce slot age independently from the wall-clock observation window.
- Bind numeric scale, source job definition hash, and predicate.
- Store quote slot, source count, queue, feed hash, signed 18-decimal value, and evidence hash.

A custom feed is only as credible as its source jobs. One HTTP endpoint repeated across several nodes is still one data source.

Switchboard V1 is restricted away from sports and volatile crypto price templates. Pyth handles timestamped crypto prices, while Switchboard is used for finalized custom numeric facts whose source value is stable during the observation window.

Status: implemented in V2 using the official 0.13 quote parser through its Pinocchio-compatible feature set.

### Resolver tier B: native bonded optimistic assertion

Use for:

- Elections and governance outcomes.
- Product launches, court decisions, awards, and other long-tail facts.
- Questions whose truth is publicly verifiable but not represented by a native numeric feed.

Flow:

1. Any proposer posts the outcome, a canonical public evidence URI, and a configured USDC bond after the resolve-not-before time.
2. The assertion enters a fixed challenge window.
3. A challenger posts an equal bond and the opposite binary result.
4. Unchallenged assertions finalize after liveness.
5. Challenged assertions require the existing 2-of-3 Nortia committee to attest a decision before the hard deadline.
6. Resolution records claimable balances without requiring any recipient token account, so a closed or replaced account cannot block market finalization.
7. The winner can claim both bonds minus 5 percent of the losing bond, which the protocol treasury can claim separately.
8. If arbitration misses the hard deadline, the market resolves invalid and both parties can reclaim their bonds.

Security requirements:

- The minimum bond must exceed plausible manipulation profit or the market is rejected.
- Market open interest may not grow above the security budget implied by its resolver bond.
- Rules identify primary sources, cutoff, cancellation semantics, and invalid-market conditions.
- Proposer and challenger cannot be the market creator's privileged admin path.
- Proposal bonds are held in a separate market-authorized SPL Token vault and never mixed with trader collateral.
- Proposal and challenge accounts store HTTPS, IPFS, or Arweave evidence URIs. The program recomputes a domain-separated SHA-256 commitment over the role, market, outcome, and URI so an evidence item cannot be relabeled or replayed.
- Bond claims are replay-safe and may be withdrawn only by the entitled wallet to a USDC token account that wallet owns.
- A proposal cannot be opened unless its complete challenge window ends before the market's hard deadline.
- Sports and crypto templates cannot select this resolver in the current deployment policy.

Status: implemented as a native V2 resolver with replay-safe receipts, permissionless unchallenged finalization, committee arbitration, and invalid-market timeout recovery. The 2-of-3 committee is an explicit trust assumption and remains the arbitration layer until a verified external adapter replaces it. It is not described as UMA unless an actual UMA assertion and verified bridge receipt are used.

### Resolver tier B: UMA over verified cross-chain messaging

Use for:

- Long-tail markets that benefit from UMA's established proposer, disputer, and DVM ecosystem.

Architecture:

1. A pinned Nortia assertion requester contract asks UMA OOv3 on a supported EVM chain.
2. The requester includes Solana market address, question hash, rules hash, asserted outcome, and unique nonce.
3. After UMA finalization, the pinned EVM emitter publishes a normalized result.
4. Wormhole Guardians attest the emitter message.
5. The Solana adapter verifies the posted VAA, emitter chain, emitter address, sequence, payload hash, and replay status.
6. Nortia stores a receipt and resolves exactly once.

UMA's official network information does not list a native monitored Solana Optimistic Oracle. A relayer signature alone is insufficient. Until the requester, emitter, bridge verification, and dispute monitoring are deployed, this adapter remains disabled.

Status: planned adapter, not falsely presented as live.

### Resolver tier C: Chainlink data and CRE adapter

Use for:

- High-frequency crypto price reports.
- Sports, macroeconomic, and specialized data when an SVM-verifiable report or a pinned cross-chain workflow is available.

Chainlink currently markets prediction-market resolution across crypto, sports, and macro data and supports Solana cross-chain infrastructure. Nortia must still verify the exact report format, SVM verifier deployment, data source, and program address before enabling a market template.

Status: research and partner integration path. No generic API-based Chainlink claim is allowed.

## 11. Oracle selection by category

| Category | Primary resolver | Optional fallback | Rejected when |
| --- | --- | --- | --- |
| World Cup sports | TxLINE stat V2 | None in current V2 | Fixture or predicate is unsupported |
| Other sports | Disabled until a reviewed sports adapter exists | None | No canonical final source is named |
| Crypto price | Pyth verified price | None in current V2 | Feed ID, timestamp, or confidence policy is missing |
| Equities, FX, metals | Pyth verified price | Switchboard stable quote | Market-hours and corporate-action rules are missing |
| Macroeconomic data | Pyth supported feed or Switchboard stable quote | Bonded optimistic | Release vintage and revision policy are missing |
| Weather | Switchboard multi-source official station feed | Bonded optimistic | Station, unit, observation window, or missing-data rule is absent |
| Elections and politics | Bonded optimistic | UMA bridge is planned | Certification source and recount rules are ambiguous |
| Governance | Bonded optimistic | Native onchain adapter is planned | Target program and proposal ID are not pinned |
| Technology and culture | Bonded optimistic | UMA bridge is planned | The question depends on subjective interpretation |

## 12. Oracle safety invariants

- A market pins one primary resolver configuration before trading opens.
- Resolver configuration cannot be changed after activation.
- An evidence item is bound to one market and cannot be replayed.
- Observation time must be at or after the market's resolution boundary.
- Evidence after the hard deadline is rejected unless the market rules explicitly allow delayed certification.
- Price confidence, sample count, variance, staleness, and finality constraints are checked onchain.
- A fallback resolver can activate only after a deterministic timeout or explicit primary failure condition.
- Primary and fallback results cannot race. The first valid final receipt atomically locks resolution.
- A disputed optimistic result cannot pay claims.
- The maximum economically stealable payout must not exceed the oracle's configured security budget.
- An unavailable oracle leads to a defined refund or fallback path, never an administrator-selected result.

## 13. Market creation policy

Open-ended text creation is unsafe. V2 creation uses reviewed templates.

A template defines:

- Category and resolver kind.
- Question grammar and outcome labels.
- Allowed comparator and numeric scale.
- Source ID or source-selection policy.
- Trading cutoff relative to observation time.
- Resolution and challenge windows.
- Cancellation, postponement, revision, tie, and invalid-market rules.
- Minimum liquidity, maximum open interest, and oracle security budget.

The web may let a creator fill template parameters, but it cannot create an actionable market if the resulting oracle configuration is unsupported.

## 14. MEV and stale-state controls

- Every transaction has a short expiry.
- Buys specify maximum total cost.
- Sells specify minimum net proceeds.
- Quotes display the slot and account state they were calculated from.
- The contract recomputes cost from current state and rejects a violated guard.
- Transactions may use private RPC or bundle submission, but correctness does not depend on it.
- Large trades can be capped or routed to batch execution.
- Oracle settlement is disabled while trading is open.
- A keeper cannot select among multiple valid observations outside the configured observation rule.
- Batch orders use commit then reveal and a uniform clearing rule to reduce ordering advantage.

## 15. Testing and assurance

### Pricing unit tests

- Golden vectors generated from high-precision reference arithmetic.
- Symmetry between YES and NO.
- `p_yes + p_no` equals one within one probability unit.
- Price monotonicity under same-side buys and sells.
- Path independence of raw LMSR cost within conservative rounding bounds.
- Buy then sell cannot profit.
- Cost is always at least `max(q_yes, q_no)` after subsidy.
- Worst-case maker loss never exceeds subsidy plus rounding reserve.
- All min, max, zero, and overflow boundaries.

### Fuzz and invariant tests

- Random sequences of buys and sells.
- No position can become negative.
- Vault balance always covers winning liability.
- Fees never reduce collateral below raw LMSR cost.
- Total user shares equal aggregate outcome quantities.
- Resolved payout total cannot exceed vault balance.
- Terminal states reject trading and second resolution.

### Oracle tests

- Wrong owner, program, feed ID, emitter, or queue.
- Stale, future, early, late, partial, or low-finality evidence.
- Excess Pyth confidence or Switchboard variance.
- Too few source samples.
- Decimal exponent overflow and threshold boundary equality.
- Duplicate and replayed receipts.
- Competing primary and fallback resolution transactions.
- Optimistic proposal, challenge, liveness, bond, and arbitration failures.
- Bridge message from wrong chain or emitter.

### Integration tests

- Create, fund, trade, lock, resolve, claim, and close.
- Sell partial and full positions.
- Concurrent quote becomes stale and fails safely.
- Pyth devnet price resolution.
- Switchboard devnet custom quote resolution.
- TxLINE replay and live proof paths.
- Oracle timeout refund.

## 16. Deployment policy

- Preserve the current program ID and legacy accounts only if the upgrade remains additive and passes account compatibility tests.
- Publish exact program binary hash, upgrade authority, IDL hash, oracle program IDs, feed IDs, and market addresses.
- Create a new canonical V2 market after upgrade.
- Do not migrate legacy pool balances into V2.
- Do not enable UMA, Chainlink, or Switchboard badges until the corresponding verified adapter and devnet receipt are demonstrable.
- Mainnet remains out of scope until independent contract and economic review.

## 17. References

- Robin Hanson, Logarithmic Market Scoring Rules: https://hanson.gmu.edu/mktscore.pdf
- Complexity of LMSR: https://lance.fortnow.com/papers/files/LMSR.pdf
- Gnosis LMSR implementation: https://github.com/gnosis/conditional-tokens-market-makers/blob/master/contracts/LMSRMarketMaker.sol
- Polymarket CLOB overview: https://docs.polymarket.com/trading/overview
- Polymarket prices and order book: https://docs.polymarket.com/concepts/prices-orderbook
- Polymarket fees: https://docs.polymarket.com/trading/fees
- Pyth Solana integration: https://docs.pyth.network/price-feeds/core/use-real-time-data/pull-integration/solana
- Pyth Solana push feeds: https://docs.pyth.network/price-feeds/core/push-feeds/solana
- Pyth integration safety: https://docs.pyth.network/price-feeds/core/best-practices
- Switchboard Solana integration: https://docs.switchboard.xyz/docs-by-chain/solana-svm
- Switchboard custom feeds: https://docs.switchboard.xyz/custom-feeds/build-and-deploy-feed/deploy-feed
- UMA network information: https://docs.uma.xyz/resources/network-addresses
- UMA optimistic oracle overview: https://docs.uma.xyz/
- Wormhole Solana core program: https://wormhole.com/docs/products/messaging/reference/core-contract-solana/
- Chainlink prediction markets: https://chain.link/use-cases/prediction-markets
- Solana program numeric limitations: https://solana.com/docs/programs/limitations

# Nortia Hybrid LMSR and Oracle Implementation Plan

- Date: 2026-07-20
- Source specification: `docs/specs/2026-07-20-institutional-market-engine.md`
- Delivery rule: each phase must pass its own tests and be committed before the next phase changes protocol state.

## Phase 1: deterministic market math

- Add a pinned integer-only fixed-point math dependency for the Rust program.
- Implement stable binary LMSR cost, marginal probability, exact-share buy, exact-share sell, and probability-sensitive fee calculations.
- Port the same quote contract to the TypeScript client with integer arithmetic.
- Add high-precision golden vectors shared by Rust and TypeScript.
- Add boundary, monotonicity, symmetry, round-trip, path, bounded-loss, and overflow tests.
- Measure linked Solana program size and quote compute usage.

Exit gate:

- Rust and TypeScript return the same base-unit quote for every golden vector.
- Conservative rounding and subsidy solvency properties pass randomized sequences.
- No float exists in settlement-critical code.

Commit: `feat: add deterministic LMSR pricing`

## Phase 2: additive V2 protocol state

- Add separate `EngineConfig`, `HybridMarket`, `OracleConfig`, `Position`, and `ResolutionReceipt` accounts.
- Add V2 PDA namespaces so no V1 account address changes.
- Add V2 initialization with creator-funded `ceil(b * ln(2))` subsidy and rounding reserve.
- Add exact-share buy and sell instructions with deadline and price guards.
- Add fee routing and immutable fee split snapshots.
- Add market lock, generic resolved state, claim, close, and timeout refund transitions.
- Emit complete market, quote, trade, fee, oracle, and claim events.

Exit gate:

- Legacy IDL account layouts remain byte-for-byte compatible.
- V2 unit tests and randomized trade invariants pass.
- Vault solvency is asserted after every value-moving instruction.
- Unauthorized, stale, replayed, and terminal-state calls fail.

Commit: `feat: add collateralized LMSR markets`

## Phase 3: resolver framework

Status: complete in the program, pending service and web integration.

- Add immutable resolver configuration and normalized observation comparison.
- Refactor the current TxLINE handler behind the V2 receipt format without changing V1 behavior.
- Add Pyth `PriceUpdateV2` verification, feed binding, publish-time window, full verification, exponent normalization, and confidence policy.
- Add Switchboard canonical quote verification, feed hash, queue, sample, and slot-age policy.
- Add the native bonded optimistic proposal, challenge, finalization, timeout, and pull-claim state machine.
- Add disabled configuration variants for UMA-over-Wormhole and Chainlink until their verified source programs are deployed.

Exit gate:

- TxLINE, Pyth, and Switchboard produce the same normalized receipt shape.
- Every resolver passes wrong-owner, wrong-ID, stale, replay, timing, and bounds tests.
- An unsupported resolver cannot create an open market.
- A challenged assertion cannot resolve or pay claims.

Commits:

- `feat: add Pyth price resolution`
- `feat: add TxLINE hybrid resolution`
- `refactor: widen oracle precision`
- `feat: add Switchboard quote resolution`
- `feat: add bonded optimistic resolution`

## Phase 4: service and client integration

- Extend the client with V2 PDA derivation, account decoding, exact quotes, transaction builders, and receipt decoding.
- Add oracle registry and market-template configuration to services.
- Add Pyth Hermes update retrieval and price-account transaction composition.
- Add Switchboard managed update retrieval for configured devnet feeds.
- Add permissionless keeper jobs for lock, evidence submission, optimistic finalization, and timeout refunds.
- Extend the indexer with trades, positions, fees, liquidity, price points, oracle proposals, disputes, and receipts.

Exit gate:

- Services never hold user wallet keys.
- Keeper retries are idempotent and receipt replay-safe.
- Indexed price and volume reconstruct exactly from events and accounts.
- API responses identify live, simulated, and unavailable resolver data.

Commit: `feat: integrate LMSR market services`

## Phase 5: institutional web experience

- Replace fixed-ticket controls on V2 markets with size input and buy or sell mode.
- Show executable current and post-trade probability, average fill, price impact, fee, total, price guard, and quote slot.
- Add depth curve, volume, trade tape, liquidity, and outcome position panels.
- Add market creation from reviewed resolver templates.
- Add resolver badges with evidence level, source, freshness, challenge state, and fallback.
- Keep V1 private pool UI explicitly labeled as a legacy private pool.
- Make sports, crypto, macro, politics, technology, culture, governance, and weather discovery first-class without enabling unsupported trades.

Exit gate:

- All wallet states, insufficient balance, approval, rejected signature, stale quote, failed trade, locked market, disputed resolution, claim, and refund flows are represented.
- Market, portfolio, proof, creation, and detail layouts share one width and type scale.
- Mobile and desktop have no overflow or clipped controls.
- No displayed number is hard-coded when a live account value exists.

Commit: `feat: build institutional market trading UI`

## Phase 6: private frequent batches

- Extend private order circuits with side, quantity, limit price, batch ID, nonce, and refund owner.
- Escrow maximum collateral with committed orders.
- Implement deterministic complementary crossing and uniform clearing.
- Apply only residual aggregate demand to the LMSR state.
- Commit allocation root, aggregate deltas, cost transition, and committee quorum onchain.
- Add proof-bound allocation claims and unused-collateral refunds.
- Document the 2-of-3 committee arithmetic trust until a batch-settlement proof circuit replaces it.

Exit gate:

- Individual side and size are not revealed by a one-order state transition.
- Batch totals, allocations, escrow, shares, and refunds conserve value.
- No allocation violates its committed limit.
- Solver and committee cannot replay or reorder a finalized batch.

Commit: `feat: add private LMSR batch execution`

## Phase 7: deploy and verify

- Run formatting, Clippy correctness gates, Rust tests, TypeScript tests, service tests, web typecheck, production build, Anchor build, and local validator lifecycle.
- Check dependency advisories and program binary size.
- Verify V1 account decoding against the existing devnet accounts before upgrade.
- Upgrade the existing devnet program only after all additive compatibility checks pass.
- Deploy and fund one canonical V2 LMSR market.
- Resolve at least one Pyth devnet market and one TxLINE replay market.
- Deploy a Switchboard example only when a canonical quote and credentials are available.
- Update IDLs, deployment manifest, README, technical docs, and demo evidence.

Exit gate:

- A fresh wallet can create or use a covered market, trade, observe price movement, lock, resolve from verified evidence, and claim on devnet.
- Explorer links and receipt fields verify every critical transition.
- Disabled integrations are labeled planned, not live.

Commits:

- `test: harden LMSR and oracle lifecycle`
- `chore: deploy Nortia V2 to devnet`

# Nortia General Market Platform

Date: 2026-07-19

## Positioning

Nortia is a private prediction market protocol on Solana. It is not limited to sports. Markets share one USDC escrow and private-order lifecycle, while resolution is supplied by a registered resolver adapter.

The first connected adapter is TxLINE for cryptographically verified sports results. This satisfies the hackathon requirement and proves the adapter model with a difficult real-time data source.

## Core market model

Every market is binary and stores:

- Market ID and creator.
- Category and canonical question hash.
- Canonical rules hash and final settlement evidence hash.
- Open, lock, batch, and resolution deadlines.
- Fixed USDC ticket amount and fee basis points.
- Resolver kind and immutable resolver configuration hash.
- Committee and verifier references inherited from protocol configuration.
- Order counts, aggregate counts, commitment root, outcome, pool economics, and claim totals.

The first deployment charges one percent of a successfully settled gross pool. By default, 90 percent of that fee is Nortia treasury revenue and 10 percent rewards the resolver keeper. One-sided, timed-out, cancelled, and invalid markets return complete tickets with no fee.

The core knows how to accept valid private tickets, hold collateral, accept a threshold aggregate, account for a binary outcome, pay claims, and refund. It does not decide whether an external event happened.

## Resolver contract

A resolver must produce a normalized receipt with:

- Market address.
- Binary outcome.
- Source program or authority.
- Source event identifier.
- Source sequence or round.
- Observation timestamp.
- Evidence root.
- Resolver configuration hash.

The receipt is accepted only if its configuration hash matches the immutable market configuration.

## Connected resolver

### TxLINE sports

- Source: TxLINE score feed and Solana validation program.
- Supported initial condition: participant one goals plus participant two goals greater than a configured threshold.
- Final record requirement: `action=game_finalised`, `statusId=100`, and `period=100`.
- Proof path: score snapshot or stream record, stat-validation payload, daily score root PDA, TxLINE `validate_stat_v2` CPI, normalized Nortia receipt.
- Failure path: no valid final proof by the resolution deadline opens fee-free refunds.

## Future resolver interface

The market core is designed to accept additional reviewed adapters without changing escrow or claim logic. Likely categories include price thresholds, governance outcomes, public data, weather, and optimistic assertions. Each requires its own source-specific finality, freshness, dispute, and fallback specification before it can be enabled.

Nortia does not treat a generic API response, creator signature, or admin button as a trustless resolution source.

## Discovery model

The web index normalizes all categories into:

- Category.
- Question and outcome labels.
- Resolver badge.
- Open, live, locked, resolving, resolved, refunding, or closed state.
- USDC pool and aggregate implied probability.
- Volume and participant count.
- Resolution evidence and explorer references.

The category navigation may show the complete product taxonomy, but only markets backed by a connected resolver are actionable.

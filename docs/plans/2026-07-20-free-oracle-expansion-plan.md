# Free oracle expansion implementation plan

## Phase 1: Contract safety

- Append Economics and Science market categories without changing existing discriminants.
- Permit Pyth only for Crypto and Economics.
- Accept either pinned Pyth receiver accounts or canonical sponsored push accounts.
- Append the Stork resolver variant and implement exact account, PDA, feed, timestamp, and value validation.
- Add boundary, wrong-owner, wrong-PDA, wrong-feed, stale, future, non-positive, and incompatible-category tests.

## Phase 2: Shared registry

- Replace the three-feed constant with normalized oracle feed types and a curated fallback.
- Add the 47 official Solana sponsored Pyth IDs and category mappings.
- Add Hermes catalog normalization, deprecation filtering, asset-class filtering, deterministic sorting, and capped search results.
- Add Switchboard and Stork configuration helpers and tests.

## Phase 3: Keeper and access profiles

- Resolve sponsored Pyth feeds directly from canonical shard-0 accounts.
- Keep Hermes pull settlement for the full Pyth catalog.
- Add Switchboard stored-feed validation and managed update transaction composition.
- Add optional Stork token configuration and explicit readiness reporting.
- Extend lifecycle and indexer resolver names and receipts.

## Phase 4: Category-aware web creation

- Start with category selection and show only compatible resolvers.
- Add debounced Pyth feed search with asset-class tabs and a selected-feed detail panel.
- Show quote currency, schedule, delivery mode, key requirement, and timeout behavior.
- Add Switchboard stored-feed configuration with feed-hash validation.
- Add Stork as visible but disabled until service readiness confirms access.
- Expand bonded-fact templates to Economics and Science.
- Preserve wallet preflight, transaction stages, immutable metadata, mobile layout, and real devnet submission.

## Phase 5: Verification and release

- Sync generated IDLs after contract changes.
- Run Rust tests, Clippy with warnings denied, Anchor build, client tests and typecheck, service tests and typecheck, and web typecheck and production build.
- Review the program binary size and exact devnet upgrade balance.
- Commit each logical unit with a one-line conventional commit.
- Transfer deployment SOL only after the user confirms the exact amount from the dedicated wallet.
- Deploy the current program, initialize the engine, create at least one price market, and record addresses and transaction signatures.

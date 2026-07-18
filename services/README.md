# Nortia services

This workspace keeps network and automation responsibilities outside the web application.

- `txline/` authenticates snapshots, historical scores, SSE data, and V2 proof payloads.
- `indexer/` reads Nortia market accounts and emits a normalized discovery snapshot.
- `committee/` runs one share-validation member per process with durable local state.
- `pyth/` catalogs financial feeds, validates timestamped Hermes updates, and consumes sponsored push accounts.
- `switchboard/` validates stored feed definitions and composes managed quote updates with resolution.
- `stork/` lists token-gated assets and validates exact signed asset metadata for the external chain pusher.
- `keeper/` executes V1 and V2 locking, TxLINE, Pyth, Switchboard, optimistic, and timeout transitions.

Run three committee processes with distinct `COMMITTEE_MEMBER_INDEX`, port, key material, and state paths. The current hackathon profile keeps committee signing operator-managed. Production should move signer keys into isolated remote signers or HSMs.

The keeper defaults to dry-run. Set `KEEPER_DRY_RUN=false` only after the Nortia program, protocol account, verifier programs, treasury token account, and required resolver credentials are configured on the same Solana cluster.

Pyth configuration:

- `ORACLE_PROVIDER_PROFILE` defaults to `free` for the devnet demo.
- The `free` profile pins Pyth to `https://hermes.pyth.network`, never forwards credentials, paces requests at least 1.1 seconds apart, pins Switchboard to its public Crossbar, and leaves Stork disabled.
- Set `ORACLE_PROVIDER_PROFILE=managed` to enable `PYTH_API_KEY`, `PYTH_HERMES_ORIGIN`, `SWITCHBOARD_CROSSBAR_ORIGIN`, `STORK_REST_ORIGIN`, and `STORK_API_TOKEN`. The managed profile fails startup without a Pyth key and rejects non-HTTPS provider origins.
- `PYTH_COMPUTE_UNIT_PRICE_MICROLAMPORTS` defaults to `50000`.
- `SWITCHBOARD_COMPUTE_UNIT_PRICE_MICROLAMPORTS` defaults to `50000`.

The 47 sponsored Pyth feeds resolve directly from canonical shard-0 push accounts and do not need Hermes credentials. Other Pyth feeds use a fully verified timestamped Hermes update, which is posted and consumed in the Nortia resolution sequence before its temporary account is closed.

TxLINE's hackathon credentials remain separate from the oracle provider profile because the free event access still uses authenticated API requests. Switchboard public Crossbar needs no API key for low-volume use, though authenticated upstream jobs can require protected variables. Stork requires `STORK_API_TOKEN` and an external Stork chain pusher to update the canonical Solana account before the keeper resolves it.

The indexer emits schema version 2 with backward-compatible `markets` for V1 pools and `hybridMarkets` for V2. V2 entries preserve token amounts as integer strings and include LMSR probability, current vault balance, oracle configuration, lifecycle state, fee totals, trader count, verified immutable metadata, and the resolution receipt when present. Metadata is omitted unless its question, rules, and outcome labels match the hashes committed by the market account.

# Nortia services

This workspace keeps network and automation responsibilities outside the web application.

- `txline/` authenticates snapshots, historical scores, SSE data, and V2 proof payloads.
- `indexer/` reads Nortia market accounts and emits a normalized discovery snapshot.
- `committee/` runs one share-validation member per process with durable local state.
- `pyth/` validates timestamped Hermes updates and composes fully verified Solana receiver transactions.
- `keeper/` executes V1 and V2 locking, TxLINE, Pyth, Switchboard, optimistic, and timeout transitions.

Run three committee processes with distinct `COMMITTEE_MEMBER_INDEX`, port, key material, and state paths. The current hackathon profile keeps committee signing operator-managed. Production should move signer keys into isolated remote signers or HSMs.

The keeper defaults to dry-run. Set `KEEPER_DRY_RUN=false` only after the Nortia program, protocol account, verifier programs, treasury token account, and required resolver credentials are configured on the same Solana cluster.

Pyth configuration:

- `ORACLE_PROVIDER_PROFILE` defaults to `free` for the devnet demo.
- The `free` profile pins Pyth to `https://hermes.pyth.network`, never forwards `PYTH_API_KEY`, paces requests at least 1.1 seconds apart, and pins Switchboard to its public Crossbar.
- Set `ORACLE_PROVIDER_PROFILE=managed` to enable `PYTH_API_KEY`, `PYTH_HERMES_ORIGIN`, and `SWITCHBOARD_CROSSBAR_ORIGIN`. The managed profile fails startup without a Pyth key and rejects non-HTTPS provider origins.
- `PYTH_COMPUTE_UNIT_PRICE_MICROLAMPORTS` defaults to `50000`.

Pyth push accounts are intended for current UI prices. V2 settlement fetches the update at the configured market timestamp, posts it with full verification, consumes it in the Nortia resolution instruction, and closes temporary update accounts when the transaction sequence succeeds.

TxLINE's hackathon credentials remain separate from the oracle provider profile because the free event access still uses authenticated API requests. The Switchboard adapter verifies canonical devnet quote accounts onchain; its Crossbar origin is retained for managed update tooling and can be switched without changing settlement rules.

The indexer emits schema version 2 with backward-compatible `markets` for V1 pools and `hybridMarkets` for V2. V2 entries preserve token amounts as integer strings and include LMSR probability, current vault balance, oracle configuration, lifecycle state, fee totals, trader count, verified immutable metadata, and the resolution receipt when present. Metadata is omitted unless its question, rules, and outcome labels match the hashes committed by the market account.

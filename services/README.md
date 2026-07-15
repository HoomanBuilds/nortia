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

- `PYTH_HERMES_ORIGIN` defaults to `https://pyth.dourolabs.app/hermes`.
- `PYTH_API_KEY` is optional until the selected Hermes endpoint requires authentication.
- `PYTH_COMPUTE_UNIT_PRICE_MICROLAMPORTS` defaults to `50000`.

Pyth push accounts are intended for current UI prices. V2 settlement fetches the update at the configured market timestamp, posts it with full verification, consumes it in the Nortia resolution instruction, and closes temporary update accounts when the transaction sequence succeeds.

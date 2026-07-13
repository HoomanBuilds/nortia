# Nortia services

This workspace keeps network and automation responsibilities outside the web application.

- `txline/` authenticates snapshots, historical scores, SSE data, and V2 proof payloads.
- `indexer/` reads Nortia market accounts and emits a normalized discovery snapshot.
- `committee/` runs one share-validation member per process with durable local state.
- `keeper/` plans every lifecycle transition and executes timeout refunds or TxLINE resolution.

Run three committee processes with distinct `COMMITTEE_MEMBER_INDEX`, port, key material, and state paths. The current hackathon profile keeps committee signing operator-managed. Production should move signer keys into isolated remote signers or HSMs.

The keeper defaults to dry-run. Set `KEEPER_DRY_RUN=false` only after the Nortia program, protocol account, verifier programs, treasury token account, and TxLINE credentials are configured on the same Solana cluster.

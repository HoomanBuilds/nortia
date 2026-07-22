# Nortia services

This workspace keeps network and automation responsibilities outside the web application.

- `txline/` authenticates snapshots, historical scores, SSE data, and TxLINE stat-proof payloads.
- `indexer/` reads Nortia market accounts and emits a normalized discovery snapshot.
- `committee/` runs one encrypted share-validation member per process with durable encrypted state.
- `prover/` provides the optional authenticated hosted proving fallback.
- `relayer/` submits private-pool redemptions to fresh recipient addresses without using the order wallet as the onchain sender.
- `pyth/` catalogs financial feeds, validates timestamped Hermes updates, and consumes sponsored push accounts.
- `switchboard/` validates stored feed definitions and composes managed quote updates with resolution.
- `stork/` lists token-gated assets and validates exact signed asset metadata for the external chain pusher.
- `keeper/` executes private-pool and LMSR locking, TxLINE, Pyth, Switchboard, optimistic, and timeout transitions.

Run three committee processes with distinct `COMMITTEE_MEMBER_INDEX`, port, API token, RSA encryption key material, state key, and state path. Generate each RSA key file with `npm run committee:keys -- <1|2|3> <output-path>`, set its mode to owner-only, and point that process at it with `COMMITTEE_ENCRYPTION_KEY_PATH`. Encrypt each member's state under a distinct `COMMITTEE_STATE_KEY`. The coordinator receives the three ordered tokens through `COMMITTEE_API_TOKENS`. The bootstrap profile keeps committee signing operator-managed. Production should move signer keys into isolated remote signers or HSMs.

Create a dedicated relay key with `npm run relayer:key -- <output-path>`, then run the relay with that funded devnet keypair at `NORTIA_RELAYER_KEYPAIR_PATH`, a separate `RELAYER_API_TOKEN`, and `RELAYER_PORT`. It receives public proof material and the recipient address, but no private witness. It remains a metadata and availability boundary.

The keeper defaults to dry-run. Set `KEEPER_DRY_RUN=false` only after the Nortia program, protocol account, verifier programs, treasury token account, and required resolver credentials are configured on the same Solana cluster.

Pyth configuration:

- `ORACLE_PROVIDER_PROFILE` defaults to `free` for the devnet demo.
- The `free` profile pins Pyth to `https://hermes.pyth.network`, never forwards credentials, paces requests at least 1.1 seconds apart, pins Switchboard to its public Crossbar, and leaves Stork disabled.
- Set `ORACLE_PROVIDER_PROFILE=managed` to enable `PYTH_API_KEY`, `PYTH_HERMES_ORIGIN`, `SWITCHBOARD_CROSSBAR_ORIGIN`, `STORK_REST_ORIGIN`, and `STORK_API_TOKEN`. The managed profile fails startup without a Pyth key and rejects non-HTTPS provider origins.
- `PYTH_COMPUTE_UNIT_PRICE_MICROLAMPORTS` defaults to `50000`.
- `SWITCHBOARD_COMPUTE_UNIT_PRICE_MICROLAMPORTS` defaults to `50000`.

The 47 sponsored Pyth feeds resolve directly from canonical shard-0 push accounts and do not need Hermes credentials. Other Pyth feeds use a fully verified timestamped Hermes update, which is posted and consumed in the Nortia resolution sequence before its temporary account is closed.

TxLINE's hackathon credentials remain separate from the oracle provider profile because the free event access still uses authenticated API requests. Switchboard public Crossbar needs no API key for low-volume use, though authenticated upstream jobs can require protected variables. Stork requires `STORK_API_TOKEN` and an external Stork chain pusher to update the canonical Solana account before the keeper resolves it.

The indexer emits its initial canonical schema with `privateMarkets` for private pools and `publicMarkets` for LMSR markets. Public-market entries preserve token amounts as integer strings and include probability, current vault balance, oracle configuration, lifecycle state, fee totals, trader count, verified immutable metadata, and the resolution receipt when present. Metadata is omitted unless its question, rules, and outcome labels match the hashes committed by the market account.

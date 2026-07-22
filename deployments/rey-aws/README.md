# Rey AWS deployment

Nortia uses versioned releases under `/home/ubuntu/nortia/releases` and persistent secrets and state under `/home/ubuntu/nortia/shared`.

The stack uses the following isolated units:

- `nortia-keeper.service`
- `nortia-indexer.service`
- `nortia-committee@1.service`
- `nortia-committee@2.service`
- `nortia-committee@3.service`
- `nortia-prover.service`
- `nortia-relayer.service`

The committee, prover, and redemption relay listen only on localhost. Caddy publishes narrowly scoped HTTPS paths through `nortia-api.15-135-178-84.sslip.io` while preserving the VM's unrelated proxy routes.

The keeper and relay use separate funded devnet signers. The prover runs only with proving artifacts that match the verifier programs pinned by the deployed Nortia protocol.

Private proof circuit sources and generated proving artifacts live under `/home/ubuntu/nortia/shared/prover`. This persistent path keeps the prover independent from versioned application releases. All proving artifacts and the prover API token must use mode `0600` and remain outside Git.

Each committee member and the relay run under separate system users with group-scoped credentials. Committee state is encrypted at rest and writable only by its owning member. This process isolation reduces accidental cross-service exposure, but the single VM root operator remains able to access all three committee identities and is therefore an explicit privacy trust boundary.

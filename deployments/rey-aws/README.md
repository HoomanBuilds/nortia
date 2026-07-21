# Rey AWS deployment

Nortia uses versioned releases under `/home/ubuntu/nortia/releases` and persistent secrets and state under `/home/ubuntu/nortia/shared`.

The stack uses the following isolated units:

- `nortia-keeper.service`
- `nortia-indexer.service`
- `nortia-committee@1.service`
- `nortia-committee@2.service`
- `nortia-committee@3.service`
- `nortia-prover.service`

The committee and prover listen only on localhost. Caddy publishes narrowly scoped HTTPS paths through `nortia-api.15-135-178-84.sslip.io`.

The keeper must remain in dry-run until a dedicated funded devnet signer is mounted and verified. The prover must remain disabled unless the proving keys match the verifier programs pinned by the deployed Nortia protocol.

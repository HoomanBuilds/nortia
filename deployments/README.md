# Deployments

`devnet.json` is the canonical machine-readable record for the Solana devnet deployment. It contains only public addresses, protocol configuration, account metadata, confirmed transaction signatures, and the latest V2 upgrade preflight.

The deployment includes:

- The Nortia Anchor program.
- Separate Sunspot-generated placement and redemption verifier programs.
- A protocol PDA pinned to Circle devnet USDC, a 1% success fee, a 10% keeper share of that fee, and the named 2-of-3 committee.
- A real TxLINE-covered replay market that remains open through July 27, 2026.

Run `scripts/deploy-devnet.sh` to reproduce program and protocol deployment. Run `npm --prefix services run deploy:replay-market` with `NORTIA_KEYPAIR_PATH` configured to create or verify the canonical sample market.

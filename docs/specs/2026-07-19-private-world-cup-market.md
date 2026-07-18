# Superseded Private Market Specification

This file is retained only to preserve the original design history.

The specification was superseded on 2026-07-19 after the full reference-repository audit, current TxODDS hackathon review, current TxLINE devnet IDL review, and Circle USDC verification.

The current private market design is split into focused specifications:

- `docs/specs/2026-07-19-system-architecture.md`
- `docs/specs/2026-07-19-solana-program-and-economics.md`
- `docs/specs/2026-07-19-txline-integration.md`
- `docs/specs/2026-07-19-privacy-and-proof.md`
- `docs/specs/2026-07-19-web-and-services.md`

The approved market is a fixed-ticket USDC pari-mutuel pool for total goals over 2.5. It charges a one-percent protocol fee only after successful settlement, returns full tickets on refund paths, verifies placement and redemption proofs on Solana, and uses TxLINE stat validation for the final result.

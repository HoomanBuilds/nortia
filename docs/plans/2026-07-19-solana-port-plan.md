# Moros Cup Solana Port Plan

- Date: 2026-07-19
- Spec: `docs/specs/2026-07-19-private-world-cup-market.md`

## Phase 1: Project scaffold

- Initialize the Anchor 1.0 workspace and Rust tests.
- Add the Noir placement and redeem circuit packages.
- Pin the Solana Foundation example versions: Noir `1.0.0-beta.13` and Sunspot `1.0.0`.
- Add a TypeScript client package for proof construction and TxLINE payloads.

Acceptance:

- `anchor build` compiles the market program.
- `nargo test` passes for both circuits.

## Phase 2: Market state machine

- Implement market, vault, and order accounts.
- Implement create, place, batch, refund-mode, and refund instructions.
- Enforce fixed ticket size, deadlines, committee quorum, and one-way phases.
- Add unit tests for every phase boundary and error path.

Acceptance:

- Invalid phases, duplicate commitments, duplicate committee signers, count mismatches, early batching, and late orders are rejected.
- Timeout refunds return exactly one ticket and cannot be repeated.

## Phase 3: ZK verification

- Implement public witness parsing and field binding.
- CPI into the Sunspot placement verifier before escrow.
- Implement commitment root and nullifier state needed by redemption.
- CPI into the redeem verifier and pay the proof-bound recipient.

Acceptance:

- Valid proofs succeed.
- Mutating market, payer, ticket amount, commitment, outcome, root, nullifier, recipient, or payout makes the transaction fail.

## Phase 4: TxLINE settlement

- Vendor the minimum official V2 data types from the TxLINE devnet IDL.
- Validate fixture, score keys, finalized period, and root account ownership.
- Build and invoke `validate_stat_v2` with the fixed home-win strategy.
- Read the returned boolean and resolve the market exactly once.

Acceptance:

- A mocked valid TxLINE return resolves YES or NO.
- Wrong fixture, wrong stat key, non-final score period, wrong program, and malformed return data fail.

## Phase 5: Committee and client flow

- Generate placement inputs and threshold shares in the client.
- Add committee endpoints that validate share commitments and aggregate batches.
- Build transactions with two distinct committee signers.
- Add a TxLINE proof fetcher for the configured fixture and final score sequence.

Acceptance:

- A three-order local run hides each side from one committee member and reconstructs the correct aggregate with two members.
- The batch transaction records the matching counts and commitment root.

## Phase 6: Devnet and handoff

- Deploy both Sunspot verifier programs.
- Deploy the Anchor market program.
- Create one World Cup fixture market.
- Run place, batch, TxLINE resolve, and redeem on devnet.
- Record program IDs and transaction signatures without committing private keys.
- Document the exact privacy guarantees and testnet-only warning.

Acceptance:

- The full lifecycle is reproducible from the public repository.
- Explorer links prove ZK verification, batch acceptance, TxLINE settlement, and payout.

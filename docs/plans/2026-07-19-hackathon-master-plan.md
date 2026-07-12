# Moros Cup Hackathon Master Plan

- Date: 2026-07-19
- Deadline: 2026-07-19 23:59 UTC
- Network: Solana devnet
- Collateral: Circle devnet USDC
- Flagship: Private fixed-ticket over 2.5 total-goals pool
- Status: Current plan

## 1. Outcome

Ship a wallet-optional World Cup prediction terminal that visibly uses TxLINE for fixtures, odds, score replay, and result proofs. A connected trader can deposit one devnet USDC into a private binary pool only after a Noir Groth16 placement proof verifies on Solana. After lock, a two-of-three committee publishes only aggregate YES and NO counts. Anyone can settle the pool by submitting a final TxLINE V2 score proof to the market program. Winners claim USDC with a second proof without revealing which original commitment was theirs.

The hackathon lifecycle is an explicitly labeled compressed replay of a completed TxLINE fixture. This provides real signed proof data within the remaining deadline. It is not presented as a fair live market after the fact. The same program also models `Live` mode, where lock must occur before the configured fixture kickoff.

The five-minute demo must prove the complete story:

1. TxLINE supplies the fixture, odds, and score timeline.
2. A one-USDC prediction enters a Solana PDA vault.
3. The public chain sees a commitment but not its YES or NO side.
4. The order is accepted only because the proof verifies.
5. TxLINE's final-score Merkle proof determines settlement.
6. A winning recipient receives USDC and the UI shows a verifiable settlement receipt.

## 2. Why this architecture

The reference Moros repository succeeded because it validated load-bearing primitives first, wrote a master plan, split it into subsystem specifications, built one complete private market, and planned the demo backward from evidence. This project ports that discipline, not the Stellar-specific contract topology.

The Solana version deliberately uses:

- One Anchor program with separate PDAs instead of multiple per-market contracts.
- Standard SPL USDC instead of native SOL or TxL credits.
- A fixed-ticket pari-mutuel pool instead of an LMSR or order book.
- TxLINE as the result authority instead of a committee oracle.
- A read-only product path before wallet-gated actions.
- One flagship market before tournament-scale generation.

## 3. Validated evidence

The following claims have already been spiked or verified:

| Primitive | Evidence | Decision |
| --- | --- | --- |
| Noir to Solana proof path | Noir `1.0.0-beta.22`, Poseidon `v0.3.0`, and Sunspot `v1.0.0` compile, prove, and verify both circuits locally | Keep Groth16 privacy path |
| Placement proof size | 324-byte proof plus 236-byte public witness | Feasible, but test full transaction size |
| Solana Poseidon parity | TypeScript `poseidon(1,2)` matches Solana's vector | Reuse the same field encoding |
| Anchor state logic | Draft program unit tests pass | Refactor collateral and settlement before treating it as current |
| TxLINE V2 | Official devnet IDL commit `b6981f31e6f230cc1ef1729c34182414a1419682` exposes `validate_stat_v2` and a bool return | Pin IDL-derived types and program ID |
| Final soccer record | Current docs specify `action=game_finalised`, `statusId=100`, and `period=100` | Enforce final leaves and observed `seq >= 1` |
| USDC | Circle devnet mint uses the original SPL Token Program with six decimals | Replace every SOL transfer with `transfer_checked` |

The current uncommitted implementation is a feasibility spike, not an approved product implementation. Its SOL vault, home-win predicate, and program identity mismatch must be replaced before deployment.

## 4. Non-negotiable constraints

1. TxLINE must be the primary and visible data source.
2. Market collateral is the fixed Circle devnet USDC mint.
3. TxL credits never enter a user pool or payout.
4. Proof verification happens before an order is accepted.
5. The settlement predicate is immutable after market creation.
6. Resolution is one-way and permissionless in the CPI path.
7. Every external program ID, mint, token program, PDA, signer, and owner is pinned or derived.
8. Every accepted ticket ends as winning and claimable, losing and consumed, refundable, or pending. No ticket can produce more than one outbound transfer.
9. The wallet-free read-only experience works without judge setup.
10. The public repository contains no secrets or licensed raw feed archive.
11. The demo distinguishes live, replayed, and synthetic data honestly.
12. The product is described as an unaudited devnet prototype.
13. The protocol earns one percent only from successfully settled pools, with zero fee on refunds.
14. Fee rate and treasury are visible and immutable for each market.

## 5. Scope

### P0: submission critical

- TxLINE authentication and server-side adapter.
- Wallet-free fixture, score replay, and odds experience.
- One over 2.5 total-goals market tied to one TxLINE fixture.
- One-USDC fixed-ticket Anchor escrow.
- One-percent pool-level protocol fee with a three-percent on-chain cap.
- Noir placement and redeem proofs with Sunspot verifier CPIs.
- Two-of-three aggregate committee script or service.
- TxLINE V2 validation spike against the current devnet IDL.
- Atomic TxLINE settlement CPI if the transaction-size and compute gate passes.
- Explicit receipt-based fallback settlement if the CPI gate fails.
- Pull-based USDC claim, one-sided-pool cancellation, and timeout refund.
- Settlement receipt with fixture ID, sequence, stat keys, root PDA, validation result, transaction, and explorer link.
- Local adversarial tests and one recorded devnet lifecycle.
- Deployed web app, public repo, README, endpoint list, API feedback, and video.

### P1: only after the flagship lifecycle works

- Tournament fixture catalog and automatic market cards.
- Real-time odds and score SSE with reconnect behavior.
- Browser proof worker instead of a local proving helper.
- Three independently hosted committee members.
- Recipient-unlinked relayed claims.
- Extra markets for winner, corners, or cards.

### P2: post-hackathon

- Continuous LMSR or order-book trading.
- Variable private stake sizes.
- Threshold ElGamal and verifiable homomorphic aggregation.
- Token-2022 confidential collateral.
- Transferable outcome tokens.
- Permissionless market creation, governance, dynamic fee tiers, and mainnet custody.
- Social profiles, comments, reactions, or uploaded media.

## 6. Companion specifications

| Area | Current document |
| --- | --- |
| Hack rules and sponsor constants | `docs/specs/2026-07-19-hackathon-brief.md` |
| Whole-system components and trust boundaries | `docs/specs/2026-07-19-system-architecture.md` |
| Anchor accounts, instructions, economics, and invariants | `docs/specs/2026-07-19-solana-program-and-economics.md` |
| TxLINE API, proof mapping, CPI, and fallback | `docs/specs/2026-07-19-txline-integration.md` |
| Circuits, witnesses, committee, and privacy claims | `docs/specs/2026-07-19-privacy-and-proof.md` |
| Routes, components, services, and data boundaries | `docs/specs/2026-07-19-web-and-services.md` |
| Devnet evidence, video, and submission checklist | `docs/plans/2026-07-19-devnet-demo-submission-plan.md` |

## 7. Critical path and gates

### Phase 0: plan and interface freeze

Tasks:

- Approve the flagship market, USDC collateral, public/private boundary, and fallback policy.
- Pin the TxLINE devnet IDL commit and Circle mint.
- Mark the older SOL design as superseded.

Gate:

- Every subsystem uses the same market predicate, field names, mint, program IDs, state machine, and deadline policy.

### Phase 1: TxLINE risk spike

Tasks:

- Activate devnet access with one dedicated service wallet.
- Fetch a current eligible fixture, odds snapshot, historical scores, and V2 proof.
- Simulate the official `validateStatV2` call.
- Measure proof payload bytes, transaction bytes, and compute.
- Attempt a minimal local CPI that reads and pins the bool return data.

Gate:

- Pass: continue with atomic `resolveWithTxline`.
- Fail by the cutoff: implement the documented proof-receipt fallback and stop spending critical-path time on CPI.

### Phase 2: read-only product slice

Tasks:

- Build the web shell and a wallet-free market terminal.
- Show fixture participants, kickoff, match state, odds, score timeline, and TxLINE source status.
- Support historical replay and a clearly labeled synthetic fallback.

Gate:

- A judge can understand the product and TxLINE integration without a wallet.

### Phase 3: USDC market state machine

Tasks:

- Replace the SOL vault with a market-owned SPL token account.
- Pin the USDC mint and original SPL Token Program.
- Implement fixed-ticket deposit, batch, resolution, redeem, and refund flows.
- Add a protocol configuration PDA, snapshot the fee and treasury into each market, and collect the fee atomically only on successful resolution.
- Add arithmetic, account-substitution, duplicate-action, timeout, and balance-delta tests.

Gate:

- A local six-decimal mock-mint lifecycle moves exact token balances, separates gross pool, fee, net pool, and payout, and preserves solvency.

### Phase 4: privacy integration

Tasks:

- Update public witness names from lamports to USDC base units.
- Keep the verified Noir and Sunspot version pair.
- Wire placement and redeem verifier CPIs into the Anchor program.
- Build the two-of-three committee aggregation path and local private-position backup.

Gate:

- A mutated market, payer, mint amount, commitment, root, outcome, payout, recipient, or nullifier fails verification.
- One committee share does not reveal a side.

### Phase 5: full web transaction flow

Tasks:

- Connect a Solana wallet and show devnet USDC balance.
- Generate the placement witness, prove, deposit, and persist recovery data.
- Show the batch state, aggregate probability, settlement action, receipt, and claim.
- Preserve the wallet-free path.

Gate:

- One browser flow completes without editing source or exposing a secret.

### Phase 6: devnet evidence

Tasks:

- Deploy verifier programs and the Anchor market program.
- Use real Circle devnet USDC.
- Execute placement, batch, TxLINE validation, resolution, and claim or refund.
- Save public IDs and signatures in a canonical deployment record.

Gate:

- Explorer evidence and token balance deltas support every demo claim.

### Phase 7: feature freeze and submission

Tasks:

- Deploy the web app.
- Finish the README, exact endpoint list, limitations, TxLINE feedback, and architecture diagram.
- Record and verify the video.
- Complete the submission form before 23:40 UTC.

Gate:

- A clean browser can open the URL, use replay mode, inspect the receipt, and reach the repo.

## 8. Time budget

| UTC window | Deliverable |
| --- | --- |
| 15:15-16:00 | Plan freeze and TxLINE V2 spike |
| 16:00-17:30 | USDC Anchor refactor and local tests |
| 17:30-18:30 | Proof and committee integration |
| 18:30-20:30 | Read-only terminal plus transaction flow |
| 20:30-21:15 | Devnet deployment and evidence |
| 21:15 | Feature freeze |
| 21:15-22:00 | README, feedback, public deployment, submission copy |
| 22:00-23:00 | Video capture and verification |
| 23:00-23:40 | Upload and submit |
| 23:40-23:59 | Emergency buffer only |

## 9. Cutoff policy

- If atomic TxLINE CPI has not passed by 16:15 UTC, ship official V2 view validation plus the explicitly labeled receipt-based resolver. Keep the CPI code on a non-demo branch or behind an off switch.
- If browser proving is unstable by 19:00 UTC, use a deterministic pre-generated demo proof through the same on-chain verifier and label it accurately.
- If the three-member HTTP committee is unstable by 19:00 UTC, use the audited local committee runner with three distinct keypairs and show the trust assumption.
- If live SSE is unavailable, use TxLINE historical replay. If the licensed replay is unavailable, use an explicitly labeled synthetic schema-compatible fixture.
- Never cut the deployed read-only app, USDC movement, deterministic settlement evidence, public repo, technical README, or five-minute video.

## 10. Definition of done

The project is complete for the hackathon when:

- The public app loads without a wallet.
- TxLINE data or a clearly labeled TxLINE replay powers the visible match state.
- A devnet transaction moves one USDC ticket into the correct market vault.
- The placement path demonstrates proof verification before acceptance.
- The final score predicate is validated using the documented TxLINE path.
- The market resolves once and pays or refunds exact USDC base units.
- A settled market routes exactly one percent to the pinned treasury, while every one-sided or timeout refund scenario charges zero.
- The receipt and explorer links are visible.
- Tests, build, and deployment commands work from the public repository.
- The video, README, endpoint list, API feedback, and submission form are complete.
- The human owner has reviewed the claims and submission.

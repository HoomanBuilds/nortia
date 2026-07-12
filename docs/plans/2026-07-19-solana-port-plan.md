# Moros Cup Hackathon Delivery Plan

- Date: 2026-07-19
- Deadline: 2026-07-20
- Track: TxODDS Prediction Markets and Settlement
- Network: Solana devnet only
- Product: Private fixed-ticket World Cup prediction pool
- Detailed protocol spec: `docs/specs/2026-07-19-private-world-cup-market.md`

## 1. Submission objective

Ship a reproducible Solana devnet application that proves all of the following:

1. A trader can place a fixed-size YES or NO World Cup prediction without publishing the side.
2. Solana accepts the order only after an on-chain Groth16 verifier accepts a Noir proof.
3. A two-of-three committee reveals only aggregate YES and NO totals after the market locks.
4. The final outcome comes from TxLINE's official `validate_stat_v2` instruction and a Solana-anchored final-score proof.
5. A winner can redeem through a relayer without linking the original order account to the payout transaction.
6. Funds can be recovered without an administrator if batching or score settlement becomes unavailable.

This is an unaudited hackathon prototype. It will use devnet SOL and must not be presented as production safe.

## 2. Judging alignment

| Track signal | Demonstrable evidence |
| --- | --- |
| Prediction market | Binary home-team-win market with public aggregate odds and pari-mutuel settlement |
| World Cup relevance | Market is keyed to a TxLINE World Cup fixture and final score stat keys |
| TxLINE integration | Market program CPIs into the pinned TxLINE devnet program and reads its boolean return data |
| Solana integration | Anchor market, vault, order, claim, and verifier programs are deployed on devnet |
| Zero knowledge | Placement and redemption proofs are generated from Noir circuits and verified on Solana through Sunspot verifier programs |
| Privacy | Individual side, order secret, threshold shares, and redemption link remain hidden under the documented assumptions |
| Credible product design | Fixed tickets, one-way phases, replay protection, public incentives, and timeout refunds produce a complete lifecycle |
| Reproducibility | Public scripts, test commands, program IDs, transaction signatures, and explorer links reproduce the demo |

## 3. Scope control

### P0: must ship

- One fixed-ticket binary market for a TxLINE fixture.
- Noir placement circuit with seven public inputs.
- Noir redemption circuit with Merkle membership and nullifier replay protection.
- Two deployed Sunspot Groth16 verifier programs.
- Anchor instructions for create, place, batch, resolve, redeem, begin refund, and refund.
- Two-of-three committee signer enforcement.
- TxLINE V2 score payload validation and CPI settlement.
- Local tests for circuits, state transitions, witness binding, TxLINE payload checks, payout math, and timeout paths.
- Devnet lifecycle with transaction signatures and explorer links.
- README, privacy disclosure, security warning, architecture diagram, and demo script.

### P1: ship after the critical path

- Browser interface with wallet connection, market state, private order form, aggregate odds, and claim flow.
- TypeScript client library for commitment construction, proof inputs, Merkle trees, and transaction builders.
- Three local committee services with authenticated share submission and aggregate signing.
- Automated TxLINE proof fetcher for the selected fixture.
- One-command local demo and one-command devnet replay scripts.

### P2: explicitly cut unless P0 and P1 are complete

- Token-2022 Confidential Transfer collateral.
- LMSR or continuous private pricing.
- More than one live market.
- Variable ticket sizes.
- Permissionless committee rotation.
- Production trusted setup, mainnet deployment, governance, or real-value custody.
- Mobile-specific UI and extensive visual effects.

If schedule pressure appears, cut P2 first, then browser polish and HTTP committee packaging. Never cut on-chain proof verification, TxLINE CPI settlement, replay protection, or timeout refunds.

## 4. System architecture

```text
Trader client
  |-- builds commitment and 2-of-3 shares
  |-- generates Noir placement proof
  |-- sends one private share to each committee member
  `-- submits fixed SOL ticket to Anchor market

Anchor market
  |-- binds public witness to market, payer, ticket, and commitments
  |-- CPIs into placement verifier
  |-- escrows ticket in market vault
  |-- accepts aggregate batch with two committee signatures
  |-- CPIs into TxLINE validate_stat_v2
  `-- verifies redeem proof and pays proof-bound recipient

Committee
  |-- validates individual share commitments
  |-- reconstructs only aggregate YES count from two aggregate shares
  `-- signs commitment root and YES or NO totals

Winner or relayer
  |-- builds Merkle membership proof
  |-- generates Noir redemption proof
  `-- submits nullifier and proof for payout
```

### On-chain accounts

| Account | Purpose | Key invariant |
| --- | --- | --- |
| Market | Immutable configuration and phase state | Outcome and verifier identities cannot change after creation |
| Vault PDA | Holds fixed devnet SOL tickets | Available collateral covers all remaining payouts or refunds |
| Order PDA | Stores commitment and share commitments | One PDA per market and commitment prevents duplicate placement |
| Claim PDA | Stores used nullifier and recipient | One PDA per market and nullifier prevents replay |

### Off-chain components

| Component | Responsibility | Failure response |
| --- | --- | --- |
| Trader client | Secrets, shares, proof input, transaction building | User retains local recovery material |
| Committee service | Share validation, aggregation, batch signatures | Two-of-three threshold; batch timeout opens refunds |
| TxLINE fetcher | Final score proof and daily root selection | Resolution timeout opens refunds |
| Relayer | Proof submission for recipient | Any relayer can replace an unavailable relayer |

## 5. Critical dependency order

The implementation order is dictated by proof and CPI interfaces:

1. Freeze circuit public inputs and field encoding.
2. Compile circuits and generate proving and verifying keys.
3. Deploy verifier programs and record their IDs.
4. Build the market around those immutable verifier IDs.
5. Validate TxLINE serialization against the official devnet IDL.
6. Build the client from the final IDL and circuit ABI.
7. Run local lifecycle tests.
8. Deploy the market and execute the devnet lifecycle.
9. Freeze code, record evidence, and finish the submission.

No UI work belongs on the critical path until steps 1 through 6 have stable interfaces.

## 6. Execution phases and gates

### Phase 0: architecture and delivery lock

Tasks:

- Audit the Stellar Moros implementation for reusable protocol ideas.
- Confirm Solana BN254 and Groth16 verification constraints.
- Confirm TxLINE V2 accounts, types, discriminator, final period, and return-data behavior.
- Freeze privacy guarantees, trust assumptions, state machine, payout model, and timeout policy.
- Create the repository plan and protocol spec.

Gate:

- The spec names every public and private value.
- Every state transition has a caller, deadline, and failure path.
- P0, P1, and P2 scope is explicit.

Status: complete.

### Phase 1: proof system

Tasks:

- Implement placement commitment, binary side constraint, two-of-three Shamir shares, and share commitments.
- Implement redemption commitment membership, winner constraint, market nullifier, recipient binding, and payout binding.
- Add valid and invalid Noir tests.
- Compile ACIR, run Sunspot setup, prove, and verify locally.
- Record proof size, witness size, constraint count, setup commands, and generated verifier IDs.

Gate:

- `nargo test --workspace` passes.
- Sunspot locally verifies one YES placement, one NO placement, and one winning redemption.
- Mutating any public binding causes verification failure.
- Proof plus witness fits inside a Solana transaction.

### Phase 2: core Anchor state machine

Tasks:

- Implement market, vault, order, and claim accounts.
- Implement create, place, batch, begin-refund, refund, and redeem instructions.
- Enforce fixed ticket size, deadlines, distinct committee signers, count equality, one-way phases, and nullifier replay protection.
- Apply checks, effects, interactions ordering around CPIs and value transfers.
- Emit events for every state change.

Gate:

- `anchor build` succeeds with a generated IDL.
- Rust unit tests cover payout math, phase gates, committee configuration, and field encoding.
- Program tests reject duplicate orders, wrong phases, early and late calls, duplicate signers, count mismatches, invalid witnesses, repeat refunds, and repeat claims.
- Payouts and refunds never consume vault rent or exceed ticket deposits.

### Phase 3: TxLINE settlement

Tasks:

- Vendor only the official V2 data types required by `validate_stat_v2`.
- Pin the official TxLINE devnet program ID.
- Require the daily root account to be owned by the TxLINE program.
- Bind fixture ID, home and away score keys, final period `100`, and valid update metadata.
- Construct `home_score - away_score > 0` and invoke TxLINE.
- Require TxLINE return data to come from the pinned program and contain one boolean byte.
- Route zero-winner outcomes into permissionless refunds.

Gate:

- A local mock resolves both YES and NO.
- Wrong fixture, wrong key, non-final period, wrong root owner, wrong program, missing return data, and malformed return data fail.
- Resolution is one-way and cannot occur after the refund deadline.

### Phase 4: client and committee flow

Tasks:

- Add TypeScript field encoding compatible with Noir and Solana Poseidon.
- Generate secrets, nullifiers, Shamir shares, salts, commitments, and proof inputs.
- Build the commitment Merkle tree and redemption paths.
- Implement three committee instances that validate share commitments before storing shares.
- Aggregate two committee totals and construct a batch transaction with distinct signers.
- Persist trader recovery data locally without logging secrets.

Gate:

- One committee view cannot determine an order side.
- Any two aggregate shares reconstruct the correct YES total.
- A three-order run produces the exact Merkle root and public counts accepted by the program.
- No secret, nullifier preimage, or raw committee share appears in console output or committed files.

### Phase 5: lifecycle verification and security freeze

Tasks:

- Run create, place YES, place NO, batch, resolve, redeem, and refund-timeout scenarios on localnet.
- Add adversarial tests for account substitution, CPI target substitution, arithmetic bounds, duplicate accounts, stale phases, and replay.
- Review all writable and signer accounts.
- Review every checked and unchecked account ownership condition.
- Review every external CPI target and return value.
- Run formatting, Clippy, Anchor build, Noir tests, and client tests.

Gate:

- All P0 tests pass from a clean checkout.
- No private key or witness secret appears in Git history.
- No unresolved critical or high-severity finding remains.
- Upgrade authority and devnet-only risk are documented.

### Phase 6: devnet deployment

Tasks:

- Confirm deployer wallet, devnet cluster, balance, and program identities.
- Deploy the placement verifier.
- Deploy the redemption verifier.
- Build the market with the deployed verifier IDs and deploy it.
- Create one market using a real TxLINE fixture and stat keys.
- Execute the full lifecycle and record explorer links.

Gate:

- Deployed bytecode matches the tagged repository commit.
- Program IDs, fixture ID, stat keys, transaction signatures, and UTC timestamps are recorded.
- Explorer evidence shows proof-gated placement, committee batch, TxLINE resolution, and payout.
- No keypair file is committed or printed.

### Phase 7: product and submission

Tasks:

- Build the minimal browser flow only after the program and client interfaces freeze.
- Add architecture, setup, test, deploy, privacy, and threat-model documentation.
- Prepare a 90-second primary demo and a 3-minute technical backup demo.
- Add screenshots or a short video that still work if devnet is slow during judging.
- Complete the hackathon form with exact track language and evidence links.

Gate:

- A new developer can run the documented local flow.
- A judge can understand the privacy claim and trust boundary in under one minute.
- The demo visibly includes a Solana-verified ZK proof and TxLINE-powered settlement.
- All repository links and explorer links work in a private browser window.

## 7. Test matrix

| Area | Happy path | Required failures |
| --- | --- | --- |
| Placement circuit | YES and NO orders | Non-binary side, mutated market, stake, payer, commitment, share, or salt |
| Redemption circuit | Winning member redeems | Losing side, wrong root, bad path, wrong outcome, nullifier, recipient, or payout |
| Market creation | Valid future deadlines | Zero stake, duplicate committee, equal stat keys, invalid deadline order |
| Placement | Valid proof and exact ticket | Late order, duplicate commitment, wrong verifier, wrong witness, failed CPI |
| Batch | Two distinct committee signers | Early batch, late batch, one signer, duplicate signer, count mismatch, zero root |
| TxLINE | Final home win and non-home win | Wrong program, owner, fixture, key, period, update metadata, proof, or return data |
| Redemption | Relayed proof pays recipient | Reused nullifier, wrong recipient, insufficient vault, invalid phase |
| Refund | Timeout returns original ticket | Early refund, wrong payer, second refund, resolved market |
| Accounting | All winners receive fixed payout | Overflow, zero winners, payouts or refunds above deposits |

## 8. Devnet evidence checklist

- Placement verifier program ID and deployment signature.
- Redemption verifier program ID and deployment signature.
- Moros Cup program ID and deployment signature.
- Market PDA and vault PDA.
- TxLINE program ID and daily score root PDA.
- Selected fixture ID, home score key, and away score key.
- Market creation signature.
- At least two proof-gated placement signatures.
- Batch signature showing two committee signers.
- TxLINE resolution signature.
- Winning redemption signature.
- One separately demonstrated timeout refund on a short-lived test market.
- Solana Explorer links using the devnet cluster parameter.

## 9. Demo script

### 90-second primary demo

1. Show the market question, fixed ticket, lock time, and public order count.
2. Place a hidden YES order and show Solana accepting the ZK-gated transaction.
3. Place a hidden NO order from another wallet and show that neither side is visible on-chain.
4. Lock the market and submit the two-of-three aggregate batch.
5. Show aggregate YES and NO odds becoming public.
6. Submit the TxLINE final-score proof and show the outcome resolving.
7. Redeem from a fresh recipient through a relayer and show the nullifier preventing replay.

### Technical backup demo

- Open the placement circuit and identify its public bindings.
- Open the Anchor handler and show verifier and TxLINE CPI pinning.
- Show the TxLINE fixture, final period, and score keys.
- Run the focused test suite.
- Show the timeout refund path.

## 10. Risks and fallbacks

| Risk | Early signal | Mitigation | Allowed fallback |
| --- | --- | --- | --- |
| Sunspot verifier deployment fails | Local proof works but deploy or CPI fails | Validate toolchain and proof size before client work | Deploy the smallest working circuit first; do not replace on-chain verification with server trust |
| Transaction exceeds limits | Proof or TxLINE payload is too large | Measure serialized bytes and compute units in Phase 1 and Phase 3 | Use versioned transactions and compute budget; reduce Merkle depth while documenting capacity |
| TxLINE fixture proof is unavailable | Fetcher cannot obtain a final daily root | Select and verify a fixture early; keep a local CPI mock for tests | Demo local proof flow plus a separate real TxLINE validation transaction only if devnet data prevents a combined call, and disclose the limitation |
| Committee service takes too long | Core aggregation works only in scripts | Keep protocol as three local processes with separate keys | Ship CLI-based members instead of HTTP services |
| Browser UI threatens deadline | Program interface is still changing | Freeze UI until Phase 4 gates pass | Ship a polished CLI demo and minimal read-only web page |
| No tickets chose the winner | Winning count is zero | Route the market into refunds | Demonstrate a second seeded market with winners for redemption |
| Key material leaks | Secret appears in logs, artifacts, or Git status | Ignore all keys and prover inputs; inspect exact files only | Rotate the affected identity before funding or deployment |
| Devnet is unstable | Airdrop, deploy, or RPC calls fail repeatedly | Use funded wallet, backup RPC, and pre-recorded evidence | Submit verified prior signatures and video, then document RPC issue |

## 11. Commit plan

Each commit must build or document one coherent milestone:

1. `docs: define private World Cup market architecture`
2. `build: scaffold Anchor and Noir workspace`
3. `feat: prove private placement and redemption`
4. `feat: implement private market state machine`
5. `feat: settle markets from TxLINE score proofs`
6. `feat: add private client and threshold committee flow`
7. `test: cover lifecycle and adversarial paths`
8. `feat: add hackathon demo interface`
9. `docs: publish devnet evidence and privacy disclosure`

Before every commit:

- Inspect `git diff` and `git status`.
- Run the smallest relevant test suite.
- Exclude generated proofs, proving keys, wallets, recovery data, and private committee shares.
- Use no unrelated changes and no unverified completion claims.

## 12. Definition of done

The project is complete only when:

- Both Noir circuits pass and their deployed verifiers accept real proofs on devnet.
- The Anchor program builds from a clean checkout.
- A hidden order cannot be placed without a matching proof.
- Two committee signatures finalize correct aggregate counts and a commitment root.
- TxLINE alone determines the market outcome through the official V2 CPI.
- A winner redeems once to a proof-bound recipient through a relayer.
- An unavailable batch or resolution can never lock tickets forever.
- Tests cover the happy lifecycle and every listed high-risk failure.
- Program IDs and transaction evidence are public.
- Documentation states exactly what is private, public, trusted, and unaudited.
- The demo and submission can be reproduced without access to developer secrets.

## 13. Current checkpoint

- Architecture research and protocol spec are committed.
- The Anchor and Noir scaffold exists but is not committed.
- Both Noir unit suites currently pass.
- The Anchor state machine draft exists but has not yet passed `cargo test` or `anchor build`.
- No deployment has occurred.

The next action after approving this plan is to finish Phase 1, commit the scaffold and circuits, then compile the Anchor draft before extending it.

# Privacy, Proof, and Committee Specification

- Date: 2026-07-19
- Status: Current specification
- Circuit language: Noir
- Solana verifier generator: Sunspot
- Curve and proof: BN254 Groth16

## 1. Privacy objective

Hide each fixed-ticket YES or NO choice from public chain observers while the market is open. Prove that every accepted commitment contains a valid binary side before USDC enters the pool. Reveal only aggregate side counts after lock. Allow a winner to claim to a proof-bound recipient without revealing which commitment is being opened.

## 2. Public and private data

Private:

- Side.
- Order secret.
- Nullifier preimage.
- Shamir coefficient.
- Three committee shares and salts.
- Commitment Merkle path during redemption.
- Link between original payer and later recipient, subject to wallet and timing analysis.

Public:

- Payer wallet and fixed one-USDC transfer.
- Market and order index.
- Order commitment.
- Three share commitments.
- Total number of tickets.
- Commitment root and aggregate YES and NO counts after lock.
- TxLINE fixture, proof receipt, and final outcome.
- Net payout, protocol fee, claim nullifier hash, and recipient token account.

Fixed ticket size prevents variable stake amounts from becoming a side-channel. It does not hide that a wallet participated.

## 3. Toolchain lock

The validated pair is:

- Noir `1.0.0-beta.22`.
- Poseidon library `v0.3.0`.
- Sunspot `v1.0.0`.

Sunspot `v1.0.0` rejected the earlier Noir beta 13 ACIR. Do not silently upgrade any one component. A toolchain change requires compile, setup, prove, verify, Solana build, and cross-language vector gates again.

Measured spike results:

| Circuit | Constraints | Proof | Public witness |
| --- | ---: | ---: | ---: |
| Placement | 3,906 | 324 bytes | 236 bytes |
| Redeem | 20,733 | 324 bytes | 236 bytes |

Full transaction size and compute still require measurement with real verifier CPI accounts.

## 4. Field encoding

- All circuit values are BN254 scalar-field elements.
- Integer amounts are unsigned base-unit integers strictly below the field modulus.
- Boolean side is exactly `0` or `1`.
- Solana public keys are split into fixed little-endian limbs before Poseidon reduction.
- `marketContext` binds program ID, market PDA, collateral mint, fixture ID, and predicate.
- `payerHash` and `recipientHash` use domain-separated Poseidon chains over public-key limbs.
- Every domain uses a distinct constant so an order, share, nullifier, and address hash cannot be substituted across contexts.

The same vectors must pass in Noir, TypeScript, and Rust.

## 5. Order commitment

Conceptually:

```text
orderCommitment = PoseidonDomain(
  ORDER_DOMAIN,
  marketContext,
  ticketAmount,
  side,
  secret,
  nullifier
)
```

The hash is implemented as a documented Poseidon chain with fixed ordering. Changing one input must change the final commitment.

## 6. Two-of-three shares

For committee coordinates `x = 1, 2, 3`:

```text
share(x) = side + coefficient * x mod Fr
shareCommitment(x) = PoseidonDomain(SHARE_DOMAIN, share(x), salt(x))
```

One share is uniformly masked by the coefficient. Any two shares reconstruct the hidden side. Committee members receive only their own share and salt.

After `n` accepted orders, each member sums its shares. Any two aggregate shares interpolate to:

```text
yesCount = sum(side[i])
noCount = orderCount - yesCount
```

The reconstructed field value must fit an integer `0..orderCount`.

## 7. Placement circuit

Private inputs:

- Side.
- Secret.
- Nullifier.
- Shamir coefficient.
- Three share salts.

Public inputs:

- Market context.
- Ticket amount in USDC base units.
- Payer hash.
- Order commitment.
- Three share commitments.

Constraints:

1. Side is zero or one.
2. Ticket amount equals the public fixed amount used in the commitment.
3. Order commitment opens to the supplied private values.
4. Three shares lie on the same degree-one polynomial with intercept equal to side.
5. Every share commitment opens to the corresponding share and salt.
6. Market context and payer hash are included in the public witness.

On-chain binding:

- Anchor recomputes market context and payer hash.
- Anchor requires the witness fields to match instruction accounts and market state.
- Only then does Anchor invoke the immutable placement verifier.
- USDC transfer occurs in the same atomic instruction.

## 8. Commitment tree

- Leaves are accepted order commitments in sequential on-chain order index.
- The tree uses a fixed depth selected before verifier generation.
- Empty leaves use fixed domain-separated zero hashes.
- Parent nodes use a distinct Merkle domain.
- Committee members independently reconstruct the root from Solana events.
- Two committee signatures attest the root and aggregate counts.

The P0 program does not recompute the full tree on-chain. Therefore threshold committee honesty is a disclosed assumption.

## 9. Redeem circuit

Private inputs:

- Side.
- Secret.
- Nullifier preimage.
- Commitment Merkle path and direction bits.

Public inputs:

- Market context.
- Ticket amount.
- Final commitment root.
- Winning outcome.
- Net payout after protocol fee.
- Recipient hash.
- Nullifier hash.

Constraints:

1. Reconstruct the order commitment from its private opening.
2. Verify membership in the finalized root.
3. Require private side to equal public outcome.
4. Derive the market-specific nullifier hash.
5. Bind the proof to the recipient and exact net payout.
6. Require payout to be nonzero.

The program recomputes market context, payout, recipient hash, and expected public values before invoking the verifier. A valid proof for another recipient or payout cannot redirect funds.

## 10. Committee service contract

Minimal endpoints:

- `GET /health`
- `POST /markets/{market}/shares`
- `GET /markets/{market}/status`
- `POST /markets/{market}/finalize`

Share submission contains:

- Market address.
- Order commitment.
- Expected order index.
- Member index.
- Share and salt for only that member.
- Placement transaction signature.

Member checks:

- Market is configured and open.
- Transaction succeeded and emitted the matching commitment.
- Member index matches the endpoint identity.
- Share commitment matches the on-chain commitment.
- Duplicate submission is idempotent and conflicting submission fails.

Finalize checks:

- Market lock elapsed.
- Every counted commitment has a successful order event.
- Commitments are sorted by index with no gap or duplicate.
- Aggregate reconstruction lies in range.
- Root and counts match the intended batch transaction.

## 11. Recovery record

The browser saves:

- Network and program ID.
- Market address and market context.
- Payer and optional recipient.
- Order index and commitment.
- Side, secret, and nullifier preimage.
- Ticket amount.
- Placement transaction.
- Circuit and verifier version.

The UI must require an explicit backup acknowledgement before signing placement. It supports download and import. The server never receives the complete record.

## 12. Threat model

Protected against:

- Public chain observers learning a side from the order account.
- One committee member learning a side from one share.
- A user submitting a non-binary side.
- Cross-market, cross-payer, cross-recipient, or wrong-payout proof replay.
- Double claim through nullifier PDA uniqueness.
- A relayer changing the recipient.

Not protected against:

- Two committee members colluding on per-order shares.
- Browser malware, wallet compromise, or recovery-record loss.
- Timing analysis between original and recipient wallets.
- A malicious two-member committee attesting a false root or aggregate.
- A compromised trusted setup or verifier generator.
- Upgrade-authority replacement of devnet programs.

## 13. Required tests

- YES and NO valid placements.
- Side outside `{0,1}`.
- Mutated market, amount, payer, commitment, share, or salt.
- Cross-language hash vectors.
- One-share privacy sanity test and every two-share interpolation pair.
- Aggregate range and count boundaries, including zero and maximum order count.
- Merkle path at first, middle, last, and empty sibling positions.
- Wrong root, direction bit, outcome, payout, recipient, and nullifier.
- Duplicate nullifier and cross-market nullifier behavior.
- Proof and witness transaction-size boundary.
- Verifier account substitution and malformed verifier return.
- No secret or witness file tracked by Git.

## 14. Production warning

The generated Groth16 setup is for a hackathon prototype. It is not a production ceremony. The system must not be described as production-private, production-safe, audited, or suitable for real funds.

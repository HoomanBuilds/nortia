# Solana Program and Economics Specification

- Date: 2026-07-19
- Status: Current specification
- Program framework: Anchor
- Network: Solana devnet
- Collateral: Circle devnet USDC

## 1. Program topology

The P0 deployment uses one Anchor market program plus two generated Groth16 verifier programs.

The market program owns lifecycle state. USDC remains owned by the original SPL Token Program inside a token account whose authority is the market PDA. TxLINE remains an external pinned program invoked only for result validation.

## 2. Constants and deployment bindings

| Binding | Value or rule |
| --- | --- |
| Ticket amount | `1_000_000` USDC base units |
| USDC decimals | `6` |
| Protocol fee | `100` basis points, or one percent |
| Maximum protocol fee | `300` basis points, or three percent |
| Token program | Original SPL Token Program |
| TxLINE program | `6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J` |
| TxLINE method | `validate_stat_v2` |
| TxLINE discriminator | `[208, 215, 194, 214, 241, 71, 246, 178]` |
| Goal stat keys | `1`, `2` |
| Predicate | `stat[0] + stat[1] > 2` |
| Final leaf period | `100` |
| Committee | Three distinct public keys, threshold two |
| Additional creator or order-entry fees | Zero |

The deployed flagship market must store Circle mint `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`. All token accounts in placement, refund, and redeem instructions must match the stored mint and original token program.

Local tests use a six-decimal mock mint but exercise identical token instructions and constraints.

## 3. PDA accounts

### Protocol config

Seed:

`[b"protocol"]`

Fields:

- Version and bump.
- Protocol administrator.
- Current treasury owner.
- Current fee basis points.
- Allowed USDC mint.
- Original SPL Token Program.
- Pinned TxLINE program.

The P0 protocol config is immutable after initialization. Each market still copies the fee and treasury into immutable fields so the complete economics remain self-contained and auditable. Governance and treasury rotation are post-hackathon work.

### Market

Seed:

`[b"market", marketId.to_le_bytes()]`

Required fields:

- Version and bump values.
- Market ID and creator.
- Fixture ID.
- Market mode and configured fixture start time.
- Collateral mint and ticket amount.
- Protocol fee basis points and treasury owner.
- Goal stat keys, operator, threshold, and comparison.
- Lock, batch-deadline, and resolution-deadline timestamps.
- Market phase.
- Active order count.
- Commitment root.
- YES and NO counts.
- Outcome and payout per winner.
- Claimed and refunded counts.
- Three committee public keys and threshold.
- Placement and redeem verifier program IDs.
- TxLINE program ID.
- Settlement mode and receipt fields.

Immutable after initialization:

- Fixture and predicate.
- Market mode and fixture start time.
- Mint, ticket amount, and token program.
- Protocol fee basis points and treasury owner.
- Committee and verifier identities.
- TxLINE program.
- Deadlines, except no extension path exists in P0.

### Vault token account

Address seed:

`[b"vault", market.key().as_ref()]`

Rules:

- Mint equals `market.collateralMint`.
- Token account authority is the market PDA.
- Only program instructions can sign transfers with market seeds.
- No close or arbitrary withdrawal instruction exists.

### Order

Seed:

`[b"order", market.key().as_ref(), commitment]`

Fields:

- Bump.
- Market.
- Original payer.
- Sequential order index.
- Order commitment.
- Three share commitments.
- Refunded flag.

The side is never stored.

### Claim

Seed:

`[b"claim", market.key().as_ref(), nullifierHash]`

Fields:

- Bump.
- Market.
- Nullifier hash.
- Recipient token account or recipient owner.
- Amount.

Initialization of this PDA provides replay protection.

## 4. Instructions

### `initializeProtocol`

Checks:

- Protocol PDA does not already exist.
- Fee is no more than `300` basis points.
- Treasury owner, USDC mint, token program, and TxLINE program are valid nonzero addresses.

Effects:

- Creates the one protocol config.
- Stores the administrator, one-percent fee, treasury owner, mint, and pinned programs.

No fee withdrawal authority exists. Fees move directly to the canonical treasury USDC account during successful settlement.

### `initializeMarket`

Checks:

- Market ID and fixture ID are nonzero.
- Mint and token program match the intended deployment.
- Protocol config uses the intended mint and programs.
- Fee is no more than `300` basis points.
- Ticket is exactly one USDC for the flagship deployment.
- Stat keys are `1` and `2` and distinct.
- Predicate is addition, threshold two, greater than.
- Current time is before lock.
- `Live` mode requires the lock time to be no later than the configured fixture start time.
- `Replay` mode is accepted only by the devnet prototype deployment and is visibly disclosed by clients.
- `lock < batchDeadline < resolutionDeadline`.
- Committee members are nonzero and pairwise distinct.
- Threshold is two.
- Verifier and TxLINE program IDs are nonzero and expected.

Effects:

- Creates the Market PDA.
- Creates the market-owned USDC vault.
- Stores immutable configuration and phase `Open`.
- Snapshots fee basis points and treasury owner from protocol config.

### `placeOrder`

Inputs:

- Commitment.
- Three share commitments.
- Groth16 proof and public witness.

Checks:

- Phase is `Open` and time is before lock.
- Commitment and share commitments are nonzero.
- Payer owns the source token account.
- Source and vault mint equal the market mint.
- Token program is the original SPL Token Program.
- Source balance covers one ticket.
- Public witness exactly binds market ID, ticket amount, payer hash, commitment, and share commitments.
- Placement verifier account equals the immutable verifier ID and is executable.
- Verifier CPI succeeds.

Effects:

- Allocates the unique Order PDA.
- Stores the current order index.
- Increments order count with checked arithmetic.
- Transfers exactly one ticket using `transfer_checked`.
- Emits `OrderPlaced` without a side.

All changes are atomic. A proof or transfer failure rolls the instruction back.

### `submitBatch`

Inputs:

- Commitment root.
- YES and NO counts.
- Batch identifier.

Checks:

- Phase is `Open`.
- Time is at or after lock and no later than batch deadline.
- Root is nonzero.
- YES plus NO equals active order count.
- At least two distinct configured committee accounts signed the transaction.
- No signer account is counted twice.

Effects:

- Stores root and counts.
- Moves phase to `Refunding` with zero fee if either count is zero.
- Otherwise moves phase to `Batched`.
- Emits `BatchSubmitted`.

### `resolveWithTxline`

Inputs:

- Official `StatValidationInput` payload.
- Fixed `NDimensionalStrategy` or no caller-controlled strategy if built internally.

Checks:

- Phase is `Batched` and resolution deadline has not elapsed.
- TxLINE program equals the immutable ID and is executable.
- Daily root has the correct owner and PDA derivation.
- Payload fixture equals market fixture.
- Payload contains exactly stat keys `1` and `2` in the required order.
- Both leaves have period `100`.
- Proof summary timestamps are ordered and map to the supplied root PDA.
- CPI return data comes from TxLINE and is exactly a valid bool.

Effects:

- Stores YES when `goals1 + goals2 > 2`, otherwise NO.
- Computes the winning count, gross pool, fee, net pool, and payout.
- Requires a nonzero winning count because a one-sided pool was canceled during batch.
- Enters `Resolved`.
- Transfers the fee once to the canonical USDC account for the snapshotted treasury owner.
- Stores receipt metadata and emits `MarketResolved`.
- Emits `ProtocolFeeCollected` with gross pool, basis points, fee amount, and treasury.

### `resolveWithAuthorityReceipt`

This instruction exists only if the CPI feasibility gate fails. A market declares its settlement mode at creation, so an authority receipt cannot override a CPI-only market.

Checks:

- Settlement mode permits the fallback.
- Configured resolution authority signs.
- Phase is `Batched`.
- The result has not been stored before.
- Receipt binds fixture, sequence, stat keys, final values, root PDA, and official simulation signature or digest.

The UI must label this mode as receipt-based settlement, not atomic trustless settlement.

### `beginRefund`

Anyone may open refunds when:

- Phase is `Open` and the batch deadline elapsed, or
- Phase is `Batched` and the resolution deadline elapsed.

The phase changes one way to `Refunding`.

### `refundOrder`

Checks:

- Phase is `Refunding`.
- Order belongs to the market and original payer.
- Payer signs.
- Order was not refunded.
- Destination token account is owned by payer and uses market mint.

Effects:

- Marks the order refunded before transfer.
- Transfers exactly one ticket with PDA signer seeds.
- Increments the refund count.

### `redeem`

Inputs:

- Nullifier hash.
- Groth16 proof and public witness.

Checks:

- Phase is `Resolved`.
- Winning count and payout are nonzero.
- Recipient token account uses market mint.
- Recipient binding in the witness matches the destination owner or token account.
- Witness binds market, root, outcome, ticket, payout, recipient, and nullifier.
- Redeem verifier is immutable and executable.
- Claim PDA is new.
- Verifier CPI succeeds.

Effects:

- Creates the Claim PDA before transfer.
- Increments claim count.
- Transfers the calculated USDC payout.
- Closes the market when all winning claims complete.

## 5. Pari-mutuel economics and protocol revenue

Every order contributes the same one-USDC ticket. After batch and resolution:

```text
grossPool = ticketAmount * orderCount
winningCount = yesCount when outcome is YES, otherwise noCount
protocolFee = floor(grossPool * feeBps / 10_000)
netPool = grossPool - protocolFee
payoutPerWinner = floor(netPool / winningCount)
```

Example:

| Orders | YES | NO | Outcome | Gross pool | Fee | Per-winner payout |
| ---: | ---: | ---: | --- | ---: | ---: | ---: |
| 7 | 4 | 3 | YES | 7.000000 | 0.070000 | 1.732500 USDC |
| 7 | 4 | 3 | NO | 7.000000 | 0.070000 | 2.310000 USDC |

The remainder from integer division is less than `winningCount` base units. P0 leaves only this microscopic dust in the vault.

If either side has zero tickets at batch time, the pool is unmatched and enters `Refunding` before the match result is accepted. Every original ticket is returned and the fee is zero. A resolved market therefore always has a nonzero winning count.

Timeout and cancellation refunds also return the full one-USDC ticket. No fee leaves the vault before a successful final result. This keeps the protocol neutral to YES or NO and prevents revenue incentives to force an invalid settlement.

At the current rate:

```text
protocolRevenue = successfullySettledVolume * 1%
```

P1 may route a disclosed portion of fees to committee operators, keepers, or liquidity incentives. The P0 contract routes the full fee to the protocol treasury to keep settlement deterministic.

## 6. Solvency invariants

- Each active order corresponds to exactly one deposited ticket.
- `yesCount + noCount == orderCount` at batch finalization.
- `payoutPerWinner * winningCount <= ticketAmount * orderCount`.
- `protocolFee + payoutPerWinner * winningCount <= grossPool`.
- Protocol fee is zero for every refund path and one-sided batch.
- Protocol fee can be collected only once and only by the pinned treasury account.
- A claim nullifier is accepted at most once.
- An order can be refunded at most once.
- A market cannot be both resolved and refunding through separate paths.
- Total successful claims plus refunds never exceed vault deposits.
- No transfer can spend tokens from a different mint or vault.
- No caller can substitute the verifier, TxLINE program, or token program.
- Resolution cannot change after the first successful result.

All multiplication uses `u128` intermediates, checked conversion to `u64`, and release overflow checks.

## 7. Required negative tests

- Wrong mint, token program, vault, vault authority, source owner, or destination owner.
- Duplicate commitment or nullifier.
- Invalid or mutated proof witness.
- Wrong payer binding.
- Place before creation, after lock, or outside `Open`.
- Batch before lock, after deadline, with bad counts, duplicate signers, or unknown signers.
- Wrong fixture, stat keys, key order, period, root owner, root PDA, TxLINE program, or return-data origin.
- Early fallback resolution or fallback against a CPI-only market.
- Double resolution.
- Division by zero, multiplication overflow, and payout truncation boundaries.
- Fee basis points above the cap, wrong treasury owner, wrong treasury ATA, repeat fee collection, and fee collection during one-sided or timeout refund.
- Repeat claim, repeat refund, claim after refund mode, and refund after resolution.
- Account aliasing and writable-account substitution.

## 8. Deployment posture

- Devnet only.
- Unaudited and not production safe.
- Real Circle devnet USDC, which has no monetary value.
- Program and verifier upgrade authority state published in the README.
- No private keypair committed, logged, or embedded in deployment JSON.

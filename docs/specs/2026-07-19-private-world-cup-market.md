# Moros Cup Private Prediction Market

- Date: 2026-07-19
- Status: Approved for implementation
- Target: Solana devnet and the TxODDS Prediction Markets and Settlement track

## Goal

Build a binary World Cup prediction pool where a trader's YES or NO choice stays hidden while the market is open. A zero-knowledge proof must be accepted on Solana before an order can enter the pool. Final settlement must use TxLINE's Solana-anchored score proof through a CPI into `validate_stat_v2`.

The first market shape is:

> Will the selected home team win the selected fixture?

YES means the final home score is greater than the final away score. NO covers a draw or an away win.

## Product scope

The MVP is a fixed-ticket pari-mutuel pool. Every order deposits the same amount of devnet SOL. Fixed tickets remove individual size as an information leak and make payouts deterministic without exposing variable positions.

The market does not use an LMSR in the MVP. Private per-trade LMSR pricing either leaks each trade's direction or requires a more complex proved batch update. Aggregate batch odds remain public after a batch closes.

## Privacy guarantees

Private from public chain observers while the market is open:

- The YES or NO side of each order.
- The order secret and redemption nullifier.
- Each committee member's threshold share for the order.
- The link between an accepted commitment and a later proof-based redemption.

Public:

- The payer wallet and market.
- The fixed ticket amount and number of orders.
- Order commitments and threshold-share commitments.
- Aggregate YES and NO counts after the batch closes.
- Final outcome, payout per winning ticket, nullifiers, and recipient accounts.

Token-2022 Confidential Transfer can hide transfer amounts and balances, but token account addresses remain public. It is not part of the first deploy because fixed-size SOL tickets already avoid variable-size leakage and keep the wallet flow usable. Confidential collateral is a later extension.

## ZK placement proof

The Noir placement circuit uses BN254 and is compiled to Groth16 by Sunspot. A Sunspot verifier program is deployed separately on Solana.

Private inputs:

- `side`, constrained to `0` or `1`.
- `secret` and `nullifier`.
- A random coefficient used for 2-of-3 Shamir sharing.
- One salt for each committee share commitment.

Public inputs:

- Market field identifier.
- Fixed ticket amount.
- Payer hash.
- Order commitment.
- Three committee share commitments.

The circuit proves:

1. The order commitment binds the market, ticket amount, side, secret, and nullifier.
2. The side is binary.
3. The three shares lie on one degree-one polynomial whose value at zero is the side.
4. Every public share commitment binds its share and salt.
5. The proof is bound to the payer hash supplied by the market program.

The market program checks the public witness fields, then CPIs into the verifier. A proof that is valid but bound to another market, payer, stake, or commitment is rejected.

## Threshold batch

Each client sends one share and salt to each of three committee members over separate authenticated channels. A member checks its share commitment against the public proof output. Members sum shares per market batch. Any two aggregate shares reconstruct only the aggregate YES count.

The committee submits:

- Commitment Merkle root.
- Aggregate YES count.
- Aggregate NO count.
- Batch identifier.

At least two configured committee accounts must sign the Solana transaction. The program rejects duplicate signer accounts and requires `yes_count + no_count == active_order_count`.

Two colluding committee members can reconstruct individual sides if they combine per-order shares. The design protects against one curious or compromised member, not against threshold collusion.

## State machine

```text
Open -> Batched -> Resolved
  |         |          |
  |         |          -> Redeeming -> Closed
  |         |
  |         -> Refunding after resolution timeout
  |
  -> Refunding after batch timeout
```

Transitions:

| Transition | Caller | Gate | Effect |
| --- | --- | --- | --- |
| Create | Creator | Valid future deadlines and fixed stake | Creates market and vault |
| Place order | Trader | Market open and before lock time | Verifies ZK proof and escrows one ticket |
| Submit batch | Any transaction with committee quorum | After lock and before batch timeout | Stores root and aggregate counts |
| Resolve | Anyone | Batch exists and fixture is final | CPIs into TxLINE and stores YES or NO |
| Redeem | Any relayer | Valid redeem proof and unused nullifier | Pays proof-bound recipient |
| Begin refund | Anyone | Batch timeout or resolution timeout elapsed | Makes original tickets refundable |
| Refund | Original payer | Market is refunding and order is unrefunded | Returns one ticket |

A winning trader naturally benefits from calling resolution, so resolution does not require an admin or a paid keeper. Refund timeouts prevent the committee or TxLINE availability from permanently locking funds.

## TxLINE settlement

Devnet program:

`6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J`

The resolver accepts a typed TxLINE `StatValidationInput`, verifies:

- `fixture_summary.fixture_id` equals the market fixture.
- Exactly two final-period score leaves are supplied.
- Their keys match the configured home and away score keys.
- Both score periods are `100`, the TxLINE finalized-match period.
- The supplied daily root PDA belongs to the configured TxLINE program.

The program constructs a fixed V2 strategy for `home_score - away_score > 0`, serializes the official `validate_stat_v2` discriminator, invokes TxLINE, and reads its boolean return data. A successful `true` result resolves YES. A successful `false` result resolves NO. Invalid Merkle proofs fail inside TxLINE and do not resolve the market.

## Redemption

The redeem circuit proves:

- Knowledge of an order commitment preimage.
- Membership in the finalized commitment root.
- The hidden side equals the public winning outcome.
- The public nullifier is derived from the private nullifier and market.
- The proof is bound to the recipient hash and calculated payout.

The relayer submits the proof. The program checks the recipient hash, rejects reused nullifiers, and pays the recipient. The recipient does not need to sign the redemption transaction.

## Invariants

- Every accepted order escrows exactly one fixed ticket.
- `yes_count + no_count` equals the number of active orders in a finalized batch.
- A nullifier can be redeemed only once.
- A placed order can be paid, refunded, or remain pending, but never more than one of those.
- Total successful payouts and refunds cannot exceed vault deposits.
- Resolution is one-way and cannot be changed after TxLINE validation.

## Security and deployment status

This is an unaudited hackathon prototype for devnet only. It must not custody real value. The Groth16 setup generated by Sunspot is a development setup and is not safe for production without an independent ceremony or a different proving setup.

## Source architecture reused

The design adapts Moros on Stellar from `/home/shreyas/code/work/agentic-payment-infra/`:

- Commitment and nullifier based private positions.
- Threshold-only aggregate disclosure.
- Committee quorum for batch acceptance.
- Proof-bound, relayed redemption.
- Timeout paths for unavailable offchain services.

The Soroban contracts and BLS12-381 proof artifacts are not copied because Solana's deployable verifier path uses BN254.

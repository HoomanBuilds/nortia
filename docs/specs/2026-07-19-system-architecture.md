# Moros Cup System Architecture

- Date: 2026-07-19
- Status: Current architecture
- Product: Private USDC World Cup prediction pool settled from TxLINE

## 1. Architecture at a glance

```text
Wallet-free browser
  |-- reads fixture, odds, score, replay, and settlement receipt
  `-- can inspect Solana state and explorer evidence

Connected trader browser
  |-- keeps order secret and recovery record locally
  |-- generates Noir placement and redeem proofs
  |-- sends one threshold share to each committee member
  `-- signs USDC placement transaction

Web server and TxLINE adapter
  |-- owns TxLINE guest JWT and API token
  |-- proxies normalized fixture, odds, score, and replay data
  `-- fetches final V2 Merkle proof for permissionless settlement

Three-member committee
  |-- verifies its private share against the public share commitment
  |-- observes accepted on-chain commitments
  `-- two members attest the final commitment root and aggregate counts

Solana devnet
  |-- Moros Cup Anchor program, protocol config, and PDA token vault
  |-- placement Groth16 verifier program
  |-- redeem Groth16 verifier program
  |-- Circle USDC mint and original SPL Token Program
  `-- TxLINE program and daily scores root PDA
```

## 2. Components

### Web application

Responsibilities:

- Provide a wallet-free market and replay experience.
- Show TxLINE as the source for fixture, odds, scores, and proof data.
- Connect a Solana wallet for private placement and claims.
- Run proof generation in a browser worker when stable.
- Store private position recovery data locally and support export.
- Build Anchor transactions and show precise lifecycle states.
- Render the settlement receipt and Solana explorer links.

The web app is not a source of truth for balances, phase, outcome, or claims. Those values come from Solana accounts and events.

### TxLINE adapter

Responsibilities:

- Complete TxLINE guest authentication and token activation.
- Keep credentials server-side.
- Normalize inconsistent uppercase and lowercase API field variants.
- Proxy snapshots, historical replay, and SSE without logging secrets.
- Select an observed final sequence and fetch the matching V2 proof.
- Derive the daily-root PDA from the proof timestamp.
- Produce the exact payload used by the client and on-chain resolver.

It must not archive or commit raw licensed feeds. A synthetic fallback is stored separately and labeled as simulation.

### Anchor market program

Responsibilities:

- Create immutable binary fixture markets.
- Hold fixed-ticket USDC in a market-specific PDA token account.
- Verify the placement public witness before accepting the ticket.
- Record order commitments without recording sides.
- Accept a two-of-three committee batch after lock.
- Invoke TxLINE V2 and consume the pinned bool return for settlement.
- Verify private winner claims and reject nullifier replay.
- Return tickets through permissionless timeout refunds.
- Collect the market's immutable one-percent protocol fee only after successful settlement.

### Groth16 verifier programs

Two Sunspot verifier programs are deployed:

- Placement verifier: proves a binary side, commitment opening, signer binding, and valid threshold shares.
- Redeem verifier: proves commitment membership, winning side, recipient binding, payout binding, and nullifier derivation.

The Anchor market program treats verifier IDs as immutable market configuration and rejects substitution.

### Committee

The P0 committee has three configured Solana identities and a two-member threshold.

Each member stores only:

- Market ID.
- Order commitment and order index.
- Its private share and salt.
- The accepted on-chain transaction signature.

After the market locks, members aggregate their shares. Any two aggregate shares recover the YES count. The NO count is `activeOrderCount - yesCount`. At least two distinct configured identities attest the commitment root and counts.

This committee is not the result oracle. TxLINE alone determines the match predicate.

### Deployment evidence

A canonical JSON record under `deployments/` is consumed by the web and scripts. It contains only public data:

- Network and RPC label.
- Git commit.
- Program and verifier IDs.
- USDC mint.
- TxLINE program.
- Market and vault addresses.
- Protocol config, fee basis points, and treasury address.
- Fixture ID and score keys.
- Creation, placement, batch, resolution, and claim signatures.
- Web URL and timestamp.

## 3. Data ownership boundaries

| Data | Browser | Web server | Committee | Solana | TxLINE |
| --- | --- | --- | --- | --- | --- |
| Fixture and score feed | Reads | Proxies | No | Proof roots only | Source |
| TxLINE JWT and API token | No | Private | No | No | Verifies |
| Wallet private key | Wallet only | No | No | Signatures only | No |
| Order side | Private | No | One share only | Hidden | No |
| Order secret and nullifier preimage | Private | No | No | Commitment only | No |
| Committee share | Sends one per member | No | One member only | Share commitment | No |
| Aggregate counts | Reads after lock | Reads | Produces | Source after batch | No |
| USDC balances | Reads | No | No | Source | No |
| Market result | Reads | Reads | Reads | Source after validation | Supplies proof |
| Position recovery record | Private local storage | No | No | No | No |

## 4. Flagship lifecycle

### Market creation

1. The deployment script selects one TxLINE fixture.
2. The web adapter verifies fixture metadata and participant names.
3. The creator selects `Replay` for the compressed hackathon lifecycle or `Live` for a market that locks before kickoff.
4. The creator initializes a market for goal keys `1` and `2`, addition, threshold `2`, and greater-than comparison.
5. The program snapshots the current one-percent fee and protocol treasury from the protocol config.
6. The program creates a market PDA and a USDC vault controlled by the market PDA.
7. The web reads the new market from the canonical deployment record.

### Private placement

1. The browser generates `side`, `secret`, `nullifier`, a Shamir coefficient, and three share salts.
2. It computes the order commitment and three share commitments.
3. It generates a placement proof bound to the market, one-USDC ticket, payer, and commitments.
4. It sends each share only to its intended committee member.
5. It submits `placeOrder` with the proof and fixed ticket.
6. The market checks the public witness, invokes the verifier, records the order, and transfers USDC atomically.
7. The browser saves an encrypted or explicit user-exported recovery record locally.

If the transaction fails, no ticket is accepted and the committee ignores the unconfirmed share package.

### Batch

1. The committee observes `OrderPlaced` events and sorts commitments by on-chain order index.
2. After lock, members construct the fixed-depth commitment Merkle tree.
3. Two aggregate shares reconstruct only the YES count.
4. Two distinct committee identities attest the root, YES count, and NO count.
5. If either count is zero, the market cancels into `Refunding` before the result is known and charges no fee.
6. Otherwise the market moves from `Open` to `Batched` exactly once.

### TxLINE settlement

1. A browser or keeper selects an observed score record with `action=game_finalised` and `seq >= 1`.
2. The adapter requests V2 validation for stat keys `1,2`.
3. The transaction adds an adequate compute budget and calls `resolveWithTxline`.
4. The market validates payload bindings and CPIs into the pinned TxLINE program.
5. A true return resolves YES. A false return resolves NO.
6. The market computes the gross pool, one-percent fee, net pool, and winning-ticket payout.
7. The fee moves atomically to the pinned treasury. A failed fee transfer rolls back resolution.

### Private claim

1. A winner loads the local recovery record.
2. The client fetches or reconstructs the commitment Merkle path.
3. It generates a redeem proof bound to the public outcome, payout, recipient, and nullifier hash.
4. Any fee payer submits the transaction.
5. The market verifies the proof, creates a nullifier claim record, and transfers USDC to the proof-bound recipient.

## 5. State machine

```text
Open -> Batched -> Resolved -> Closed
  |         |
  |         `-> Refunding after resolution timeout
  `-> Refunding after batch timeout
```

| Transition | Caller | Gate | Result |
| --- | --- | --- | --- |
| Initialize | Creator | Valid immutable config and future deadlines | Creates market and vault |
| Place | Trader | Open and before lock | Verifies proof and deposits one ticket |
| Batch | Two committee signers | Locked and before batch deadline | Stores root and aggregate counts |
| Resolve | Anyone | Batched and valid final TxLINE proof | Stores one outcome and payout |
| Redeem | Any fee payer | Resolved and valid unused nullifier proof | Pays proof-bound recipient |
| Begin refund | Anyone | Batch or resolution deadline elapsed | Opens original-ticket refunds |
| Refund | Original payer | Refunding and order unused | Returns one fixed ticket |
| Close | Any caller | All winners claimed or all orders refunded | Marks terminal state |

A batch with zero tickets on either side enters `Refunding` instead of `Batched`. This avoids an unmatched one-sided pool and prevents an outcome-dependent free option.

## 6. Trust and failure model

| Dependency | Trust or failure | Mitigation |
| --- | --- | --- |
| TxLINE API | Availability and licensed access | Historical replay, synthetic labeled fallback, timeout refunds |
| TxLINE program | Correct proof verification | Pin devnet ID, root owner, PDA, return-data origin, and payload |
| One committee member | May be curious or unavailable | One share reveals no side; two-of-three liveness |
| Two committee members | Can reconstruct individual sides or attest false aggregates | Disclose threshold trust; later replace with verifiable encrypted aggregation |
| Web server | Can omit or delay data | Solana remains source of financial truth; read receipts and explorer evidence |
| Browser storage | Can be lost | Prominent backup export before confirming placement |
| Relayer | Can be unavailable | Claims are permissionless and recipient-bound |
| Creator | Could choose misleading metadata | Flagship deployment is pinned; predicate fields and fixture ID are public |
| Protocol administrator | Could change future fee configuration | Each market snapshots fee and treasury; existing markets cannot change |
| Upgrade authority | Could replace devnet code | Publish authority state and unaudited prototype warning |

Replay mode deliberately does not provide real-time betting fairness because the historical result is already public. It exists to demonstrate the exact TxLINE proof and settlement lifecycle using valueless devnet assets. The UI and video must say this directly.

## 7. Deliberate exclusions

- No order book or continuous AMM.
- No user-created arbitrary markets.
- No variable stakes.
- No creator fee, order-entry fee, withdrawal fee, or hidden spread in addition to the disclosed one-percent protocol takeout.
- No TxL transfer path.
- No Token-2022 collateral path.
- No production ceremony or mainnet claim.
- No social database on the critical path.
- No claim that the committee hides sides from two colluding members.

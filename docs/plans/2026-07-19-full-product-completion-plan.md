# Nortia Full Product Completion Plan

Date: 2026-07-19

## Outcome

Ship Nortia as a coherent general prediction market protocol on Solana, not a visual prototype. Sports is the first production category and TxLINE is the first connected resolver. A judge must be able to understand the protocol, connect a wallet, inspect live or replay TxLINE markets, create a supported market, place a private fixed-ticket order while the market is open, observe the locked and settlement phases, and claim or refund from the portfolio.

## Repository boundaries

```text
nortia/
  programs/nortia/          Generic Anchor market, escrow, fee, claim, and refund core
  circuits/                 Noir placement and redeem circuits
  client/                   Shared commitments, proofs, economics, and committee code
  services/
    txline/                 First resolver adapter: authenticated sports data and proofs
    committee/              Threshold member and batch coordinator processes
    keeper/                 Market lock, batch, resolve, and refund automation
    indexer/                Program event and market account indexing
  web/                      Next.js landing page and wallet-backed application
  deployments/              Canonical devnet addresses and run receipts
  scripts/                  Deployment and demo orchestration
  docs/specs/               Product and protocol specifications
  docs/plans/               Executable build plans
```

`programs/` remains at the repository root because that is the standard Anchor layout. Renaming it to `contracts/` would fight the framework without adding clarity. Root `Cargo.toml` and `Anchor.toml` are therefore correct. JavaScript manifests belong inside `web/`, `client/`, and `services/`, not at the root.

## General market architecture

Nortia scales the same way mature prediction systems scale: one market and settlement core, many resolution adapters, and a discovery layer that indexes them uniformly.

```text
Question + outcomes + close time + resolver specification
  > private USDC market core
  > resolver adapter
      > TxLINE sports statistics, connected now
      > price oracle conditions, later adapter
      > optimistic assertion conditions, later adapter
      > governance or public-data conditions, later adapter
  > one normalized resolution receipt
  > claim or refund
```

The core must not contain World Cup team names or assume goal totals. It stores a question hash, category, binary outcome definition, close time, and resolver configuration. Resolver-specific validation lives behind an explicit instruction or adapter module. The current build only labels TxLINE sports markets as connected. Other categories are part of the extensible interface but are never presented as live until their resolver is implemented and tested.

## Product state machine

| State | Gate | Allowed user action | Permissionless maintenance | Exit |
| --- | --- | --- | --- | --- |
| Open | Current time is before `lock_ts` | Place one or more private 1 USDC tickets | Read and index orders | Lock time passes |
| Locked | Phase is Open and current time is at or after `lock_ts` | No new orders | Committee submits aggregate before batch deadline | Batched or Refunding |
| Batched | Both sides have at least one order | Wait for result | Keeper submits final TxLINE proof | Resolved or Refunding |
| Resolved | TxLINE final record validates | Winner redeems with a proof | Any relayer may submit a bound redeem proof | Closed after all winners claim |
| Refunding | One-sided batch, cancelled fixture, or timeout | Original payer refunds each ticket | Anyone may open refunds after deadline | Closed after all tickets refund |
| Closed | Terminal | Inspect receipt | None | None |

Every time transition is enforced in the Anchor program. The web derives the same state from account data and clock time. An expired or locked market never renders an enabled order action.

## Critical gap review

### Onchain program

- Keep fixed 1 USDC tickets and the 1 percent success-only protocol fee.
- Keep no fee on one-sided pools, cancelled fixtures, timeouts, or refunds.
- Move committee and verifier configuration into protocol-owned defaults so a public creator cannot install a malicious verifier or committee.
- Make supported market creation permissionless but constrained to TxLINE fixtures and supported predicates.
- Separate generic market accounting from TxLINE-specific resolution fields and instructions.
- Add category, question hash, rules hash, resolver kind, and final evidence hash to every market account and receipt.
- Split the one-percent success fee 90% to Nortia treasury and 10% to the resolving keeper by default. The protocol configuration caps the keeper share at half of the fee.
- Account for integer payout remainder and provide a deterministic close path so vault dust is never trapped.
- Bind settlement sequence and final TxLINE record fields to the verified payload.
- Add transition, boundary-time, overflow, duplicate, wrong-account, and vault-conservation tests.

### Services

- TxLINE adapter uses the devnet API host and keeps API tokens server-side.
- Indexer subscribes to `MarketCreated`, `OrderPlaced`, `BatchSubmitted`, `MarketResolved`, `OrderRefunded`, and `WinningsRedeemed`.
- Committee coordinator builds the commitment tree and submits a 2-of-3 aggregate.
- Keeper scans due markets and performs batch, resolve, or refund transitions.
- Services are restart-safe and idempotent. A transaction signature is persisted before advancing a job.
- Users always retain a permissionless refund path if every service disappears.

### Web application

- Use Wallet Standard through the official Solana wallet adapter.
- Read SOL, devnet USDC, protocol configuration, market accounts, and transaction confirmation from RPC.
- Keep replay data clearly labeled and separate from onchain data.
- Add `/markets/create` with fixture, predicate, threshold, timing, and transaction review.
- Add `/proofs` as a complete verification dashboard instead of a deep link to one market tab.
- Make `/portfolio` wallet-aware and recovery-aware, with open, claimable, refunded, and closed states.
- Make market order actions respond to actual market state: connect, insufficient SOL, insufficient USDC, proving, wallet approval, confirming, confirmed, locked, batched, resolved, refundable, and closed.
- Use one application shell width, type scale, spacing grid, and page header pattern across markets, create, details, proofs, and portfolio.
- Add general discovery categories and resolver filters without inventing live markets for adapters that are not connected.

### Deployments and submission

- Store program, verifier, TxLINE, mint, protocol PDA, committee, and sample market addresses in one devnet manifest.
- Include explorer links and transaction receipts for protocol initialization, market creation, order placement, batch submission, settlement, claim, and refund.
- Add a root README, `.env.example` files, and exact start commands.
- Record the demo against a TxLINE-covered fixture and show the wallet signature and settlement receipt.

## Execution order

### Phase 1: Coherent application shell

1. Normalize width, heading scale, and page structure.
2. Add real wallet providers and connection controls.
3. Add create, proofs, portfolio, and lifecycle-aware market UI.
4. Replace the fictional flagship with actual TxLINE-covered fixtures.

### Phase 2: Browser transaction layer

1. Copy the generated Nortia IDL into the web client.
2. Add protocol and PDA helpers.
3. Add RPC reads and program deployment detection.
4. Add initialize market, place order, refund, and redeem transaction builders.
5. Persist private recovery records locally before wallet submission.

### Phase 3: Service layer

1. Add TxLINE client and normalized fixture models.
2. Add indexer and keeper processes.
3. Add committee process boundaries around the existing threshold logic.
4. Add health and job status endpoints consumed by the web app.

### Phase 4: Contract hardening

1. Constrain market creation to protocol defaults.
2. Add keeper economics and vault remainder handling.
3. Strengthen TxLINE final sequence binding.
4. Expand state transition and conservation tests.

### Phase 5: Devnet evidence

1. Build and deploy the program when the payer has enough devnet SOL.
2. Initialize protocol and create the flagship market.
3. Run one settlement and one refund path.
4. Save all addresses and signatures under `deployments/`.
5. Deploy the web app and run a fresh-wallet browser check.

## Acceptance checks

- No JavaScript manifest at the repository root.
- `cargo test -p nortia` passes.
- Client and service unit tests pass.
- Web typecheck and production build pass.
- No order instruction can be built after lock time.
- No fee is collected on a refund path.
- Default successful settlement routes 0.9% of gross pool volume to Nortia treasury and 0.1% to the resolving keeper.
- Winning claims and all refunds conserve the vault balance, including rounding remainder.
- Wallet cancellation, RPC failure, proof failure, and expired blockhash are distinct UI states.
- Pages at 390, 768, 1024, and 1440 pixels share the same shell and do not overflow.
- Replay, mocked, indexed, and onchain values are never presented as the same source.

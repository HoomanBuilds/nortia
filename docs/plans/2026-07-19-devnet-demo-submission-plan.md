# Devnet, Demo, and Submission Plan

- Date: 2026-07-19
- Deadline: 2026-07-19 23:59 UTC
- Feature freeze: 2026-07-19 21:15 UTC
- Target submission time: 2026-07-19 23:40 UTC

## 1. Evidence objective

The submission must show one complete flagship lifecycle with evidence a judge can inspect after the video:

```text
TxLINE fixture and replay
  -> private one-USDC tickets
  -> aggregate batch
  -> final TxLINE validation
  -> one-percent protocol revenue
  -> private USDC winner claim
```

The judge should not need a wallet to see the product, replay, settlement receipt, or explorer transactions.

## 2. Canonical demo scenario

Select a completed TxLINE World Cup fixture whose final total is at least three goals.

Create one market:

- Mode: Explicitly labeled compressed TxLINE replay.
- Question: Will the final match contain three or more total goals?
- Ticket: 1.000000 devnet USDC.
- Orders: three.
- Hidden sides: two YES and one NO.
- Batch result: YES 2, NO 1.
- Gross pool: 3.000000 USDC.
- Protocol fee: 0.030000 USDC.
- Net pool: 2.970000 USDC.
- YES payout: 1.485000 USDC per winning ticket.

Expected evidence:

- Three placement transactions with commitments and no public side.
- Two distinct committee attestations on the batch transaction.
- TxLINE final record and V2 proof receipt.
- Resolution transaction with fee transfer to treasury.
- Winning claim transaction with recipient balance increasing by 1.485000 USDC.

If the selected fixture has two or fewer goals, invert the prepared winning side and expected count while keeping the same deterministic predicate.

## 3. Environment preparation

- Dedicated devnet deployer and TxLINE service wallet.
- Three distinct committee keypairs.
- One trader wallet and one fresh recipient wallet.
- Sufficient devnet SOL for deployment, account rent, proving transactions, and TxLINE subscription.
- Circle devnet USDC in trader accounts.
- Protocol treasury USDC ATA.
- TxLINE JWT and API token stored only in deployment environment secrets.
- Public RPC fallback configured.
- Browser profile with no private extensions or unrelated tabs.

Do not print, screen-record, or commit any keypair file or secret environment value.

## 4. Pre-deployment gates

### Circuits

- Locked Noir, Poseidon, and Sunspot versions.
- Placement and redeem tests pass.
- Valid proof verifies locally.
- Mutated public input fails.
- Verifier program identities generated and source IDs match their keypairs.

### Anchor program

- Format, build, and tests pass.
- Local mock-USDC lifecycle passes exact balance assertions.
- One-percent fee, zero-fee one-sided refund, timeout refund, and dust math pass.
- Verifier, token, treasury, and TxLINE substitution tests pass.
- Release overflow checks remain enabled.

### TxLINE

- Devnet subscription active.
- Fixtures, odds, replay, and V2 proof calls succeed.
- Final sequence is observed, positive, and recorded.
- Direct official V2 view succeeds.
- CPI gate result is documented.

### Web and services

- Production build passes.
- Wallet-free page works in a clean browser.
- No API credentials appear in client bundle.
- Committee health and share paths pass.
- Position export and import pass.

## 5. Deployment order

1. Generate fresh unprinted public program identities.
2. Deploy the placement verifier.
3. Deploy the redeem verifier.
4. Build the market program with the correct source identity and pinned verifier IDs.
5. Deploy the market program.
6. Initialize protocol config with Circle USDC, one-percent fee, treasury, and TxLINE program.
7. Initialize the flagship market and USDC vault.
8. Place three private tickets.
9. Submit aggregate batch with two committee signers.
10. Resolve from TxLINE or use the declared receipt fallback.
11. Claim one winning ticket to the fresh recipient.
12. Save public evidence to `deployments/devnet.json`.
13. Deploy the web application against that record.

## 6. Devnet record schema

```json
{
  "network": "devnet",
  "gitCommit": "",
  "deployedAt": "",
  "marketProgram": "",
  "placementVerifier": "",
  "redeemVerifier": "",
  "protocolConfig": "",
  "protocolFeeBps": 100,
  "treasuryOwner": "",
  "treasuryTokenAccount": "",
  "usdcMint": "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
  "txlineProgram": "6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J",
  "market": "",
  "vault": "",
  "fixtureId": 0,
  "finalSeq": 0,
  "transactions": {
    "initializeProtocol": "",
    "initializeMarket": "",
    "placements": [],
    "batch": "",
    "resolution": "",
    "claim": ""
  },
  "webUrl": ""
}
```

This file contains public addresses and signatures only.

## 7. Five-minute video plan

Target length: 4 minutes 30 seconds.

### 0:00-0:25: problem and promise

- World Cup prediction products usually require trust in a result operator and expose every position.
- Moros Cup accepts a private USDC prediction only after Solana verifies a proof, then settles from TxLINE.

Show the live product, not slides.

### 0:25-1:05: TxLINE data experience

- Open the featured fixture without a wallet.
- Show the TxLINE source badge, odds movement, score timeline, and replay state.
- State the exact endpoints in a small technical drawer.
- State that this is a completed-fixture replay with valueless devnet USDC, used because no live final result is guaranteed before judging.

### 1:05-2:10: private ticket

- Connect the prepared wallet.
- Select YES or NO and show the fixed one-USDC ticket.
- Point to the one-percent successful-settlement fee and zero-fee refund rule.
- Start proof generation, show the recovery backup, sign, and confirm.
- Cut slow proof waiting time if needed.

### 2:10-2:45: on-chain privacy evidence

- Open the placement transaction and Order PDA in Solana explorer.
- Show the commitment, fixed transfer, verifier invocation, and absence of public side.
- State the exact privacy limitation: any two committee members can collude.

### 2:45-3:15: private market signal

- Lock and batch the three prepared orders.
- Show only aggregate YES and NO counts and updated implied probability.
- Show two committee signers.

### 3:15-4:00: TxLINE settlement money shot

- Replay the final score record.
- Open the receipt and show keys 1 and 2, final sequence, period 100, root PDA, predicate, TxLINE program, and validation result.
- Open the resolution transaction.
- Show gross pool 3.00, fee 0.03, and net pool 2.97.

### 4:00-4:25: winner claim

- Import or open the winning private position.
- Generate the redeem proof and submit through the prepared flow.
- Show the fresh recipient gaining 1.485000 USDC and the nullifier preventing reuse.

### 4:25-4:30: close

- Show public repository and deployed URL.
- Close with: private positions, verifiable scores, deterministic USDC settlement.

## 8. Recording checklist

- Clean browser at 1440 by 900 or 1920 by 1080.
- Browser zoom 100 percent.
- TxLINE adapter and committee health green before recording.
- Prepared wallet balances visible but no secret material.
- Solana explorer tabs opened before recording.
- Exact transaction signatures copied to a safe public note.
- Notifications disabled.
- Cursor movement deliberate and slow.
- Audio peaks checked and no clipping.
- No unsupported production, live, legal, or privacy claim.
- Export is no longer than five minutes and plays from start to finish.
- Inspect at least one still from every scene and verify readable text.

## 9. README requirements

- One-sentence product description.
- Live URL and video link.
- Architecture diagram.
- Why TxLINE is primary.
- Exact TxLINE endpoints and program ID.
- USDC mint, fee model, and payout formula.
- Privacy boundary and two-member collusion limitation.
- Local setup and test commands.
- Devnet program IDs and explorer evidence.
- CPI mode or honest receipt-fallback disclosure.
- Security, legal, devnet, and trusted-setup warnings.
- TxLINE integration feedback.

## 10. TxLINE feedback outline

Positive:

- One normalized schema across fixtures, odds, and scores.
- Historical replay enables deterministic demos.
- Solana-anchored Merkle roots enable verifiable settlement.
- V2 indexed predicates support multi-stat sports conditions.

Friction to report only if observed:

- Network-specific IDL and credential matching.
- Guest activation complexity.
- Uppercase and lowercase response field variants.
- Lack of a turnkey Rust CPI crate.
- Payload size and compute requirements.
- Final-record and sequence selection clarity.

Feedback must describe actual experience, not assumptions.

## 11. Submission checklist

- Public repository is accessible without invitation.
- Deployed URL opens in a signed-out browser.
- Wallet-free replay works.
- Video is public or unlisted and no longer than five minutes.
- README contains exact endpoints.
- Program IDs and transactions match the deployed commit.
- No secret is present in files, Git history, logs, video, or source maps.
- Submission copy accurately identifies replay, simulation, CPI, or authority mode.
- Human owner reviewed the code, video, legal eligibility, and final form.
- Submission entered by 23:40 UTC.

## 12. Feature-freeze rule

After 21:15 UTC, reject any feature that does not directly fix:

- Broken deployment.
- Broken judge access.
- Incorrect money movement.
- Incorrect TxLINE or privacy claim.
- Missing receipt or explorer evidence.
- Build or test failure.
- Video or submission failure.

No new market type, animation, social feature, or cryptographic mechanism is allowed after freeze.

# Web and Services Architecture

- Date: 2026-07-19
- Status: Current specification
- Product surface: Responsive web application

## 1. Product principles

1. TxLINE is visible within the first screen.
2. A judge can understand and replay the product without a wallet.
3. Wallet connection is requested only when the user starts a financial action.
4. The fixed one-USDC ticket and one-percent settled-pool fee are shown before confirmation.
5. Every asynchronous step has a named state and recovery action.
6. Privacy claims are precise and available next to the bet action.
7. The settlement receipt is the product's technical centerpiece.
8. Mobile layout remains fully usable at 375 pixels.

## 2. Stack

- Next.js App Router and TypeScript.
- React server components for read-heavy shells.
- Client components only for wallet, SSE, charts, proving, and transactions.
- Tailwind CSS with semantic design tokens.
- shadcn and Radix primitives for accessible dialogs, tabs, tooltips, and sheets.
- TanStack Query for Solana and server-API caching.
- Anchor TypeScript client and Solana wallet adapter.
- Recharts or a light SVG line chart for odds history.
- Web Worker for browser proving.
- Local browser storage plus explicit JSON export for private recovery data.

No database is required for P0. Solana is the financial source of truth, TxLINE is the sports-data source, and private positions remain in the browser.

## 3. Visual system

The selected pattern is a dark, real-time operations terminal with visible trust signals. It must feel like sports data and financial infrastructure, not a casino.

### Tokens

| Role | Value |
| --- | --- |
| Background | Slate `#0F172A` |
| Surface | Slate `#172033` |
| Muted surface | Slate `#272F42` |
| Border | Slate `#334155` |
| Primary | Amber `#F59E0B` |
| Primary text | Slate `#0F172A` |
| Accent | Violet `#8B5CF6` |
| Foreground | Slate `#F8FAFC` |
| Destructive | Red `#EF4444` plus text and icon |

Typography:

- IBM Plex Sans for headings and body.
- IBM Plex Mono for odds, balances, timestamps, IDs, and countdowns.
- Base body size at least 16 pixels.
- Tabular numeric figures for prices and timers.

Rules:

- No decorative gradient, emoji icon, fake glass surface, or pulsing financial number.
- Use one Lucide outline icon family.
- Use visible 3-pixel focus rings.
- Keep normal-text contrast at least 4.5:1.
- Do not use color alone for YES, NO, live, error, or settled states.
- Respect reduced motion.
- Keep touch targets at least 44 by 44 pixels.

## 4. Routes

### `/`

Purpose:

- Explain the private World Cup pool in one sentence.
- Show TxLINE connection state and one featured live or replayed fixture.
- Display tournament market cards.
- Offer `Open market` and `Watch replay` without wallet connection.
- Show a compact three-step story: prove privately, settle from TxLINE, claim USDC.

### `/markets/[marketAddress]`

Purpose:

- Complete flagship terminal.
- Deep-linkable for judges and the demo.
- Read-only by default, trading controls unlock after wallet connection.

Desktop layout:

```text
12-column page
  8 columns: fixture, score timeline, TxLINE odds, proof receipt
  4 columns: private pool card, action state, wallet position
```

Mobile order:

1. Fixture and source state.
2. Score and phase.
3. Market question and pool state.
4. Primary action.
5. Odds chart and table.
6. Settlement receipt.
7. Technical details.

### `/portfolio`

Purpose:

- List locally stored private positions.
- Import and export recovery JSON.
- Show placed, batched, won, lost, refundable, claimed, and missing-backup states.
- Generate and submit claim or refund transactions.

If local storage is empty, explain that private positions cannot be discovered from a wallet address and provide an import action.

## 5. Market terminal components

### Source status

Shows:

- `LIVE`, `TXLINE REPLAY`, or `SIMULATION` text.
- API health.
- Last update time.
- TxLINE attribution.
- Retry or pause control.

Replay mode also shows a persistent notice: `Demonstration market using a completed fixture and valueless devnet USDC.`

### Fixture header

Shows:

- Competition and kickoff.
- Participant names and home marker.
- Current or final score.
- Match phase.
- Fixture ID in technical details.

### Score timeline

- Chronological match events and score updates.
- Replay play, pause, and restart.
- No autoplay motion when reduced motion is enabled.

### TxLINE odds chart

- Simple time-series line chart, not candlesticks.
- Visible legend and exact timestamp tooltip.
- Solid and dashed styles in addition to color.
- Accessible data table toggle.
- Skeleton, empty, error, paused, and stale states.

### Private pool card

Always shows:

- Question: `Will the final match contain three or more total goals?`
- Fixed ticket: `1.00 USDC`.
- Protocol fee: `1% of the pool, only on successful settlement`.
- Liquidity rule: at least one ticket is required on each side or every ticket is refunded with zero fee.
- Lock countdown or locked state.
- Ticket count.
- Before batch: individual sides and aggregate counts are hidden.
- After batch: YES and NO counts, net pool, implied probability, and estimated payout.

Side controls use text, icon, and border treatment. YES and NO cannot rely on green and red.

### Fee breakdown

Before signing:

```text
Your ticket                  1.000000 USDC
Fee if market settles        1.00% of gross pool
Fee on timeout or refund     0.000000 USDC
One-sided batch              full refund, zero fee
Final payout                 known after private batch
```

After settlement:

```text
Gross pool
Protocol fee and basis points
Net winner pool
Winning ticket count
Payout per winning ticket
Treasury token account
```

### Proof and transaction stepper

States:

1. Preparing secret and recovery record.
2. Generating placement proof.
3. Backing up private position.
4. Awaiting wallet signature.
5. Confirming USDC deposit.
6. Delivering committee shares.
7. Accepted.

The primary button is disabled during each non-repeatable action. Errors identify the failed step and offer a safe retry.

### Settlement receipt

Shows:

- Settlement mode.
- Fixture ID.
- Final observed sequence.
- Score keys `1` and `2` and their values.
- Period `100`.
- Predicate `goals1 + goals2 > 2`.
- Daily scores root PDA.
- TxLINE program ID.
- Validation result.
- Gross pool, protocol fee, net pool, and payout.
- Resolution transaction and Solana explorer link.
- Proof digest and copy controls.

The receipt has a compact human view and an expandable technical view.

## 6. Transaction UX rules

- Read balances from the stored market mint, never a hardcoded UI assumption alone.
- Show USDC values with six-decimal-safe integer conversion and no scientific notation.
- Show SOL separately only as network fee balance.
- Preflight wallet network, USDC ATA, SOL fee balance, committee health, lock time, and verifier availability.
- Never show success on wallet signature alone. Wait for confirmed transaction and expected account change.
- Keep explorer links for every accepted action.
- Explain expired blockhash, insufficient SOL, insufficient USDC, rejected proof, locked market, and stale TxLINE proof separately.
- Preserve the private recovery record even when a transaction fails, but mark it unconfirmed until its order event exists.

## 7. Server routes

### TxLINE adapter

- `GET /api/txline/health`
- `GET /api/txline/fixtures`
- `GET /api/txline/fixtures/{fixtureId}`
- `GET /api/txline/fixtures/{fixtureId}/odds`
- `GET /api/txline/fixtures/{fixtureId}/scores`
- `GET /api/txline/fixtures/{fixtureId}/replay`
- `GET /api/txline/fixtures/{fixtureId}/stream`
- `GET /api/txline/fixtures/{fixtureId}/settlement-proof?seq={seq}`

The browser receives normalized product DTOs. The settlement-proof route may return the official payload needed to build a transaction but never returns service credentials.

### Committee adapter

- `GET /api/committee/health`
- `POST /api/committee/{member}/shares`
- `GET /api/committee/markets/{market}/status`
- `POST /api/committee/markets/{market}/finalize`

Member endpoints may run as separate processes in production. The hackathon demo may proxy three local members while preserving distinct state and signing identities.

## 8. Client modules

```text
web/
  app/
    page.tsx
    markets/[marketAddress]/page.tsx
    portfolio/page.tsx
    api/txline/
    api/committee/
  components/
    fixture/
    market/
    proof/
    settlement/
    wallet/
  lib/
    anchor/
    commitments/
    positions/
    txline/
    numberFormat/
  workers/
    prove.worker.ts
```

Financial arithmetic stays in tested pure helpers. React components never calculate raw payouts with floating-point numbers.

## 9. Build order

### Web A: read-only shell

- Theme, navigation, source badge, loading and error boundaries.
- Fixture header and score replay.
- Wallet-free deep link.

### Web B: market data

- Solana market state.
- TxLINE odds line chart and accessible table.
- Pool card, fee explanation, and phase states.

### Web C: private placement

- Wallet connection and balance preflight.
- Side selection.
- Proof worker and recovery backup.
- Deposit transaction stepper.

### Web D: portfolio and claim

- Local position list and import.
- Redeem proof.
- Claim and refund transactions.

### Web E: receipt and demo polish

- Settlement receipt.
- Explorer evidence.
- Replay controls.
- Responsive and accessibility pass.

Each phase must pass typecheck, production build, relevant pure tests, and a manual browser check before the next phase.

## 10. Testing

- Pure tests for USDC formatting, fee math, DTO normalization, market phase labels, recovery import, and receipt mapping.
- Component tests for wallet-free rendering, fee disclosure, disabled actions, errors, and empty portfolio.
- Browser smoke tests for `/`, one market deep link, and `/portfolio` at 375, 768, 1024, and 1440 pixels.
- Keyboard navigation, visible focus, screen-reader labels, reduced motion, and 4.5:1 contrast.
- SSE duplicate, reorder, disconnect, reconnect, stale, and replay pause behavior.
- Transaction flow with signature rejection, expired blockhash, proof failure, insufficient balances, lock race, and successful confirmation.
- No TxLINE secret, private order input, or wallet key appears in client bundles, server logs, or source maps.

## 11. Deliberate cuts

- No comments, profiles, reactions, watchlists, or uploaded images.
- No admin dashboard.
- No arbitrary market builder.
- No multi-wallet discovery of private positions.
- No decorative animation beyond state transitions.
- No chart library heavier than required for one odds series.

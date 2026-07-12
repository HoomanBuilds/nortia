# TxODDS Hackathon Brief

- Date checked: 2026-07-19 14:54 UTC
- Submission deadline: 2026-07-19 23:59 UTC
- Track: Prediction Markets and Settlement
- Sponsor: TxODDS
- Current architecture: `docs/specs/2026-07-19-system-architecture.md`

## 1. Submission contract

The submission is eligible only if it includes all of the following:

1. A working mainnet or devnet build that uses TxLINE as a primary data source.
2. A public GitHub repository.
3. A deployed website or a functional API or devnet endpoint judges can test.
4. A demo video no longer than five minutes. The listing calls this an absolute initial-screen requirement.
5. Brief technical documentation that names the TxLINE endpoints used.
6. Product and integration feedback for TxLINE.

The judges score:

- Smooth ingestion and use of live or simulated TxLINE data.
- An intuitive and compelling soccer-fan experience.
- Clean, documented, deterministic resolution logic.

On-chain Merkle verification is optional but valued. A custom Solana settlement program that CPIs into TxLINE is the strongest technical path, but a non-working CPI must never be presented as trustless settlement.

Sources:

- [Superteam track listing](https://superteam.fun/earn/listing/prediction-markets-and-settlement)
- [TxLINE World Cup tier](https://txline.txodds.com/documentation/worldcup)
- [TxLINE hackathon terms](https://txline.txodds.com/documentation/legal/hackathon-terms)

## 2. Network and sponsor constants

| Item | Devnet value |
| --- | --- |
| Solana RPC | `https://api.devnet.solana.com` |
| TxLINE API origin | `https://txline-dev.txodds.com` |
| TxLINE API base | `https://txline-dev.txodds.com/api` |
| TxLINE program | `6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J` |
| TxL subscription mint | `4Zao8ocPhmMgq7PdsYWyxvqySMGx7xb9cMftPMkEokRG` |
| Circle devnet USDC mint | `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU` |
| USDC decimals | `6` |
| USDC token program | Original SPL Token Program, not Token-2022 |

The network must remain consistent across RPC, program ID, subscription transaction, guest JWT, API token, proof payload, and daily-root PDA.

TxL is only for TxLINE data authorization. It must not be used as market collateral, a wager, a pool asset, or a payout token. User collateral is Circle devnet USDC.

Sources:

- [TxLINE quickstart](https://txline.txodds.com/documentation/quickstart)
- [TxLINE program addresses](https://txline.txodds.com/documentation/programs/addresses)
- [Circle USDC addresses](https://developers.circle.com/stablecoins/usdc-contract-addresses)

## 3. Required TxLINE product surface

The product must make TxLINE visible rather than hiding it behind settlement.

Required feeds:

| Use | Endpoint |
| --- | --- |
| Tournament discovery | `GET /api/fixtures/snapshot` |
| Match odds | `GET /api/odds/snapshot/{fixtureId}` |
| Odds movement | `GET /api/odds/stream` |
| Score state | `GET /api/scores/snapshot/{fixtureId}` |
| Score movement | `GET /api/scores/stream` |
| Replay fallback | `GET /api/scores/historical/{fixtureId}` |
| Settlement proof | `GET /api/scores/stat-validation?fixtureId={id}&seq={seq}&statKeys=1,2` |

The deployed app needs a wallet-free read-only path so judges can inspect the product without buying tokens, creating a wallet, or paying fees. Wallet connection is only required for placing or claiming a USDC prediction.

## 4. Chosen flagship market

The flagship market is:

> Will the final match contain three or more total goals?

YES means `participant1 goals + participant2 goals > 2`. NO means total goals are two or fewer.

This market was selected because:

- It is a binary soccer-native question.
- It avoids ambiguous three-way winner settlement.
- It does not depend on which participant is home.
- TxLINE V2 can validate it using full-game goal keys `1` and `2`.
- The result remains correct through regulation, extra time, and penalties when the chosen final record uses `action=game_finalised`, `statusId=100`, and `period=100`.
- It is easy to explain in a short demo.

The app may display other World Cup fixtures and markets, but only this flagship market belongs on the submission critical path.

The recorded submission lifecycle uses `Replay` mode with a completed TxLINE fixture so judges can see a deterministic final proof before the deadline. Replay mode is visibly labeled and uses devnet USDC with no value. A production `Live` market would close before the real kickoff and would not accept predictions after the outcome is knowable.

## 5. Collateral decision

Use fixed one-USDC tickets in the first private pari-mutuel pool.

Reasons:

- USDC is the normal unit users expect for prediction-market stakes and payouts.
- The sponsor explicitly permits assets such as USDC while prohibiting TxL transfers.
- Fixed tickets prevent stake size from leaking the hidden side through a unique amount.
- Six-decimal integer arithmetic is deterministic and simple to test.
- Circle provides a public devnet faucet.

Token-2022 Confidential Transfer is not in the submission architecture. Circle devnet USDC uses the original SPL Token Program, and mixing it with Token-2022 would derive incompatible token accounts. Confidential Transfer also does not hide token account addresses and adds unnecessary activation and runtime risk.

## 6. Revenue decision

The platform earns a one percent protocol fee from each successfully settled pool. The fee is calculated on the whole gross pool immediately after the TxLINE result is accepted, then the remaining net pool is divided among winners.

This follows the neutral-exchange principle used by large prediction platforms without copying an order-book formula into a pari-mutuel product:

- Polymarket charges outcome-neutral taker fees on configured markets and can charge builder fees as a percentage of matched notional.
- Kalshi earns transaction fees rather than taking a position on an outcome.
- A pari-mutuel market has no maker or taker fill, so the equivalent standard is a transparent takeout from the gross pool before distribution.

The first deployment uses `100` basis points. Every market snapshots the rate at creation, the program enforces a `300` basis-point maximum, and the fee cannot change after the first ticket enters.

Rules:

- Successfully settled market with at least one winner: collect one percent from the gross pool.
- Timeout, cancellation, invalid result, or one-sided batch: collect no fee and return full tickets.
- Never extract a fee at placement, because a later refund must return the complete ticket.
- Transfer the fee atomically during successful resolution to the market's pinned protocol treasury USDC account.
- Show gross pool, protocol fee, net pool, and payout in the UI and settlement receipt.

Sources:

- [Polymarket trading fees](https://docs.polymarket.com/trading/fees)
- [Polymarket builder fee limits](https://docs.polymarket.com/builders/fees)
- [Kalshi revenue model](https://help.kalshi.com/en/articles/13823767-how-does-kalshi-make-money)

## 7. Compliance and demo constraints

- The project is an unaudited devnet prototype and must not custody real value.
- The UI must avoid language that promises profit or presents the prototype as legally available gambling.
- Do not commit TxLINE JWTs, API tokens, wallet keypairs, raw private witnesses, or raw licensed feed archives.
- A synthetic schema-compatible fixture is allowed only as an explicitly labeled simulation fallback.
- Historical TxLINE replay must be labeled as replayed signed data, not live data.
- The human submitter must own the submission and retain substantive review and control. The listing mentions human-owned agent submissions, while the sponsor terms contain stricter agent-control language. The human submitter must review the final repository, video, statements, and form before submission.
- The final video and deployed read-only experience must remain useful even if live World Cup activity is unavailable during judging.

## 8. Deadline policy

The feature freeze is 21:15 UTC. After that time, only fixes that unblock deployment, the video, repository clarity, or the submission form are allowed.

The final submission should be entered by 23:40 UTC, leaving a 19-minute buffer for platform or verification failures.

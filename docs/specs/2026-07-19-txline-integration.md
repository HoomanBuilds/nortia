# TxLINE Feed and Settlement Specification

- Date: 2026-07-19
- Status: Current specification
- Network: Solana devnet only
- Official IDL version: `1.5.6`
- Audited repository commit: `b6981f31e6f230cc1ef1729c34182414a1419682`

## 1. Purpose

TxLINE is both the visible sports-data layer and the result-verification source. The application must not use TxLINE only as a hidden final oracle.

The flagship page visibly attributes:

- Fixture participants and kickoff.
- Consensus odds and odds movement.
- Score timeline and match phase.
- Historical replay or live stream state.
- Final validation payload and Solana receipt.

## 2. Network configuration

```text
rpcUrl = https://api.devnet.solana.com
apiOrigin = https://txline-dev.txodds.com
apiBaseUrl = https://txline-dev.txodds.com/api
programId = 6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J
txlMint = 4Zao8ocPhmMgq7PdsYWyxvqySMGx7xb9cMftPMkEokRG
serviceLevel = 1
```

Every request, proof, PDA, and transaction must use this same network. Mainnet JWTs, API tokens, programs, or proofs cannot be mixed with devnet.

## 3. Authentication

The server-side adapter owns the TxLINE service wallet and credentials.

Flow:

1. Start a guest session through `POST /auth/guest/start`.
2. Submit the free-tier on-chain subscription with the same wallet.
3. Sign the exact activation message derived from transaction signature, selected leagues, and JWT.
4. Activate the API token.
5. Send both `Authorization: Bearer {jwt}` and `X-Api-Token: {apiToken}` on data requests.

Rules:

- Never send the API token to the browser.
- Never print JWTs, API tokens, or activation signatures.
- Refresh credentials before expiry and expose only a boolean source-health state.
- Fail closed when credentials and selected network do not match.

## 4. Read data contract

### Fixtures

Use:

- `GET /api/fixtures/snapshot`
- `GET /api/fixtures/updates/{epochDay}/{hour}` when required

Normalize at least:

- Fixture ID.
- Competition.
- Start time.
- Participant 1 and participant 2 IDs and names.
- `participant1IsHome`.
- Game state.

### Odds

Use:

- `GET /api/odds/snapshot/{fixtureId}`
- `GET /api/odds/stream`

The UI labels these as TxLINE consensus odds. They are a sports-data benchmark, not the private pool's post-batch implied probability.

### Scores

Use:

- `GET /api/scores/snapshot/{fixtureId}`
- `GET /api/scores/stream`
- `GET /api/scores/historical/{fixtureId}` for replay

The adapter normalizes `FixtureId` and `fixtureId`, `Seq` and `seq`, and the corresponding timestamp and state variants. A score sequence must be a positive observed integer. The resolver must never invent `seq=0`.

## 5. Soccer stat contract

Full-game score keys:

| Key | Meaning |
| ---: | --- |
| `1` | Participant 1 goals |
| `2` | Participant 2 goals |
| `3`, `4` | Yellow cards |
| `5`, `6` | Red cards |
| `7`, `8` | Corners |

The flagship requests keys `1,2` in that exact order.

Final settlement record requirements:

- `action == game_finalised` in the observed feed record.
- `statusId == 100` in the observed feed record.
- `period == 100` in both proven score leaves.
- `seq >= 1` and equal to the observed final record sequence.

## 6. Stat-proof request

```text
GET /api/scores/stat-validation
  ?fixtureId={market.fixtureId}
  &seq={observedFinalSeq}
  &statKeys=1,2
```

Map the response into the exact IDL `StatValidationInput` shape:

- `ts: i64`
- `fixtureSummary.fixtureId: i64`
- `fixtureSummary.updateStats.updateCount: i32`
- `fixtureSummary.updateStats.minTimestamp: i64`
- `fixtureSummary.updateStats.maxTimestamp: i64`
- `fixtureSummary.eventsSubTreeRoot: [u8; 32]`
- `fixtureProof: Vec<ProofNode>`
- `mainTreeProof: Vec<ProofNode>`
- `eventStatRoot: [u8; 32]`
- `stats: Vec<StatLeaf>`

Each `ProofNode` contains a 32-byte hash and `isRightSibling`. Reject hashes that do not decode to exactly 32 bytes.

Each `StatLeaf` contains:

- `ScoreStat { key: u32, value: i32, period: i32 }`
- Its proof vector.

## 7. Predicate strategy

The strategy is built inside the market program or compared byte-for-byte with the fixed expected shape. The caller cannot select a different economic result.

```text
geometricTargets = []
distancePredicate = None
discretePredicates = [
  Binary {
    indexA: 0,
    indexB: 1,
    op: Add,
    predicate: {
      threshold: 2,
      comparison: GreaterThan
    }
  }
]
```

The indexes refer to the order of requested keys, not the numeric key values.

## 8. Daily-root PDA

Derive the epoch day only from `payload.fixtureSummary.updateStats.minTimestamp`:

```text
epochDay = floor(minTimestamp / 86_400_000)
seeds = ["daily_scores_roots", epochDay as u16 little-endian]
```

Checks:

- `minTimestamp <= maxTimestamp`.
- Epoch day fits `u16`.
- Supplied root address equals the PDA derived with the pinned TxLINE program ID.
- Root account owner equals the pinned TxLINE program.
- Never derive the root from current wall-clock time.

## 9. CPI contract

The official `validate_stat_v2` discriminator is:

`[208, 215, 194, 214, 241, 71, 246, 178]`

Instruction data is:

```text
discriminator || AnchorSerialize(payload) || AnchorSerialize(strategy)
```

The only TxLINE instruction account is `daily_scores_merkle_roots`.

The outer transaction adds a compute-budget instruction. The current official examples request up to 1,400,000 compute units.

After CPI:

1. Read Solana return data.
2. Require the return-data program ID to equal the pinned TxLINE program.
3. Require one canonical serialized bool.
4. Treat true as YES and false as NO.
5. Treat missing, malformed, or foreign return data as an error.

The complete market resolution, protocol-fee transfer, and phase change must roll back if CPI or return validation fails.

## 10. CPI feasibility gate

Before the rest of the program depends on CPI, measure:

- Raw payload size.
- Full instruction size.
- Full versioned transaction size.
- Compute units consumed by direct stat validation.
- Compute units consumed through the market CPI.
- Whether address lookup tables are needed.
- Whether the official daily root exists for the selected proof.

Passing evidence:

- Official direct `.view()` succeeds.
- The same payload succeeds through local or devnet market CPI.
- The market reads the expected bool from TxLINE.
- Mutating a hash, fixture, key, period, root, or program fails.

## 11. Receipt-based fallback

If atomic CPI misses the scheduled gate, ship a separate market configured at creation for `AuthorityReceipt` settlement.

Fallback flow:

1. Server fetches the same stat proof.
2. Official TxLINE program validates it through `.view()` simulation.
3. The app records proof digest, fixture, sequence, values, root PDA, simulation logs, and result.
4. A pinned resolution authority submits the one-way result to Nortia.
5. The receipt UI labels the mode as `TxLINE proof validated, authority relayed`.

Never label this fallback as atomic, permissionless, or trustless. Timeout refunds remain available if the authority does not act.

## 12. Replay and simulation policy

Priority:

1. Live TxLINE SSE.
2. TxLINE historical replay for an eligible completed fixture.
3. Synthetic schema-compatible fallback.

The visual state always shows one of `LIVE`, `TXLINE REPLAY`, or `SIMULATION`. A synthetic fixture cannot produce a claimed official on-chain result.

The submission's compressed lifecycle uses `TXLINE REPLAY` with real historical TxLINE proof data. Since the final outcome is already public, replay tickets have no real economic meaning and use only valueless devnet USDC. This limitation must remain next to the market mode and in the settlement receipt.

## 13. Required tests

- Network, host, and program mismatch.
- Missing or expired authentication.
- Uppercase and lowercase API field variants.
- SSE disconnect, reconnect, duplicate message, and stale message.
- Empty snapshot and missing final record.
- `seq=0` rejection.
- Wrong action, status, period, stat keys, or key order.
- Incorrect 32-byte decoding.
- Epoch-day boundary and little-endian encoding.
- Wrong daily-root owner and PDA.
- Invalid proof node.
- TxLINE CPI false result versus CPI error.
- Missing, malformed, or foreign return data.
- Duplicate settlement.

## 14. Official references

- [World Cup free tier](https://txline.txodds.com/documentation/worldcup)
- [On-chain validation](https://txline.txodds.com/documentation/examples/onchain-validation)
- [Soccer feed](https://txline.txodds.com/documentation/scores/soccer-feed)
- [Streaming data](https://txline.txodds.com/documentation/examples/streaming-data)
- [Runnable devnet examples](https://txline.txodds.com/documentation/examples/devnet-examples)
- [Official devnet IDL](https://github.com/txodds/tx-on-chain/blob/main/examples/devnet/idl/txoracle.json)

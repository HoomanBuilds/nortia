# Nortia V2 security and deployment review

- Review date: 2026-07-20
- Network scope: Solana devnet only
- Collateral scope: Circle devnet USDC only
- Deployment scope: additive upgrade of the existing Nortia program

## Outcome

The V2 source, generated IDL, service adapters, client math, wallet flows, and web build pass their local release gates. The existing V1 deployment remains live. The V2 program upgrade is not yet live because the upgrade-authority wallet cannot currently cover both ProgramData growth and the temporary upload buffer.

The deployment script now exits before spending funds when the cluster, authority, artifact, capacity, rent, or transient balance gate fails.

## Verified gates

| Gate | Result |
| --- | --- |
| Rust formatting | Pass |
| Clippy with warnings denied | Pass |
| Rust unit and randomized tests | 61 pass |
| Client tests | 38 pass |
| Service tests | 30 pass |
| Client and service TypeScript checks | Pass |
| Anchor SBF build | Pass |
| Next.js TypeScript check | Pass |
| Next.js optimized production build | Pass |
| Desktop visual review | Pass |
| True 390px device emulation | Pass, no page-level horizontal overflow |
| V1 program and PDA decoding | Pass against current devnet accounts |
| V2 deployment transaction | Pending devnet SOL funding |

## Protocol properties reviewed

### LMSR and collateral

- Settlement-critical math is integer-only.
- Buy cost rounds up and sell proceeds round down.
- Immediate round trips cannot profit in tested vectors and randomized sequences.
- Creator subsidy covers `ceil(b * ln(2))` plus the rounding reserve.
- Every buy, sell, resolution, claim, and liquidity withdrawal preserves the outstanding-liability bound.
- The creator cannot withdraw collateral reserved for unsettled traders.
- A V2 market enters `Closed` only when outstanding liability and projected vault balance are both zero.
- The optimistic resolver caps each binary liability by the configured bond.

### State and authorization

- V2 uses additive PDA namespaces and does not alter V1 account layouts.
- Trading requires `Open`, a time strictly before lock, an unexpired user deadline, and a valid exact-share size.
- Price guards are maximum spend for buys and minimum proceeds for sells.
- Position PDAs bind market and wallet owner.
- Metadata publication requires the creator and exact question, rule, and outcome-label hashes.
- Resolution receipt creation is one-time and oracle configuration is marked consumed.
- Terminal and timeout transitions are permissionless where intended.

### Oracle verification

- TxLINE binds program, fixture, final-period stats, root PDA, time bounds, CPI return origin, and normalized receipt evidence.
- Pyth requires the receiver-owned `PriceUpdateV2`, full verification, exact feed ID, a unique interval bracketing the target timestamp, bounded publish lag, positive price, and bounded confidence.
- Switchboard requires the quote-program owner, pinned devnet queue, canonical quote PDA, exact feed hash, distinct oracle identities, sample threshold, observation window, and slot age.
- Optimistic assertions bind role, market, outcome, and canonical public evidence URI to a domain-separated SHA-256 hash.
- Optimistic disputes conserve the two-bond vault and record pull-based proposer, challenger, and treasury claims.
- UMA and Chainlink variants fail closed during market creation.

### Provider profiles

- `free` is the default profile.
- Free mode pins public Pyth Hermes, strips Pyth credentials, paces requests, and pins public Switchboard Crossbar.
- `managed` preserves Pyth API-key and custom HTTPS provider support behind one explicit switch.
- Provider changes do not change any onchain verification rule.
- Keeper logs identify provider mode and origin without logging credentials.

## Findings fixed during review

1. The deployment workflow could begin expensive work without calculating ProgramData growth and temporary buffer rent. It now performs a fail-fast funding preflight.
2. The initializer returned when the V1 protocol PDA existed and therefore skipped V2 engine initialization. It now initializes each layer idempotently.
3. The deploy path accepted any configured RPC origin. It now checks the Solana devnet genesis hash.
4. The V2 `Closed` enum had no reachable transition. Markets now close only after liability and the vault are fully drained.
5. The landing page still described the V1 fixed-ticket and 90/10 fee model as the whole product. It now presents general LMSR markets and the separate legacy private-pool economics accurately.
6. Next.js carried a vulnerable nested PostCSS release. A compatible override pins the patched release.

## Residual risks and release blockers

### Critical before mainnet

- No independent smart contract, circuit, oracle, or economic audit has been completed.
- The upgrade authority is a single devnet key. Production requires a reviewed multisig and an explicit upgrade or immutability policy.
- Optimistic dispute arbitration trusts the existing 2-of-3 Nortia committee to choose between the two submitted outcomes.
- Private-pool confidentiality trusts threshold committee behavior and the generated Sunspot verifier toolchain.
- Legal review is required for every target jurisdiction and market category.

### Devnet integration gaps

- V2 must be upgraded and the engine PDA initialized before wallet V2 actions become available.
- A canonical Pyth market still needs one full devnet create, trade, resolve, claim, and liquidity-withdraw receipt sequence.
- Switchboard feed definitions and managed update instructions must be provisioned externally before a canonical quote market can be demonstrated.
- TxLINE access still requires valid hackathon credentials for live API retrieval.
- Public oracle and RPC endpoints are rate-limited testing infrastructure, not a production service-level agreement.

### Dependency advisories

The compatible audit pass patched PostCSS and top-level Jayson UUID resolution. The current Solana Web3 v1 and SPL Token dependency tree still inherits the `bigint-buffer` advisory, and the Pyth SDK carries an older nested Jito Web3 and UUID path. The audit tool offers only breaking or invalid downgrades for these paths.

The repository does not apply `npm audit fix --force`. Mainnet release remains blocked until the Solana and Pyth dependency graph can move to patched compatible releases or the affected code paths are removed and revalidated.

## Deployment decision

Do not send an upgrade transaction until all of the following are true:

1. `scripts/deploy-devnet.sh` passes the genesis, authority, capacity, and transient-funding preflight.
2. The payer retains a fee reserve after ProgramData extension and buffer creation.
3. The generated IDL is synchronized to services and web.
4. All gates in this review pass on the exact deployment commit.
5. A post-upgrade read confirms that V1 accounts still decode and the V2 engine contains the intended 70/30 fee split.

After deployment, record program slot, ProgramData length, engine PDA, initialization signatures, demo market addresses, vaults, trades, receipts, claims, and final balances under `deployments/`.

# Nortia free oracle and feed expansion

Status: approved for implementation

## Objective

Nortia must support general prediction markets with evidence that Solana programs can verify directly. The product should expose as much useful free coverage as the available oracle networks safely permit, while showing API access, update costs, market-hour constraints, and resolver failure behavior before a creator signs.

The feed catalog is a discovery layer. It never weakens the immutable resolver configuration stored onchain.

## Oracle matrix

| Resolver | Categories | Coverage | Free access | Onchain verification | Product status |
| --- | --- | --- | --- | --- | --- |
| TxLINE | Sports | World Cup fixtures and supported match statistics | Hackathon access needs TxLINE credentials | CPI into the pinned TxLINE validation program | Ready for total-goals markets |
| Pyth sponsored push | Crypto, Economics | 47 sponsored Solana feeds | No Hermes key; normal Solana transaction and RPC costs apply | Pinned push program, canonical shard-0 PDA, full verification, exact feed ID, timestamp bracket, staleness, confidence | Preferred free price path |
| Pyth Hermes pull | Crypto, Economics | Current Hermes catalog, about 3,056 feeds across crypto, equities, FX, commodities, metals, rates, and indices | Public endpoint is rate limited today; Pyth says an API key is required from August 18, 2026 | Pinned receiver program, full verification, exact feed ID, timestamp bracket, staleness, confidence | Ready with server-side catalog and keeper access |
| Switchboard managed quote | Economics, Politics, Technology, Culture, Science, Other | Existing and custom deterministic numeric jobs | Public Crossbar supports low-volume testing without a key; custom upstream APIs may require their own keys | Pinned quote program and devnet queue, canonical quote PDA, exact feed hash, distinct signatures, minimum samples, slot freshness | Ready when a stored feed hash passes validation |
| Stork pull | Crypto, Economics | More than 500 assets advertised by Stork | Solana update API requires `STORK_API_TOKEN` from Stork | Pinned Stork program, canonical feed PDA, exact feed ID, positive 1e18 value, bounded timestamp | Supported but disabled until token and feed access are configured |
| Nortia bonded assertion | Politics, Technology, Culture, Science, Economics, Other | Long-tail objective facts | No oracle API key; proposers and challengers need USDC bonds | Native proposal, challenge, committee decision, evidence hashes, timeout invalidation | Ready |

UMA remains reserved for a future EVM Optimistic Oracle assertion plus a verified bridge. Chainlink remains reserved until an official Solana report verifier and exact report format are integrated. RedStone, DIA, and Supra are not enabled because current official documentation does not provide a Solana verification path suitable for this program.

## Pyth catalog policy

The server queries the official Hermes feed catalog and normalizes only entries with:

- an exact 32-byte feed ID;
- a supported asset class;
- a non-empty base, quote currency, symbol, and description;
- no deprecation marker;
- no Kalshi market-derived probability feed.

Asset classes map to Nortia categories as follows:

- Crypto, Crypto Redemption Rate, Crypto Index, and Crypto NAV map to Crypto.
- Equity, FX, Metal, Rates, Commodities, and ECO map to Economics.

The 47 official sponsored Solana feed IDs are tagged as `sponsored-push`. All other accepted feeds are tagged as `hermes-pull`. The creator sees the delivery mode, key requirement, schedule, quote currency, heartbeat where known, and resolver deadline.

Pyth price markets use a fixed threshold exponent of -8 in the creation client. The contract supports exponents from -18 through 18 and compares unlike decimal exponents without floating point arithmetic. Non-USD quotes must display their actual quote currency and must not receive a dollar sign.

Sponsored push settlement is intentionally narrow. The keeper must resolve while the current shard-0 account uniquely brackets the observation timestamp. If the keeper misses the bracket, it cannot choose an older value. The market reaches its resolution deadline and becomes invalid, allowing the contract refund path.

## Switchboard policy

A Switchboard market is created from an existing stored feed hash, not an arbitrary browser HTTP response. The creation flow must fetch the stored definition from Crossbar and reject missing or malformed definitions. It stores the exact feed hash, queue, unit, threshold, comparator, observation timestamp, and a hash of the human-readable rules.

Recommended feeds use at least three independent upstream jobs and a median result. Nortia requires at least two distinct oracle signatures and permits creators to require up to eight. Secrets for upstream APIs remain in server or oracle configuration and never enter market metadata.

The keeper must obtain managed update instructions before attempting resolution. Reading a stale canonical quote without updating it is not a valid production strategy.

## Stork policy

Nortia verifies the official Stork `TemporalNumericValueFeed` account layout directly because the current Stork SDK pins an Anchor version that is incompatible with this program. The parser pins:

- program `stork1JUZMKYgjNagHiK2KdMmb42iTnYe9bYUCDUk8n`;
- the Anchor account discriminator for `TemporalNumericValueFeed`;
- PDA seeds `stork_feed` plus the 32-byte feed ID;
- the embedded feed ID;
- nanosecond timestamp conversion with overflow checks;
- positive `i128` values at exponent -18;
- observation-window and staleness bounds.

Stork stores only its latest value. Therefore, the keeper must update and resolve promptly. A missed window ends in invalidation and refunds. The web must not allow Stork market creation until service readiness confirms a token and supported asset ID.

## Category and resolver compatibility

| Category | Default resolver | Other allowed resolvers |
| --- | --- | --- |
| Sports | TxLINE | None in the current protocol until a generic signed-stat strategy is implemented |
| Crypto | Pyth sponsored push | Pyth pull, Stork |
| Economics | Pyth pull or sponsored push | Switchboard, Stork, bonded assertion |
| Politics | Bonded assertion | Switchboard numeric feed |
| Technology | Bonded assertion | Switchboard numeric feed |
| Culture | Bonded assertion | Switchboard numeric feed |
| Science | Bonded assertion | Switchboard numeric feed |
| Other | Bonded assertion | Switchboard numeric feed |

The contract rejects incompatible combinations. The browser category selection cannot be treated as a security boundary.

## State machine and failure behavior

1. Creator selects a category and a compatible resolver.
2. Client validates feed metadata and derives immutable resolver inputs.
3. Creator funds the LMSR subsidy and initializes the market.
4. Trading stays open until `lock_ts`; the contract rejects late transactions.
5. Any keeper locks the market and submits resolver evidence after `resolve_not_before_ts`.
6. Valid evidence resolves YES or NO and stores a receipt.
7. If no valid evidence is submitted before `resolution_deadline_ts`, any keeper invalidates the market.
8. Invalid markets settle each position at the protocol's neutral refund value and return remaining liquidity through the existing close lifecycle.

No resolver depends on an automatic offchain action. Keepers are permissionless, failures are observable, and every market has a terminal timeout path.

## API key disclosure

| Variable | Required now | Purpose |
| --- | --- | --- |
| `PYTH_API_KEY` | No for the current public Hermes endpoint and sponsored push feeds; required by Pyth from August 18, 2026 for Hermes | Full Pyth pull catalog and timestamped updates |
| `STORK_API_TOKEN` | Yes for Stork pull updates | Stork REST or WebSocket Basic authentication |
| `SWITCHBOARD_CROSSBAR_ORIGIN` | No key for public low-volume Crossbar | Stored feed lookup, simulation, managed Solana update instructions |
| Upstream Switchboard API secrets | Only for custom jobs that call authenticated sources | Supplied as protected job variables, never browser fields |
| `TXLINE_JWT`, `TXLINE_API_TOKEN` | Yes for TxLINE APIs | Sports data and validation proof retrieval |

## Official references

- Pyth feeds: https://docs.pyth.network/price-feeds/core/price-feeds
- Pyth Hermes access and rate limits: https://docs.pyth.network/price-feeds/core/api-instances-and-providers/hermes
- Pyth Solana sponsored push feeds: https://docs.pyth.network/price-feeds/core/push-feeds/solana
- Pyth upgrade preparation: https://docs.pyth.network/price-feeds/core/upgrade/preparing
- Switchboard Crossbar: https://docs.switchboard.xyz/tooling/crossbar
- Switchboard Solana managed feeds: https://docs.switchboard.xyz/custom-feeds/build-and-deploy-feed/deploy-feed
- Stork Solana API: https://docs.stork.network/api-reference/contract-apis/solana
- Stork Solana addresses: https://docs.stork.network/resources/contract-addresses/solana
- Stork asset registry: https://docs.stork.network/resources/asset-id-registry

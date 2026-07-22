# Nortia proof circuits

## Pinned toolchain

- Noir: `1.0.0-beta.22`
- Sunspot: `v1.0.0`
- Poseidon: `v0.3.0`

These versions are pinned together because Sunspot v1.0.0 rejects the ACIR serialization emitted by Noir beta.13. Poseidon v0.3.0 is compatible with Noir beta.22 and matches the BN254 Poseidon parameters used by Solana's `sol_poseidon` syscall.

## Circuits

`place_order` proves a binary hidden side, a bounded hidden wager amount, its order commitment, and consistent two-of-three Shamir share bundles without revealing the side, amount, or shares.

`redeem` proves that a hidden position belongs to the finalized commitment root, calculates its exact winner or loser return, and derives a market-scoped nullifier without revealing which order is settled.

The public stake is a uniform per-market collateral ceiling. The hidden amount must be between `1_000_000` base units and that ceiling. Redemption returns unused collateral and, for a winner, its proportional share of the net hidden wager pool.

Placement exposes seven public inputs. Redemption exposes nine. Sunspot serializes them as a 12-byte header followed by 32-byte big-endian fields, producing 236-byte and 300-byte public witnesses respectively.

## Local workflow

From the repository root:

```bash
npm install
npm run proof:fixtures
cd circuits
nargo test --workspace
nargo compile --workspace
sunspot compile target/place_order.json
sunspot compile target/redeem.json
sunspot setup target/place_order.ccs
sunspot setup target/redeem.ccs
nargo execute --workspace
sunspot prove target/place_order.json target/place_order.gz target/place_order.ccs target/place_order.pk
sunspot prove target/redeem.json target/redeem.gz target/redeem.ccs target/redeem.pk
sunspot verify target/place_order.vk target/place_order.proof target/place_order.pw
sunspot verify target/redeem.vk target/redeem.proof target/redeem.pw
```

`npm run proof:fixtures` writes deterministic test inputs to ignored `Prover.toml` files. Real trader inputs must never be logged or committed.

Sunspot setup is a development trusted setup and is not safe for production. Generated proving keys, witnesses, proofs, verifier binaries, and program keypairs remain ignored.

## Measured artifacts

| Circuit | Constraints | Proof | Public witness | Proof plus witness |
| --- | ---: | ---: | ---: | ---: |
| Placement | 8,024 | 388 bytes | 236 bytes | 624 bytes |
| Redemption | 22,140 | 388 bytes | 300 bytes | 688 bytes |

The constant proof size keeps both verifier CPIs within Solana transaction data limits. On-chain compute use still has to be measured after verifier deployment.

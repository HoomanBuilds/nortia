#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

placement_so="$repo_root/circuits/target/place_order.so"
placement_keypair="$repo_root/circuits/target/place_order-keypair.json"
redeem_so="$repo_root/circuits/target/redeem.so"
redeem_keypair="$repo_root/circuits/target/redeem-keypair.json"

for artifact in "$placement_so" "$placement_keypair" "$redeem_so" "$redeem_keypair"; do
  if [[ ! -f "$artifact" ]]; then
    printf 'Missing verifier artifact: %s\n' "$artifact" >&2
    exit 1
  fi
done

export NORTIA_PLACEMENT_VERIFIER="$(solana address -k "$placement_keypair")"
export NORTIA_REDEEM_VERIFIER="$(solana address -k "$redeem_keypair")"

if ! solana program show "$NORTIA_PLACEMENT_VERIFIER" --url devnet >/dev/null 2>&1; then
  solana program deploy "$placement_so" --program-id "$placement_keypair" --max-len "$(wc -c < "$placement_so")" --url devnet
fi

if ! solana program show "$NORTIA_REDEEM_VERIFIER" --url devnet >/dev/null 2>&1; then
  solana program deploy "$redeem_so" --program-id "$redeem_keypair" --max-len "$(wc -c < "$redeem_so")" --url devnet
fi

anchor build
anchor deploy --provider.cluster devnet
npm --prefix services run deploy:initialize

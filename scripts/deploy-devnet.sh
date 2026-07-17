#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

cluster="devnet"
rpc_url="${SOLANA_RPC_URL:-https://api.devnet.solana.com}"
devnet_genesis_hash="EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG"
if [[ "$(solana genesis-hash --url "$rpc_url")" != "$devnet_genesis_hash" ]]; then
  printf 'Nortia is pinned to Solana devnet and refuses to deploy to another cluster.\n' >&2
  exit 1
fi
deployer_keypair="${NORTIA_KEYPAIR_PATH:-$(solana config get | awk -F': ' '/Keypair Path/ { sub(/[[:space:]]+$/, "", $2); print $2 }')}"
if [[ -z "$deployer_keypair" || ! -f "$deployer_keypair" ]]; then
  printf 'Set NORTIA_KEYPAIR_PATH to the devnet upgrade-authority keypair.\n' >&2
  exit 1
fi

placement_so="$repo_root/circuits/target/place_order.so"
placement_keypair="$repo_root/circuits/target/place_order-keypair.json"
redeem_so="$repo_root/circuits/target/redeem.so"
redeem_keypair="$repo_root/circuits/target/redeem-keypair.json"
program_so="$repo_root/target/deploy/nortia.so"
program_keypair="$repo_root/target/deploy/nortia-keypair.json"

for artifact in "$placement_so" "$placement_keypair" "$redeem_so" "$redeem_keypair"; do
  if [[ ! -f "$artifact" ]]; then
    printf 'Missing verifier artifact: %s\n' "$artifact" >&2
    exit 1
  fi
done

export NORTIA_PLACEMENT_VERIFIER="$(solana address -k "$placement_keypair")"
export NORTIA_REDEEM_VERIFIER="$(solana address -k "$redeem_keypair")"
export NORTIA_KEYPAIR_PATH="$deployer_keypair"
export SOLANA_RPC_URL="$rpc_url"

anchor build

program_id="$(solana address -k "$program_keypair")"
deployer_pubkey="$(solana address -k "$deployer_keypair")"
binary_size="$(wc -c < "$program_so")"
# Upgradeable loader accounts prepend serialized state before the program bytes.
program_data_size=$((binary_size + 45))
buffer_data_size=$((binary_size + 37))
buffer_rent="$(solana rent "$buffer_data_size" --lamports --url "$rpc_url" | awk '{ print $3 }')"
fee_reserve="${NORTIA_DEPLOY_FEE_RESERVE_LAMPORTS:-100000000}"
program_rent="$(solana rent "$program_data_size" --lamports --url "$rpc_url" | awk '{ print $3 }')"
existing_program_lamports=0

if program_json="$(solana program show "$program_id" --url "$rpc_url" --output json-compact 2>/dev/null)"; then
  current_size="$(printf '%s' "$program_json" | node -e 'let value=""; process.stdin.on("data", chunk => value += chunk); process.stdin.on("end", () => process.stdout.write(String(JSON.parse(value).dataLen)))')"
  existing_program_lamports="$(printf '%s' "$program_json" | node -e 'let value=""; process.stdin.on("data", chunk => value += chunk); process.stdin.on("end", () => process.stdout.write(String(JSON.parse(value).lamports)))')"
  upgrade_authority="$(printf '%s' "$program_json" | node -e 'let value=""; process.stdin.on("data", chunk => value += chunk); process.stdin.on("end", () => process.stdout.write(String(JSON.parse(value).authority)))')"
  if [[ "$upgrade_authority" != "$deployer_pubkey" ]]; then
    printf 'Deployer %s is not the upgrade authority for %s.\n' "$deployer_pubkey" "$program_id" >&2
    exit 1
  fi
  current_program_capacity=$((current_size - 45))
  if (( binary_size <= current_program_capacity )); then
    program_rent="$existing_program_lamports"
  fi
fi

additional_program_rent=$((program_rent - existing_program_lamports))
if (( additional_program_rent < 0 )); then
  additional_program_rent=0
fi
required_lamports=$((additional_program_rent + buffer_rent + fee_reserve))
available_lamports="$(solana balance "$deployer_pubkey" --lamports --url "$rpc_url" | awk '{ print $1 }')"
if (( available_lamports < required_lamports )); then
  shortfall_lamports=$((required_lamports - available_lamports))
  shortfall_sol="$(awk -v value="$shortfall_lamports" 'BEGIN { printf "%.9f", value / 1000000000 }')"
  required_sol="$(awk -v value="$required_lamports" 'BEGIN { printf "%.9f", value / 1000000000 }')"
  printf 'Devnet deployment preflight failed before spending funds.\n' >&2
  printf 'Fund %s with at least %s additional devnet SOL. Total transient requirement: %s SOL.\n' "$deployer_pubkey" "$shortfall_sol" "$required_sol" >&2
  exit 1
fi

if ! solana program show "$NORTIA_PLACEMENT_VERIFIER" --url "$rpc_url" >/dev/null 2>&1; then
  solana program deploy "$placement_so" --program-id "$placement_keypair" --max-len "$(wc -c < "$placement_so")" --url "$rpc_url" --keypair "$deployer_keypair"
fi

if ! solana program show "$NORTIA_REDEEM_VERIFIER" --url "$rpc_url" >/dev/null 2>&1; then
  solana program deploy "$redeem_so" --program-id "$redeem_keypair" --max-len "$(wc -c < "$redeem_so")" --url "$rpc_url" --keypair "$deployer_keypair"
fi

anchor deploy --provider.cluster "$cluster" --provider.wallet "$deployer_keypair"
npm --prefix services run deploy:initialize

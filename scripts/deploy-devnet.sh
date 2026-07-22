#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

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
program_so="${NORTIA_PROGRAM_SO_PATH:-$repo_root/target/deploy/nortia.so}"
program_id="4S2EvdGrbKJ9zazvB4gtR83crTrVJWqqwoVVvEQy8VE9"
program_keypair="${NORTIA_PROGRAM_KEYPAIR_PATH:-}"
buffer_keypair="${NORTIA_BUFFER_KEYPAIR_PATH:-$repo_root/target/deploy/nortia-buffer-keypair.json}"

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

if [[ "${NORTIA_SKIP_PROGRAM_BUILD:-false}" == true ]]; then
  if [[ ! -f "$program_so" ]]; then
    printf 'Missing staged Nortia program artifact: %s\n' "$program_so" >&2
    exit 1
  fi
else
  anchor build --ignore-keys
  node scripts/sync-idl.mjs
fi

if [[ ! -f "$buffer_keypair" ]]; then
  solana-keygen new --no-bip39-passphrase --silent --outfile "$buffer_keypair"
fi

deployer_pubkey="$(solana address -k "$deployer_keypair")"
buffer_pubkey="$(solana address -k "$buffer_keypair")"
binary_size="$(wc -c < "$program_so")"
buffer_data_size=$((binary_size + 37))
buffer_rent="$(solana rent "$buffer_data_size" --lamports --url "$rpc_url" | awk '{ print $3 }')"
fee_reserve="${NORTIA_DEPLOY_FEE_RESERVE_LAMPORTS:-100000000}"
verifier_deploy_rent=0
existing_program_lamports=0
current_program_capacity=0
target_program_capacity="$binary_size"
program_exists=false

if program_json="$(solana program show "$program_id" --url "$rpc_url" --output json-compact 2>/dev/null)"; then
  program_exists=true
  current_program_capacity="$(printf '%s' "$program_json" | node -e 'let value=""; process.stdin.on("data", chunk => value += chunk); process.stdin.on("end", () => process.stdout.write(String(JSON.parse(value).dataLen)))')"
  existing_program_lamports="$(printf '%s' "$program_json" | node -e 'let value=""; process.stdin.on("data", chunk => value += chunk); process.stdin.on("end", () => process.stdout.write(String(JSON.parse(value).lamports)))')"
  upgrade_authority="$(printf '%s' "$program_json" | node -e 'let value=""; process.stdin.on("data", chunk => value += chunk); process.stdin.on("end", () => process.stdout.write(String(JSON.parse(value).authority)))')"
  if [[ "$upgrade_authority" != "$deployer_pubkey" ]]; then
    printf 'Deployer %s is not the upgrade authority for %s.\n' "$deployer_pubkey" "$program_id" >&2
    exit 1
  fi
  target_program_capacity="$current_program_capacity"
  if (( binary_size > current_program_capacity )); then
    required_growth=$((binary_size - current_program_capacity))
    rounded_growth=$((((required_growth + 10239) / 10240) * 10240))
    target_program_capacity=$((current_program_capacity + rounded_growth))
  fi
fi

program_account_rent="$(solana rent 36 --lamports --url "$rpc_url" | awk '{ print $3 }')"
for verifier_artifact in "$placement_so:$NORTIA_PLACEMENT_VERIFIER" "$redeem_so:$NORTIA_REDEEM_VERIFIER"; do
  verifier_so="${verifier_artifact%%:*}"
  verifier_address="${verifier_artifact##*:}"
  verifier_binary_size="$(wc -c < "$verifier_so")"
  verifier_buffer_size=$((verifier_binary_size + 37))
  verifier_buffer_rent="$(solana rent "$verifier_buffer_size" --lamports --url "$rpc_url" | awk '{ print $3 }')"
  verifier_deploy_rent=$((verifier_deploy_rent + verifier_buffer_rent))
  if verifier_json="$(solana program show "$verifier_address" --url "$rpc_url" --output json-compact 2>/dev/null)"; then
    verifier_authority="$(printf '%s' "$verifier_json" | node -e 'let value=""; process.stdin.on("data", chunk => value += chunk); process.stdin.on("end", () => process.stdout.write(String(JSON.parse(value).authority)))')"
    if [[ "$verifier_authority" != "$deployer_pubkey" ]]; then
      printf 'Deployer %s is not the upgrade authority for verifier %s.\n' "$deployer_pubkey" "$verifier_address" >&2
      exit 1
    fi
    verifier_capacity="$(printf '%s' "$verifier_json" | node -e 'let value=""; process.stdin.on("data", chunk => value += chunk); process.stdin.on("end", () => process.stdout.write(String(JSON.parse(value).dataLen)))')"
    verifier_target_capacity="$verifier_capacity"
    if (( verifier_binary_size > verifier_capacity )); then
      verifier_growth=$((verifier_binary_size - verifier_capacity))
      verifier_growth=$((((verifier_growth + 10239) / 10240) * 10240))
      verifier_target_capacity=$((verifier_capacity + verifier_growth))
      verifier_current_rent="$(solana rent "$((verifier_capacity + 45))" --lamports --url "$rpc_url" | awk '{ print $3 }')"
      verifier_target_rent="$(solana rent "$((verifier_target_capacity + 45))" --lamports --url "$rpc_url" | awk '{ print $3 }')"
      verifier_deploy_rent=$((verifier_deploy_rent + verifier_target_rent - verifier_current_rent))
    fi
  else
    verifier_data_size=$((verifier_binary_size + 45))
    verifier_data_rent="$(solana rent "$verifier_data_size" --lamports --url "$rpc_url" | awk '{ print $3 }')"
    verifier_deploy_rent=$((verifier_deploy_rent + program_account_rent + verifier_data_rent))
  fi
done

program_data_size=$((target_program_capacity + 45))
program_rent="$(solana rent "$program_data_size" --lamports --url "$rpc_url" | awk '{ print $3 }')"
additional_program_rent=$((program_rent - existing_program_lamports))
if (( additional_program_rent < 0 )); then
  additional_program_rent=0
fi
existing_buffer_lamports="$(solana balance "$buffer_pubkey" --lamports --url "$rpc_url" 2>/dev/null | awk '{ print $1 }' || true)"
existing_buffer_lamports="${existing_buffer_lamports:-0}"
additional_buffer_rent=$((buffer_rent - existing_buffer_lamports))
if (( additional_buffer_rent < 0 )); then
  additional_buffer_rent=0
fi
required_lamports=$((additional_program_rent + additional_buffer_rent + verifier_deploy_rent + fee_reserve))
available_lamports="$(solana balance "$deployer_pubkey" --lamports --url "$rpc_url" | awk '{ print $1 }')"
if (( available_lamports < required_lamports )); then
  shortfall_lamports=$((required_lamports - available_lamports))
  shortfall_sol="$(awk -v value="$shortfall_lamports" 'BEGIN { printf "%.9f", value / 1000000000 }')"
  required_sol="$(awk -v value="$required_lamports" 'BEGIN { printf "%.9f", value / 1000000000 }')"
  printf 'Devnet deployment preflight failed before spending funds.\n' >&2
  printf 'Fund %s with at least %s additional devnet SOL. Total transient requirement: %s SOL.\n' "$deployer_pubkey" "$shortfall_sol" "$required_sol" >&2
  exit 1
fi

deploy_verifier() {
  local verifier_so="$1"
  local verifier_keypair="$2"
  local verifier_address="$3"
  local verifier_binary_size verifier_capacity verifier_json
  verifier_binary_size="$(wc -c < "$verifier_so")"
  if verifier_json="$(solana program show "$verifier_address" --url "$rpc_url" --output json-compact 2>/dev/null)"; then
    verifier_capacity="$(printf '%s' "$verifier_json" | node -e 'let value=""; process.stdin.on("data", chunk => value += chunk); process.stdin.on("end", () => process.stdout.write(String(JSON.parse(value).dataLen)))')"
    while (( verifier_capacity < verifier_binary_size )); do
      solana program extend "$verifier_address" 10240 --keypair "$deployer_keypair" --url "$rpc_url" --commitment confirmed
      verifier_capacity=$((verifier_capacity + 10240))
    done
    solana program deploy "$verifier_so" --program-id "$verifier_keypair" --url "$rpc_url" --keypair "$deployer_keypair" --commitment confirmed --use-quic --max-sign-attempts 15
  else
    solana program deploy "$verifier_so" --program-id "$verifier_keypair" --max-len "$verifier_binary_size" --url "$rpc_url" --keypair "$deployer_keypair" --commitment confirmed --use-quic --max-sign-attempts 15
  fi
}

deploy_verifier "$placement_so" "$placement_keypair" "$NORTIA_PLACEMENT_VERIFIER"
deploy_verifier "$redeem_so" "$redeem_keypair" "$NORTIA_REDEEM_VERIFIER"

while [[ "$program_exists" == true ]] && (( current_program_capacity < binary_size )); do
  solana program extend "$program_id" 10240 --keypair "$deployer_keypair" --url "$rpc_url" --commitment confirmed
  current_program_capacity=$((current_program_capacity + 10240))
done

solana program write-buffer "$program_so" --buffer "$buffer_keypair" --buffer-authority "$deployer_keypair" --keypair "$deployer_keypair" --url "$rpc_url" --commitment confirmed --use-quic --max-sign-attempts 15

activation_program_id="$program_id"
if [[ "$program_exists" == false ]]; then
  if [[ ! -f "$program_keypair" || "$(solana address -k "$program_keypair")" != "$program_id" ]]; then
    printf 'A matching Nortia program keypair is required for first deployment.\n' >&2
    exit 1
  fi
  activation_program_id="$program_keypair"
fi
solana program deploy --program-id "$activation_program_id" --buffer "$buffer_keypair" --upgrade-authority "$deployer_keypair" --keypair "$deployer_keypair" --url "$rpc_url" --commitment confirmed --use-quic --max-sign-attempts 15
npm --prefix services run deploy:initialize
npm --prefix services run deploy:rotate-verifiers

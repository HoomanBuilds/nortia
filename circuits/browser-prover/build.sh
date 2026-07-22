#!/usr/bin/env bash
set -euo pipefail

prover_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
repo_dir=$(cd "$prover_dir/../.." && pwd)
public_dir="$repo_dir/web/public/zk"
artifact_dir="$repo_dir/circuits/target"

for artifact in place_order.json place_order.ccs place_order.pk redeem.json redeem.ccs redeem.pk; do
  test -f "$artifact_dir/$artifact"
done

mkdir -p "$public_dir"
(
  cd "$prover_dir"
  GOOS=js GOARCH=wasm go build -trimpath -ldflags="-s -w" -o "$public_dir/sunspot-prover.wasm" .
)
chmod 0644 "$public_dir/sunspot-prover.wasm"
cp "$(go env GOROOT)/lib/wasm/wasm_exec.js" "$public_dir/wasm_exec.js"
cp "$artifact_dir/place_order.json" "$artifact_dir/place_order.ccs" "$artifact_dir/place_order.pk" "$public_dir/"
cp "$artifact_dir/redeem.json" "$artifact_dir/redeem.ccs" "$artifact_dir/redeem.pk" "$public_dir/"

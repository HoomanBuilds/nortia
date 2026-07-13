#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

anchor build
anchor deploy --provider.cluster devnet
npm --prefix services run deploy:initialize

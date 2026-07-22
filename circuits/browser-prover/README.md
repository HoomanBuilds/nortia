# Nortia browser prover

This package compiles Nortia's Sunspot proof path to Go WebAssembly so placement and redemption witnesses can remain in the browser.

The `sunspot/` directory contains the minimum required Go packages vendored from [reilabs/sunspot](https://github.com/reilabs/sunspot) at commit `f17cf7a4d8b0dceffa4747b98ab6bd45cf2f35dd`. Sunspot is distributed under the included Apache-2.0 license.

Nortia adds an in-memory witness decoder in `sunspot/acir/witness.go` because the browser worker cannot use Sunspot's file-oriented witness API. Comment punctuation is normalized to the repository's ASCII-only convention in the other marked files. No prover arithmetic or constraint logic is changed.

Build after generating the circuit ACIR, constraint system, and proving keys:

```bash
./circuits/browser-prover/build.sh
```

The script writes the WASM runtime and exact circuit artifacts to `web/public/zk/`. The web worker runs proof generation off the main browser thread. Every artifact set must be regenerated and verified together after a circuit change.

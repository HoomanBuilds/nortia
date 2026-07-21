# Nortia readability and storage plan

- Date: 2026-07-21
- Scope: Next.js application typography, responsive verification, and local build artifacts
- Status: implemented and verified

## Readability standard

- Application captions and metadata use a 12 px minimum.
- Controls and compact explanatory text use 13 px.
- Instructions and body copy use 14 px or larger with a 1.55 to 1.6 line height.
- Secondary text must retain at least WCAG AA body-text contrast against every application panel.
- Display headings keep the existing Nortia scale and do not compensate for unreadable supporting text.
- Chart axis labels render outside stretched SVG coordinates so mobile scaling cannot compress them.

## Covered surfaces

- Market discovery cards and statistics
- Market header, chart, trading controls, activity, rules, and resolution receipt
- Portfolio balances, positions, recovery, instructions, and empty states
- Market creation categories, resolver choices, readiness, fields, notices, and transaction states
- Proof statistics, resolution stages, receipt details, program health, and resolver registry
- Wallet popover and shared application labels

## Verification

- Next.js TypeScript check passes.
- Optimized production build passes.
- Desktop screenshots were reviewed at 1440 px.
- Portfolio, proof, market detail, and creation pages were tested with true 390 px device metrics.
- Every tested page has document width equal to viewport width.
- The market activity ledger retains its intentional internal horizontal scroller on mobile.
- No visible tested application text computes below 12 px.

## Storage discipline

- Run `cargo clean` after each Rust or Anchor verification pass unless the artifact is needed immediately for deployment.
- Remove `web/.next` after recording a successful production build.
- Remove generated Noir `circuits/target` output after circuit verification.
- Preserve installed dependencies, pinned local toolchains, source assets, and deployment evidence.
- Before handoff, check for remaining `target`, `.next`, and root-level coverage output and report current free disk space.

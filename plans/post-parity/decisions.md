# Architecture Decisions (pre-made, locked)

| ID | Decision |
|----|----------|
| D1 | Demos render **live in-browser**: esbuild bundles the library plus a generated data module embedding the .dot inputs and C ref SVGs (no fetch — must work from `file://`). The page runs `renderSvg` at load and shows C vs TS side-by-side, grouped by engine. Proves the browser-compatibility goal; TS side can never go stale. |
| D2 | New golden refs are generated ONLY by the installed C graphviz 15.0.0 binary (`dot -K<engine> -Tsvg <input>`), same provenance as the existing 50 (macOS/arm64, Apple libm). Record the generation command in each new manifest entry's description. If a small iterative-engine golden misses the 0.5pt tolerance, reuse the `tolerance` + `portReference` pin pattern established in test-parity M8/T-final — do not drop the test, do not touch TOLERANCES. |
| D3 | Coverage rollout: measure (T1, no thresholds) → MANDATORY CHECKPOINT (Scott reviews coverage-baseline.md and sizes batch 3) → close gaps to 90/90/90 → flip `coverage.thresholds` on in vitest.config.ts. The gate goes live only when the target is met. |
| D4 | Coverage exclusions (generated/non-product code per ~/.claude/rules/testing.md): `src/parser/dot.js`, `src/parser/dot.d.ts` (Peggy output), `src/**/__fixtures__/**`, `test/**`, `.probes/**`, `dist/**`. Everything else under `src/` counts. Provider: `@vitest/coverage-v8` (statements/branches/functions/lines). |
| D5 | Gate enforcement: vitest `coverage.thresholds` (fails `npm run coverage` below target) + a coverage gate in test/golden/gates.sh. **NO git pre-commit hook** — Scott's call: hooks block legitimate WIP commits. |
| D6 | New goldens bias the 5 deterministic engines (dot/circo/twopi/osage/patchwork); iterative engines (neato/fdp/sfdp) get small/degenerate graphs only, to avoid re-opening the libm-chaos divergence. |
| D7 | A new golden that FAILS against the port is QUARANTINED: input kept in `test/golden/quarantine/`, NOT added to manifest, logged in the decision journal, summarized at mission end as future parity work. The suite must stay green after every task. |

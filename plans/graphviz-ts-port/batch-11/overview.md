# Batch 11 — Integration and Golden-File Test Suite

## Summary

Batch 11 creates the full integration and golden-file test infrastructure
for the TypeScript port. It does not port any layout engine code; it
verifies the correctness of everything ported in Batches 1–10 by
comparing TypeScript output against the reference C binary output.

**T53 and T54 run in parallel.** T53 builds the comparison harness
(shell runner, SVG normalizer, diff tool). T54 generates the 50
reference SVG files from the C binary. Neither depends on the other —
the harness does not need inputs to be built, and the reference SVGs
do not need a harness to be generated.

**T55 depends on T53 and T54.** The end-to-end Vitest suite requires
both the comparison tooling and the reference SVG files to exist before
any test can be written or run.

**T56 depends on T55.** The final quality gate script (gates.sh)
validates that T55's suite passes, plus four additional project-wide
checks (type coverage, bundle size, file length). Writing the script
without a passing suite would result in a gates.sh that immediately
fails; T55 must be green first.

Tolerance classes are fixed by engine family:
- **Deterministic engines** (dot, circo, twopi, osage, patchwork): ±0.01 pt
- **Iterative engines** (neato, fdp, sfdp): ±0.5 pt

"Matches" is defined structurally: same SVG element types, counts, and
nesting hierarchy AND all numeric coordinate attributes within the
applicable tolerance. String attributes (fill, stroke, font-family)
must match exactly.

## Dependencies

- Requires: Batches 1–10 complete
- Requires: C graphviz binary available on PATH (for T54)
- T53 ‖ T54 run in parallel
- T55 → depends on T53, T54
- T56 → depends on T55

## Task Table

| ID  | Description                            | ‖/→ | Writes                                                                                                  | Depends On  |
|-----|----------------------------------------|-----|---------------------------------------------------------------------------------------------------------|-------------|
| T53 | Golden-file test harness               | ‖   | test/golden/run.sh, test/golden/compare.ts, test/golden/normalize.ts                                   | —           |
| T54 | Generate reference SVGs from C binary  | ‖   | test/golden/refs/ (50 SVG files), test/golden/inputs/ (50 .dot files), test/golden/manifest.json       | —           |
| T55 | End-to-end golden-file diff runner     | →   | test/golden/suite.test.ts                                                                               | T53, T54    |
| T56 | Final quality gates script             | →   | test/golden/gates.sh                                                                                    | T55         |

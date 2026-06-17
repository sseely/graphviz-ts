# Decision Journal — sfdp-beautify-leaves

| When | Task | Decision / Event | Rationale |
|------|------|------------------|-----------|
| 2026-06-17 | — | Deep C dive: beautify_leaves runs per multilevel level; set_leaves uses fmadd (disassembly); no-diagonal guaranteed upstream | C-instrumented + otool |
| 2026-06-17 | — | Test strategy: bare star diverges ~1e-3 (FP-symmetry, pre-existing, not beautify); ring+2-leaves is oracle-stable to 6 digits → e2e oracle pin viable. Captured ground truth | Corrected the original "unit-only" plan |
| 2026-06-17 | — | Rebuilt sfdp-oracle C probe; matches embedded SIMPLE_ORACLE_POS byte-for-byte | Same reference as existing tests |
| 2026-06-17 | — | Baseline: tsc 0, vitest 1856 | Pre-mission green |

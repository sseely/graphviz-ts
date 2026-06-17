# Decision Journal — sfdp-beautify-leaves

| When | Task | Decision / Event | Rationale |
|------|------|------------------|-----------|
| 2026-06-17 | — | Deep C dive: beautify_leaves runs per multilevel level; set_leaves uses fmadd (disassembly); no-diagonal guaranteed upstream | C-instrumented + otool |
| 2026-06-17 | — | Test strategy: bare star diverges ~1e-3 (FP-symmetry, pre-existing, not beautify); ring+2-leaves is oracle-stable to 6 digits → e2e oracle pin viable. Captured ground truth | Corrected the original "unit-only" plan |
| 2026-06-17 | — | Rebuilt sfdp-oracle C probe; matches embedded SIMPLE_ORACLE_POS byte-for-byte | Same reference as existing tests |
| 2026-06-17 | — | Baseline: tsc 0, vitest 1856 | Pre-mission green |
| 2026-06-17 | T1 | beautifyLeaves + gatherLeaves ported (fma inlined for set_leaves; setLeaves helper dropped to avoid 6-param hook limit). 3 unit tests pass, 1859 total, zero churn. | DOT-12-style fma; radial/angular invariants asserted |
| 2026-06-17 | T1 | Complexity hook flags 5 PRE-EXISTING violations in spring-electrical.ts (onedOptimizerTrain CCN8, attractiveForce/repulsiveForceDirect 6-param, repulsiveForceQT 7-param, springElectricalEmbedding CCN16) — all at HEAD, unchanged by this mission. My additions are hook-clean. Refactoring 5 core force fns is out of scope/risky; proceeding (tsc+tests are the real gates). | Hook scans whole file with no baseline; file was committed with these |

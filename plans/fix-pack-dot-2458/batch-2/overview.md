# Batch 2 — Core doDot + per-component pack (fixes 2458)

Ports C's `doDot` pack branch (cluster-free path) so 2458 flips diverged→match.
TDD: golden + unit test first (Red), then the minimal faithful wiring (Green).
Depends on T1's interface block.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T2 | doDot wrapper + ccomps→per-component dotLayoutPipeline→packSubgraphs; initSubg per T1; ratio guard; 2458 golden+unit test | (inline / general) | `src/layout/dot/index.ts`, `src/layout/dot/pack-components.ts`, `src/layout/dot/pack-components.test.ts`, `test/golden/inputs/pack-2458.dot`, `test/golden/refs/pack-2458.svg` | T1 | [ ] |

Cluster copy-back is **out of scope here** (T3). 2458 is cluster-free, so T2's
target passes without it.

# Batch 1 — sfdp beautify_leaves

Two sequential tasks, one executor. T2 depends on T1 (wire the function it
ports). All in the sfdp engine.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|-----------|------|
| T1 | port `beautifyLeaves` + helpers (fma) + unit test | inline | `spring-electrical.ts`, `spring-electrical.test.ts` | — | [ ] |
| T2 | wire (drop throw) + e2e oracle pin + flip guard | inline | `spring-electrical.ts`, `spring-electrical.test.ts`, `guards.test.ts` | T1 | [ ] |

## C spec anchors

- `beautify_leaves` — `spring_electrical.c:195-238`
- `set_leaves` (fma sites) — `spring_electrical.c:190-193`
- `node_degree` macro — `spring_electrical.c:188`
- call site — `spring_electrical.c:378` (per multilevel level)

## TS anchors

- throw to replace — `spring-electrical.ts:356`
- `distance` (exists) — `spring-electrical.ts:155`
- `fma` — `src/common/fma.ts`
- SparseMatrix `ia/ja/m` — `sparse-matrix.ts`

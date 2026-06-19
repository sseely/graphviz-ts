# Batch 1 — ortho P1 foundation (parallel)

Port the three independent bottom-layer modules of `lib/ortho`, each as a
faithful one-file port with C-oracle TDD. No interdependencies and disjoint
write-sets → **all three run in parallel** (single batch, no Batch 2 for P1).

> **Re-scoped 2026-06-18** (see README + journal): the modules were already
> ported (T17, committed); tasks became "oracle-pin existing port + fix parity",
> executed inline (not via parallel agents). Test filenames are lowercase to
> match the existing impl files (`fpq.ts`, not `fPQ.ts`).

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T1 | Oracle-pin `rawgraph.ts` (adjacency graph + topsort) | inline | `src/ortho/rawgraph.test.ts` | — | [x] |
| T2 | Oracle-pin `trapezoid.ts` (Seidel decomposition) | inline | `src/ortho/trapezoid.test.ts` | — | [x] |
| T3 | Oracle-pin `sgraph.ts` + `fpq.ts` (+`shortPath` parity fix) | inline | `src/ortho/sgraph.ts`, `src/ortho/sgraph.test.ts`, `src/ortho/fpq.test.ts` | — | [x] |

## Parallelism / file ownership
- Disjoint write-sets (each task owns distinct files under `src/ortho/`). No
  shared type file (each ports its own header types per ADR-1/2). No barrel
  `index.ts` in P1 (a shared write target) — P3 adds it. So no write conflicts.
- T2 is the heavy task (898 LOC Seidel). If an executor prefers smaller commits it
  MAY split T2 into T2a (types + `qnodes`/`locate_endpoint` + geometry predicates)
  and T2b (`init_query_structure`/`add_segment`/`merge_trapezoids`/
  `update_trapezoid`/`construct_trapezoids`), T2b depending on T2a, same file —
  sequential, one commit each. Default: single task.

## Gate after batch
- `npm run typecheck` 0 · `npm test` (baseline 1876 unchanged + new ortho tests
  pass) · `npm run build` OK · `git -C ~/git/graphviz status --porcelain lib/`
  empty · `git diff --name-only` shows only `src/ortho/**` + `plans/**`.
- **Any change to an existing (non-ortho) test or golden ⇒ STOP** (ADR-4: P1 is
  unwired and must not affect anything outside `src/ortho/`).

## Oracle harness (shared across tasks)
Instrument the relevant `lib/ortho/*.c` with `fprintf` dumps for fixture inputs,
build (`cd ~/git/graphviz/build && make gvplugin_dot_layout`), copy dylibs to
`/tmp/gvmine`, drive via a graph that exercises ortho (`splines=ortho`) under
`GVBINDIR=/tmp/gvmine`, capture dumps, then **revert C**
(`git -C ~/git/graphviz checkout -- lib/ortho`). For pure functions
(`construct_trapezoids`, PQ ops) a tiny C harness linking the object is also
acceptable. Pin TS test fixtures to the captured values.

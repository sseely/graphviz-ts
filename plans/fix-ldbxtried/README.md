<!-- SPDX-License-Identifier: EPL-2.0 -->
# Mission: fix ldbxtried (cluster X-coordinate / ordering divergence)

## Objective
Root-cause and fix the `graphs-ldbxtried` divergence so the port renders the
clustered graph's node **X coordinates** conformant with C. The port mispositions
13 of 32 nodes in **X only** (every rank/Y matches) and reorders at least one node
within its rank (n518 jumps rightmost→leftmost), which cascades into 48 diverged
edges (mostly point-count). This is a **cluster mincross-ordering or x-coordinate
network-simplex** divergence, NOT edge-spline routing. Fixing `graphs-ldbxtried`
is expected to also help the pos-annotated `share-ldbxtried` / `windows-ldbxtried`.

## Pinned facts (do NOT re-derive)
- Counts + bbox MATCH (60 nodes, 70 edges, viewBox 1111×628). Pure geometry.
- All 13 node mismatches are **X-only** (cy identical) → ranks correct; the
  divergence is horizontal (ordering and/or x-coord), inside/around `cluster0`.
- Worst node X deltas: **n454 Δ323** (C 772.89 / port 449.89), **n449 Δ210**
  (C 543.89 / port 753.89), **n518 Δ203** (C 642.89 / port 439.89).
- Within rank y=−38 the L→R order differs: C `n526,n513,n518` vs port
  `n518,n526,n513` → an ordering signature, not just spacing.
- 48 edges diverge, mostly **point-count** — downstream of moved endpoints.

## Write-set is pinned by Batch 0 (not pre-assigned)
Diagnose-then-fix. Batch 0 instruments C vs port and NAMES the exact fix file
before Batch 1 touches code. Likely surface (suspect order): cluster mincross
ordering (`mincross-cluster*.ts` / `mincross*.ts`) → x-coord NS
(`position.ts` / `position-cluster.ts` / `ns.ts`) → cluster containment
(`position-cluster.ts`).

## Branch
- `feature/fix-ldbxtried` (merge-commit to main; per-task commits). Created at
  execution start; do not pre-create.

## Quality gates
- `npx tsc --noEmit` → exit 0 after every code change.
- `npx vitest run` for touched test files → all pass (Batch 1 adds an
  ldbxtried oracle-pinned test).
- **Integration gate (Batch 2):** full headless parity survey, **0 regressions**
  vs `test/corpus/parity.json` (baseline conformant **533**), no new
  timeout/errored. Recipe in `batch-2/T2-survey-gate.md`.
- Repro: `~/git/graphviz/tests/graphs/ldbxtried.gv`; node n454 → C x=772.89.

## Batches (sequential — each needs the prior)
- [x] **Batch 0** — Diagnose the X-divergence stage; pin write-set → `batch-0/overview.md`
  - Result: `cluster-mincross-order`; fixTarget `src/layout/dot/cluster.ts::interclexp`
    (edge-iteration order ≠ C `agfstedge` → intercluster parallel multi-edge
    `n488->n2` xpenalty 1 vs C's 2 → wrong ReMincross best-order → X cascade).
- [x] **Batch 1** — Implement fix + ldbxtried oracle test → `batch-1/overview.md`
  - `interclexp` agfstedge-order fix; node X conformant; golden un-skipped; 2512/2512.
- [x] **Batch 2** — Survey gate + baseline refresh → `batch-2/overview.md`
  - PASS: 0 regressions; conformant 533→536; all 3 ldbxtried-family graphs conformant.

## Mission summary (complete 2026-06-30)
- **Tasks:** 3/3 (T0 diagnose, T1 fix, T2 survey gate). No stop conditions hit.
- **Fix:** `cluster.ts:interclexp` iterates `[...n.outEdges(g), ...n.inEdges(g)]`
  (C `agfstedge` order) instead of `g.edges` insertion order — restores the
  merged `ED_xpenalty` on parallel intercluster multi-edges.
- **Gates:** tsc 0 · full unit suite 2512/2512 · golden 169/169 (un-skipped
  `parallel-cluster-ldbxtried`) · survey 0 regressions / 0 new timeout/errored.
- **Outcome:** graphs/share/windows-ldbxtried all diverged→conformant;
  corpus conformant 533→536. Merged to main: merge commit `4491c16`
  (per-task commits ad9c16e/20aa305/f3f3206).
- **Follow-up:** none. Branch `feature/fix-ldbxtried` left for batched cleanup.

## Constraints
**Stop conditions:**
- Root cause falls OUTSIDE the ordering / x-coord / cluster surface (e.g. pure
  rank assignment, or edge-spline routing only) → stop, reassess scope.
- ANY survey regression, or new timeout/errored → stop, do not merge.
- ldbxtried not conformant after the pinned fix → diagnosis incomplete → stop.
- 3 consecutive failed attempts on the same locus → stop (architectural).

**Push-forward:** instrumentation freely; small faithful fixes within the
Batch-0-named file that demonstrably match C's ordering / x-coord.

## Docs
- Decisions: `decisions.md` · Component map: `diagrams/component-map.md`
- Decision journal: `decision-journal.md`
- Conformance definition (the "match" bar): `../../docs/conformance.md`
- Prior art (same class): `../fix-graphs-mike/` (rank-phase divergence)

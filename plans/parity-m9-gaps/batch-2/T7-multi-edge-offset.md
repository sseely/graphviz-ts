# T7 — multi-edge (parallel edge) offset

## Context

graphviz-ts port; C source is the spec; suite baseline ~1059/0 after
batch 1.

`A->B; A->B; A->B` renders with overlapping/wrong paths (quarantined
dot-multi-edge, maxDelta 13.95pt). C spec:

- Mergeable predicate: lib/dotgen/class2.c:150-153 — same tail, head,
  label identity, AND ports_eq. The port's predicate
  (src/layout/dot/cluster.ts:40-44 interclexpMergeable) checks
  tail/minlen/weight but NOT label/port equivalence.
- Parallel-edge bundling and offset in spline construction:
  lib/dotgen/dotsplines.c — edge collection sorts/groups parallel
  edges (cnt), and the routing paths offset each member: regular
  edges via the boxes/spline machinery around completeregularpath
  (read dotsplines.c:228-470 for how cnt and edge index feed the
  offset), flat case via makeSimpleFlat (1075-1106: stepy =
  ND_ht/(cnt-1), dy per edge) and make_flat_adj_edges (1122-1170).
- Port status: src/layout/dot/splines-route.ts declares multisep
  (line 31) but never applies a parallel offset; no makeSimpleFlat
  equivalent.

NOTE: the quarantined repro is a same-rank-pair regular edge
(A->B ranks differ by 1) — identify which C path it takes (likely the
regular path with cnt>1, not the flat path) by reading the C, and port
what the repro needs plus the directly adjacent multi-edge machinery
the C couples to it. Do not port unrelated dotsplines surface.

## Task

1. Fix the mergeable predicate to match class2.c:150-153 (label
   identity + ports_eq — port ports_eq if absent).
2. Port the parallel-edge offset for the path(s) the repro exercises
   (cnt grouping → per-edge offset), preserving C's edge ordering
   (cgraph head-seq order — see .agent-notes/fdp-fma-oracle-2026-06.md
   observation 3; Node.outEdges already implements it).
3. TDD: failing test first in NEW src/layout/dot/multi-edge.test.ts
   (3 parallel edges → 3 distinct spline paths with C-expected
   separation).
4. Verify quarantined dot-multi-edge passes via the compare.ts probe
   approach. Report; T8 promotes.

## Write-set

src/layout/dot/splines-route.ts, src/layout/dot/cluster.ts,
src/layout/dot/multi-edge.test.ts (new), .probes/* (untracked)

## Read-set

~/git/graphviz/lib/dotgen/class2.c:140-160;
~/git/graphviz/lib/dotgen/dotsplines.c:228-470, 1060-1170;
src/layout/dot/splines-route.ts; src/layout/dot/cluster.ts:30-50;
src/layout/dot/flat.ts:160-190 (adjacency marking, read-only)

## Architecture decisions

C-is-sacred: offset formulas and ordering exactly; no "improved"
spacing.

## Interface contract (consumed by T8)

Report: dot-multi-edge PASS/FAIL with maxDelta.

## Acceptance criteria

- Given `A->B; A->B; A->B`, when splines build, then three distinct
  paths offset per C (quarantined comparison passes at dot tolerance)
- Given two same-pair edges with different labels, then they are NOT
  merged (predicate unit test)
- Given the existing goldens, then port output unchanged (suite green)

## Observability: N/A. Rollback: Reversible.

## Quality bar

npx tsc --noEmit clean; npx vitest run green. Commit:
`feat(T7): port parallel multi-edge offset in dot splines`

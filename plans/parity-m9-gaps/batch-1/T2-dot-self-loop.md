# T2 — dot engine self-loop routing

## Context

graphviz-ts port; C source is the spec; suite baseline 1054/0.

The shared self-loop module src/common/splines-selfedge.ts is FULLY
ported (makeSelfEdge dispatcher + selfTop/Bottom/Left/Right, 381 lines,
faithful to lib/common/splines.c:809-1202). The dot engine never calls
it:

- src/layout/dot/edge-route.ts:474 — `if (e.tail === e.head) continue;`
  skips self-edges entirely.
- src/layout/dot/splines.ts:129 — detects self-edges and sets
  SELFNPEDGE/SELFWPEDGE flags but never routes.
- C spec: lib/dotgen/dotsplines.c:388-404 — self-edge branch collects
  parallel self-edges (cnt), computes sizey from rank context, calls
  makeSelfEdge(edges, cnt, Multisep, sizey/2, sinfo).

Quarantined repro: test/golden/quarantine/dot-self-loop.{dot,svg} —
current failure: SVG g[2] childCount 1 vs expected 3 (edge elements
missing).

## Task

Port the dotsplines.c self-edge branch into the dot routing path:
detection, parallel-self-edge counting, the sizey calculation from rank
boxes (dotsplines.c:389-403 — read the surrounding code for what
sizey/Multisep mean), and the makeSelfEdge call with dot's SplineInfo.
Preserve C call order relative to other edge classes. TDD: failing test
first in NEW file src/layout/dot/self-loop.test.ts (assert the layout
produces spline geometry for A->A; assert against known C values where
practical).

Verify the quarantined golden passes without touching test/golden/
(same probe approach as T1: reuse compare.ts helpers against the
quarantine files). Report; T5 promotes.

## Write-set

src/layout/dot/edge-route.ts, src/layout/dot/splines.ts,
src/layout/dot/self-loop.test.ts (new), .probes/* (untracked)

## Read-set

~/git/graphviz/lib/dotgen/dotsplines.c:228-460 (dot_splines_ self-edge
branch + context); ~/git/graphviz/lib/common/splines.c:1164-1202
(makeSelfEdge contract); src/common/splines-selfedge.ts (already
ported — call it, don't re-port); src/layout/dot/edge-route.ts:430-520;
src/layout/dot/splines.ts:100-160

## Architecture decisions

C-is-sacred. Do NOT re-implement self-loop geometry — call the ported
makeSelfEdge.

## Interface contract (consumed by T5)

Report: dot-self-loop PASS/FAIL with maxDelta/structural result.

## Acceptance criteria

- Given `digraph { A -> A }`, when dot layout runs, then the edge gets
  a 7-point bezier spline and the SVG contains the edge path elements
  (g childCount matches ref)
- Given the quarantined dot-self-loop input, when compared to its ref,
  then it passes at dot tolerance class
- Given multiple parallel self-loops on one node, when layout runs,
  then each gets distinct geometry (unit test; C: cnt loop)
- Given the existing 57 goldens, then conformant port output
  (1054+/0)

## Observability: N/A. Rollback: Reversible.

## Quality bar

npx tsc --noEmit clean; npx vitest run green. Commit:
`feat(T2): route dot self-loop edges via makeSelfEdge`

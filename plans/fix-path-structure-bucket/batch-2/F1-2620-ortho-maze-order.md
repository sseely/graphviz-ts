# F1 — 2620/2361-class: ortho maze build/insertion-order conformance

## Context
graphviz-ts is a faithful TS port of C Graphviz (`~/git/graphviz` = spec; read
project `CLAUDE.md`). `2620.dot` (clusters, rankdir=LR, splines=ortho) is
tracked diverged maxΔ 3207 on an edge `@d`. The mechanism is ALREADY PINNED
(`.agent-notes/2361-ortho-maze-corridor-tiebreak.md` — read fully before
starting): maze cells, weights, cost constants, fPQ, and relax are all
verified faithful; C and the port pick different EQUAL-COST corridors because
Dijkstra's exploration order differs, driven by sgraph snode index /
`adjEdgeList` insertion order produced during maze construction. 2361's Δ144
residual is the same class and should close with this fix.

## Task
Make the port's maze/sgraph CONSTRUCTION ORDER conformant to C so the
exploration order (and thus the equal-cost tie-break) matches:
1. Instrument both sides: dump snode creation order, per-snode adjacency
   list order after maze build, and the route chosen per edge (C already has
   `-Godb=r`; see the note's repro). Compare on 2361 (14 nodes — small)
   before touching 2620.
2. Align the port's cell/side creation sequence and `createSEdge` insertion
   order to C's (`~/git/graphviz/lib/ortho/maze.c`, `sgraph.c`,
   `ortho.c:shortPath` neighborhood). Preserve the existing faithful port
   semantics — ONLY ordering may change (D3, locked).
3. Verify 2361's `AC->IW` and `FF->IV` routes now match C's dump, then 2620.

STOP CONDITION (locked, D3): if route conformance requires changing the cost
model, relax comparison, fPQ semantics, or anything beyond construction/
insertion order — stop, write the evidence to the decision journal and the
deferred table in `batch-2/overview.md`, and move on.

## Write-set
- `src/ortho/maze.ts`, `src/ortho/sgraph.ts`, `src/ortho/*` as needed for
  ordering only, + colocated `.test.ts`
- `.agent-notes/2361-ortho-maze-corridor-tiebreak.md` (append resolution)

## Read-set
- `.agent-notes/2361-ortho-maze-corridor-tiebreak.md`
- C: `~/git/graphviz/lib/ortho/maze.c`, `lib/ortho/sgraph.c`,
  `lib/ortho/ortho.c` (route_list order, shortPath)
- Port: `src/ortho/maze.ts`, `src/ortho/maze-channels.ts`,
  `src/ortho/sgraph.ts`
- Memory: ortho-p2-pipeline-pinned (gvmine route-dump recipe),
  ortho-maze-dict-stringkey-fix, ortho-p1 fPQ sentinel invariant

## Acceptance criteria
- Given 2361.dot, when routed post-fix, then every edge's maze route equals
  C's `-Godb=r` dump (corridor-for-corridor)
- Given 2620.dot, when surveyed, then verdict improves diverged →
  structural-match or conformant (maxΔ 3207 → the node-geometry residual only)
- Given the full survey, then zero per-id verdict regressions (watch ALL
  ortho graphs: 1447, 2361, 2183 family)
- Given `npm run test`, then exit 0 including a new ordering regression test

## Tests (TDD)
Failing test first: a unit test asserting the port's snode/adjacency order on
a small maze equals the C-derived expected order (fixture from the C dump).

## Observability: N/A — no new observable operations.
## Rollback: Reversible — single commit `fix(ortho): ...`, revert to undo.

## Boundaries
- Never: change cost model / relax / fPQ semantics; touch files outside
  src/ortho/ (except the note).
- Always: full survey before declaring done (ortho ordering touches every
  splines=ortho graph).

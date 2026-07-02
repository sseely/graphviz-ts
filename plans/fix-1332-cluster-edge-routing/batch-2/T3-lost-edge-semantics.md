<!-- SPDX-License-Identifier: EPL-2.0 -->
# T3 — Lost-edge failure semantics (CONDITIONAL)

## Entry condition
Run ONLY if, after T2, the port's polygon for `c4251->c4253:In0` degenerates
like C's (D1 rung 2) — i.e. `lostEdgeVerdict` ∈ {corridor-input,
triangulation-behavior} AND the T2 fix makes the TS `shortestPath` fail on
that edge. If `irreducible-fp`: SKIP (journal it); disposition happens in T5
per D1 rung 3.

## Context
C's failure path on `Pshortestpath failed` (`lib/common/routespl.c`): agerr
warning, `routesplines` returns NULL/pn=0, `make_regular_edge` returns
without installing a spline, the edge is never emitted, dot exits 1 but
still writes the full SVG. The port must mirror the observable behavior:
warning + no spline + edge skipped at emit. (Exit-code semantics are the
CLI's concern, out of scope for the library.)

## Task
1. Port the failure path at the C-faithful sites: TS `shortestPath` returns
   its failure (no throw), routesplines-equivalent propagates pn=0, the
   router returns without installing, warning emitted through the port's
   existing warning channel with C's text shape
   (`in routesplines, Pshortestpath failed` / `lost <tail> <head> edge`).
2. Verify the SVG emitter skips spline-less edges (it may already; test it).
3. Unit tests: (a) the failure path — routesplines failure ⇒ warning + no
   `<g class="edge">` for that edge; (b) the guard — a healthy multi-edge
   graph loses NO edges through this path (count parity with golden).
4. Gate: 1332 edge count == oracle (116); childCount diff gone.

## Write-set (PROVISIONAL — expansion via interactive ask)
- `src/pathplan/shortest.ts` (failure return only if not already faithful)
- the routesplines/install path file(s) named by T1's artifact
- SVG emit gate file (if a skip is missing) + matching `.test.ts`

## Read-set
- `.agent-notes/1332-edge-routing-diagnosis.md`
- `lib/common/routespl.c` (routesplines error path),
  `lib/pathplan/shortest.c:190-340`
- `plans/fix-1332-cluster-edge-routing/decisions.md#d4`

## Acceptance criteria
- Given the T2-fixed corridors, when 1332 renders, then the port emits 116
  edges (== oracle), the warning fires once, and per-element diff shows
  edges-differing = 0.
- Given any healthy corpus golden, when rendered, then zero edges vanish
  (full suite + goldens green).
- Given the code, when reviewed, then no throw, no fallback spline, no 1332
  special case.

## Observability / Rollback
Warning channel is the observable. Reversible.

## Commit
`fix(dot): port routesplines lost-edge failure path — 1332 count parity`

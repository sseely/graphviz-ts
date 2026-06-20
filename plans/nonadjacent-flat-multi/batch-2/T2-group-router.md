# T2 — splines-flat-multi.ts: group collection + cnt-loop router

## Context
Faithful port of C `make_flat_edge` (top, dotsplines.c:1502) + `make_flat_bottom_edges`
(bottom, 1418) for cnt≥2 non-adjacent flats. T1 generalized `topBoxes`/`bottomBoxes`
to take `(endStepX, endStepY, midStepY)` and exported the flat helpers. This task
builds the new module that groups the edges and routes them in C's cnt-loop. READ
`../findings-diagnosis.md` (C structure + cnt=1 reduction) and `../decisions.md`
(AD-2, AD-3, AD-4, AD-5).

## Task
1. Create `src/layout/dot/splines-flat-multi.ts`:
   - `collectNonAdjacentFlatGroup(e, g)`: mirror `edge-route.ts:collectAdjacentFlatGroup`
     but for NON-adjacent same-rank side-port flats with IDENTICAL ports — same node
     pair `{u,v}`, `!isFlatAdjacent`, `hasSidePort`, unrouted, ordered so the lead
     edge tail = the left (lower `order`) node, ties by `seq` (AD-3). Follow C
     `dot_splines_` (370-373) for the port-equality grouping key; if the oracle shows
     edges with differing ports must NOT group, respect that.
   - `routeFlatEdgeGroupFaithful(g, edges, cnt)`: faithful `make_flat_edge` loop —
     pick side via `flatSide`; compute `stepx = nodesep/(cnt+1)`,
     `stepy = vspace/(cnt+1)` (vspace via `flatVspace`, top vs bottom); ONE
     `makeFlatEndBox` tail + head (shared); `for i in 0..cnt-1`: build mid boxes via
     `topBoxes`/`bottomBoxes` with `endStepX=(i+1)*stepx`, `endStepY=(i+1)*stepy`,
     `midStepY=stepy`; `assembleFlatPath`; `routeSplines`; `clipAndInstall(edges[i],
     edges[i].head, …)`; reset `P.nbox=0` per C. Returns true if all installed.
   - Keep functions ≤30 lines / CCN ≤10 / ≤5 params; factor a per-`i` box+route
     helper if needed. File <500 lines.
2. Create `src/layout/dot/splines-flat-multi.test.ts`:
   - Build synthetic graphs in-code (parse the .dot or construct via the model) for
     top cnt=2, top cnt=3, bottom cnt=2 (`a:ne->c:nw`×N / `a:se->c:sw`×2 with
     `{rank=same;a;b;c}` and invis `a->b->c`, `nodesep=0.25`).
   - Render via the port and assert the installed flat splines BYTE-MATCH freshly
     re-captured native `dot` output (the test may shell out to the oracle, or embed
     the captured control points as constants with a comment citing the dot version).
     Prefer embedding captured oracle strings (deterministic, no native dep in CI).

## Write-set
- `src/layout/dot/splines-flat-multi.ts` (Create)
- `src/layout/dot/splines-flat-multi.test.ts` (Create)

## Read-set
- `../decisions.md` (AD-2/3/4/5); `../findings-diagnosis.md`
- `src/layout/dot/splines-flat.ts` (exported helpers from T1; `routeFlatEdgeFaithful`
  as the cnt=1 template)
- `src/layout/dot/edge-route.ts:282-335` (`collectAdjacentFlatGroup`,
  `routeFaithfulSidePort`, `isGroupableFlat`, `hasSidePort`)
- `src/common/splines-routespl.ts` (`routeSplines`); `src/common/splines-clip.ts`
  (`clipAndInstall` signature)
- C: `dotsplines.c:make_flat_edge` (1502-1615), `make_flat_bottom_edges` (1418-1490),
  `dot_splines_` (343-411)

## Interface contract (consumed by T3)
```
collectNonAdjacentFlatGroup(e: GraphEdge, g: Graph): GraphEdge[]   // length = cnt, ordered
routeFlatEdgeGroupFaithful(g: Graph, edges: GraphEdge[], cnt: number): boolean
   // installs spl on every edges[i]; returns true iff all installed
```

## Acceptance criteria
- Given a top cnt=2 synthetic, when routed, then the two installed splines byte-match
  native `dot` (two DISTINCT nested curves, not identical).
- Given a top cnt=3 synthetic, when routed, then all three splines byte-match native.
- Given a bottom cnt=2 synthetic (`:se->:sw`), when routed, then both byte-match native.
- Given cnt=1 (one non-adjacent flat), when routed via this function, then the spline
  equals the current `routeFlatEdgeFaithful` output (byte-identical reduction, AD-1).
- `tsc` exit 0; `vitest run` green; `lizard` clean; both files <500 lines.

## Observability / Rollback
N/A. Reversible.

## Boundaries
- **Always do:** port BOTH branches; reuse T1 helpers; keep cnt=1 == current.
- **Never do:** route labeled flats through the loop (they stay cnt=1); add cnt≥2
  heuristics beyond C; chase a frame offset.
- **Stop if:** synthetic cnt≥2 won't byte-match after the port and you can't pin the
  box-channel mismatch by instrumenting C (AD-5); or files exceed the line cap.

## Commit
`feat(flat): faithful cnt>=2 non-adjacent flat routing (make_flat_edge loop)`

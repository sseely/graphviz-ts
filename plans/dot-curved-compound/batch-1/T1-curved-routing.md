# T1 — Port makeStraightEdges + curved dispatch

## Context
Faithful TS port (root `CLAUDE.md`; C is spec). `splines=curved` is parsed
(`EDGETYPE_CURVED=2`) but never routed: `dotSplines_` doesn't dispatch it and
`makeStraightEdges` (the curved generator) is unported. C routes each edge group
via `makeStraightEdges(g, edgelist, cnt, EDGETYPE_CURVED, &sinfo)`
(`dotsplines.c:381-387`). Tests: vitest; TS strict; no Node-only APIs in `src/`.

## Task
1. **Port** into a new `src/layout/dot/straight-edges.ts` (ADR-1):
   - `makeStraightEdges(g, edgeList, eCnt, et, sinfo)` (`routespl.c:975-1045`):
     single/Concentrate case → `bend` (curved) + `clipAndInstall` + label add;
     multi-edge case → perpendicular control-point spread (verbatim math at
     routespl.c:1000-1038); `EDGETYPE_PLINE` sub-branch via `makePolyline` (port
     or stub — out of scope unless reachable here).
   - `getCycleCentroid(g, edge)` (`routespl.c:904`) and `bend` — verbatim.
   - Reuse the existing `clipAndInstall`; check `addEdgeLabels` is ported (port a
     thin version if missing).
2. **Dispatch**: in the edge-group routing loop (mirror `dotsplines.c:381-387`),
   when `edgeType(g) === EDGETYPE_CURVED`, build the edge list for the group and
   call `makeStraightEdges(g, list, cnt, EDGETYPE_CURVED, sinfo)` instead of the
   normal per-group spline routing.
3. **Top + finish wiring** in `dotSplines_`: mirror `dotsplines.c:241-247`
   (`resetRW(g)` — already ported — + a *non-downgrading* label warning when
   curved + edge labels, ADR-3) and `:461-465` (curved skips `routesplinesterm`).

## Write-set
- `src/layout/dot/straight-edges.ts` (create)
- `src/layout/dot/splines.ts` and/or `src/layout/dot/edge-route-chain.ts` (modify
  — dispatch + top/finish wiring)
- `src/layout/dot/curved.test.ts` (create)

## Read-set
- `~/git/graphviz/lib/common/routespl.c:904-1045` (`get_cycle_centroid`, `bend`,
  `makeStraightEdges`)
- `~/git/graphviz/lib/dotgen/dotsplines.c:241-247, 381-387, 461-465`
- `src/layout/dot/splines.ts:430-470` (`dotSplines_`, the ortho branch as a
  dispatch-shape reference), `src/layout/dot/edge-route-chain.ts:130-200`
- existing `clipAndInstall` + `resetRW` (ortho-P3); `decisions.md#adr-1,#adr-3,#adr-5`

## Architecture decisions (locked)
ADR-1 (new straight-edges.ts), ADR-3 (curved labels: warn + proceed, do NOT
downgrade), ADR-5 (mirror dispatch position + math), ADR-4 (scoped; non-curved
change ⇒ STOP). STOP on any required deviation.

## Interface contract
```ts
// straight-edges.ts
export function makeStraightEdges(g: Graph, edgeList: Edge[], eCnt: number,
  et: number, sinfo: SplineInfo): void;  // installs into Edge.info.spl
// dotSplines_/routeEdgeGroup: EDGETYPE_CURVED → makeStraightEdges per group.
```

## Acceptance criteria
- Given `splines=curved` + a single edge `a->b`, when routed, then `e.info.spl` is
  a curved (bent) 4-point bezier (control points offset toward the cycle
  centroid), not a straight diagonal nor a multi-segment route.
- Given `splines=curved` + 3 parallel edges `a->b`, when routed, then their
  control points are spread along the perpendicular per routespl.c:1000-1014
  (distinct, symmetric offsets).
- Given a graph without `splines=curved`, when routed, then output and control
  flow are unchanged (existing tests pass).
- Given `splines=curved` + an edge label, then the warning is emitted and the
  edge still routes (ADR-3 — no downgrade).

## Observability requirements
N/A — pure layout.

## Rollback notes
**Reversible** (ADR-4). New file + dispatch branch.

## Quality bar
`npm run typecheck` 0 · `npm test` (new test passes; baseline + existing
unchanged) · `npm run build` OK · C tree clean. CCN 10 / 30-line / 500-file caps
— split helpers if needed, keeping C boundaries. Return only the structured
result.

## Commit
`feat(T1): route splines=curved via makeStraightEdges in the dot engine`.

## Boundaries
- **Never:** change non-curved routing; simplify the perp-spread/centroid math;
  downgrade on labels (that's ortho, not curved); leave C instrumentation.
- **Ask first (STOP):** an existing non-curved golden/test would change;
  `makeStraightEdges` needs a graph/port field the types lack; PLINE sub-branch
  proves reachable here and needs `makePolyline`.

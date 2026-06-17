# T3 — Port `makeLineEdge` + multi-rank LINE dispatch

## Context

T2 made adjacent-rank LINE straighten via the box path. C tries `makeLineEdge`
FIRST for `EDGETYPE_LINE`: for `delr>1` it draws a direct tail-port→head-port
segment, skipping the box corridor entirely. This task ports it.

## Task

Port `makeLineEdge` (`dotsplines.c:1636-1698`) into
`src/layout/dot/splines-route.ts`:
- Walk `to_orig` until `edge_type === NORMAL` (use `?? 0` coercion — see
  [[calloc-zero-vs-undefined-port-hazard]]: C calloc defaults edge_type to 0).
- `delr = abs(rank(hn) - rank(tn))`. Return null (decline → box path) when
  `delr === 1`, or `delr === 2 && (graph has EDGE_LABEL)`.
- Compute `startp = coord(tail) + tail_port.p`, `endp = coord(head) + head_port.p`
  (swap when `fe`'s tail != `e`'s tail, matching C lines 1652-1660).
- No edge label → 4 points `[startp, startp, endp, endp]`.
- Edge label → 7 points through the lowered/raised label position
  (`leftOf` test, lines 1662-1688). Reuse the existing `leftOf` helper if one
  exists; otherwise port the 2-D cross-product sign inline.

Dispatch: in the multi-rank LINE entry (`edge-route.ts:routeOneEdge` /
`edge-route-chain.ts` multi-rank path), when `edgeType(g) === EDGETYPE_LINE`,
call `makeLineEdge` first; on null, fall through to the existing box path
(which T2 already straightens).

If the T2 probe found `computeSpline` reachable for LINE/PLINE, also thread
`et` there (write-set then adds `edge-route-poly.ts`, `edge-route-routing.ts`).

## Write-set

- MODIFY `src/layout/dot/splines-route.ts` (add `makeLineEdge`)
- MODIFY `src/layout/dot/edge-route-chain.ts` (multi-rank LINE dispatch)
- MODIFY `src/layout/dot/edge-route.ts` (route dispatch, if needed)

## Read-set

- `~/git/graphviz/lib/dotgen/dotsplines.c:1636-1698` (makeLineEdge) and
  `:1757` (the `et==LINE && makeLineEdge` guard)
- `src/layout/dot/edge-route.ts:235-258` (`routeOneEdge` multi-rank dispatch)
- `src/layout/dot/splines-route.ts` (port helpers, coord/port access)

## Architecture decisions

- AD-2 (port makeLineEdge; multi-rank LINE must match C endpoints).
- AD-3 (LINE endpoints pinned tight at 0.06pt in T4).

## Acceptance criteria

- Given `splines=line` and an edge spanning ≥2 ranks (no label), when routed,
  then the path is a 4-point straight segment from tail port to head port
  (not a corridor polyline).
- Given `splines=line`, a ≥3-rank edge with a label, when routed, then the
  path is 7 points through the offset label position.
- Given `delr === 1`, when `makeLineEdge` is called, then it declines (null)
  and the box-straighten path (T2) handles it.
- Given a default graph, when routed, then goldens stay byte-identical
  (`makeLineEdge` only runs for `EDGETYPE_LINE`).

## Observability

N/A.

## Rollback

Reversible — revert edits; `makeLineEdge` is gated on `EDGETYPE_LINE`.

## Quality bar

tsc 0; vitest 0 failed + 115 goldens byte-identical; lizard clean
(`makeLineEdge` ≤30 lines/CCN 10 — split a label-points helper if needed).
Commit: `feat(T3): port makeLineEdge for multi-rank splines=line`.

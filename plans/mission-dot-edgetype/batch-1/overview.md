# Batch 1 — DOT-7 edge-type dispatch

The regular-edge routers share files (`edge-route-faithful.ts`,
`edge-route-chain.ts`, `splines-route.ts`), so tasks run **sequentially**, one
commit each. T1 is a pure new module; T2 wires it; T3 adds the multi-rank LINE
fast path; T4 pins everything against the C oracle.

| ID | Description | Writes | Depends On | Done |
|----|-------------|--------|------------|------|
| T1 | `routeRegularByType(P, et)` helper + unit tests | `splines-route-type.ts`, `splines-route-type.test.ts` | — | [x] |
| T2 | Wire helper into box-corridor emit points | `edge-route-faithful.ts`, `edge-route-chain.ts` | T1 | [x] |
| T3 | Port `makeLineEdge` + multi-rank LINE dispatch | `splines-route.ts`, `edge-route-chain.ts`, `edge-route.ts` | T2 | [x] |
| T4 | Oracle pins + comparison pages | `edge-type-oracle.test.ts`, `comparisons/*.md` | T2, T3 | [x] |

## Decline-path note (T2/T3)

`edge-route-poly.ts:computeSpline` (pathplan fit) is the fallback when the
faithful routers decline. T2 must establish whether any `splines=line|polyline`
regular edge actually reaches it (DOT-1b retired the regular-edge fitter). If
unreachable for the corpus, thread `et` is unnecessary — document the proof in
the journal (throw-instrumentation, not grep). If reachable, T3 extends scope to
thread `et` there and the write-set adds `edge-route-poly.ts` +
`edge-route-routing.ts`.

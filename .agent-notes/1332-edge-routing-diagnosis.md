<!-- SPDX-License-Identifier: EPL-2.0 -->
# 1332 5-edge cluster-routing residual — mechanisms (T1, fix/1332-cluster-edge-routing)

Method: DUMP1332 env-gated dumps in C (`routespl.c` boxes/poly/pl/fit pre+post
checkpath; `splines.c` beginpath/endpath wrappers + shape_clip0) mirrored in
TS, diffed line-wise per edge. C tree reverted + oracle byte-verified after.
Note: port's internal y-frame is +8 vs C on this graph (emit-normalized,
benign); all comparisons are mod that offset. All five divergent edges are
port-bearing (`In*`/`Out*` record-field ports); all 19 portless comparison
records matched exactly.

## M1 — chain-routed dyna ports resolve toward the wrong endpoint

- **Cause**: The chain router calls `beginPath`/`endPath` with a
  `portEdge` shaped tail→FINAL-head, so a dyna record-field port resolves
  (`resolvePort(n, e.head, …)`) toward the far endpoint. C calls
  beginpath/endpath with the SEGMENT fast edge (ports copied onto fast
  edges by class2), so the port resolves toward the adjacent-rank vnode.
- **Origin**: `src/layout/dot/edge-route-chain.ts:136` (beginSeg →
  `beginPath(chainPathArgs(w.P, portEdge, …))`; symmetric endSeg:161).
- **Evidence**: C beginpath `e=c3378->%0 p=(18,-14.912) side=RIGHT`
  start=(701.0,2060.527) + port box [700,2048.4,863,2060.5]; TS beginPath
  `e=c3378->c4046 p=(0.6,-26.162) side=BOTTOM` start=(682.6,2048.277) — the
  same value the portless siblings resolve to. Ditto c6428->%0
  `p=(18,-34.474) side=RIGHT` (tiny 10×9.75 box) vs TS `(0.6,-44.224)
  side=BOTTOM` (full rank-wide box).
- **Causal chain**: wrong start point + wrong tail pathend boxes → different
  corridor → `c3378:Out0->c4046:In1` piece-count 22v28, extra first box;
  `c6428:Out0->c6753:In0` Δ126.3 (first segment enters from the wrong side).

## M2 — checkPath writes the reduced nbox back; C keeps the stale count

- **Cause**: C's `checkpath(boxn, boxes, thepath)` takes the count BY VALUE,
  compacts degenerate boxes (<0.01) in place, repairs pairs over the REDUCED
  local count, and never writes it back; `routesplines_` then builds the
  polygon over its own `const boxn` captured BEFORE the call — reading the
  compacted array PLUS stale trailing slots (shifted-out boxes live on as
  near-duplicates). The port's `checkPath` does `pp.nbox = bn` and the
  caller reads `pp.nbox` AFTER — an unfaithful "fix" of C's load-bearing
  stale-count behavior.
- **Origin**: `src/common/splines-routespl.ts:132` (`pp.nbox = bn;`) +
  `:345` (`effectiveBoxn = pp.nbox` read post-checkPath).
  C ref: `lib/common/routespl.c:318` (const boxn pre-call), `:683-800`
  (checkpath never stores the count).
- **Evidence**: pre-checkpath box lists are IDENTICAL (n=4, incl. the
  0.006836-tall makeregularend sliver [620,1747.897,688,1747.904]).
  Post-checkpath C routes 4 boxes → poly pn=16 (repaired pair 0.007 apart +
  stale duplicate) → `Pshortestpath` triangulation FAILS →
  `lost c4251 c4253 edge`. TS routes the compacted 3 → poly pn=12 → routes.
- **lostEdgeVerdict: corridor-input.** With M2 fixed the port feeds the same
  degenerate polygon; its faithful shortestPath is expected to fail
  identically → D1 rung 2 → T3 (lost-edge failure semantics) required.
  (If it doesn't fail, run the forced-polygon experiment before any claim.)

## M3 — recordInside omits C's rankdir rotation

- **Cause**: C `record_inside` rotates the query point
  `ccwrotatepf(p, 90*GD_rankdir)` before testing the field bbox (label
  frame); the port's `recordInside` tests the raw layout-frame point.
  1332 is `rankdir=LR`, all nodes are records → every record clip decision
  is made against an unrotated point.
- **Origin**: `src/common/poly-inside.ts:148` (recordInside).
  C ref: `lib/common/shapes.c:record_inside`.
- **Evidence**: `shape_clip0` receives bit-identical inputs
  (`(0,-1)(0,-1)(162.98,-27.62)(294,-44.22)`, li=1, rw=18.5) yet C clips to
  (18.200064,-3.933467) and TS to (28.742356,-5.614007). bezier_clip logic
  is line-identical both sides; pl and Proutespline fit identical to 1e-6 —
  only the insidefn differs.
- **Causal chain**: endpoint clips land elsewhere → `c6412->c6414` Δ2.59,
  `c4256->c4258` Δ1.57 (first-segment control points; rest of each spline
  exact), plus secondary endpoint deltas on the M1 edges.

## Ruled out (with evidence)

- Layout/geometry upstream — all 91 node reference points exact; boxes
  derive from matching coords (mod the benign +8 frame).
- Collect/edgecmp order — the routing call sets match 1:1; 19 portless
  records byte-equal.
- beginpath/endpath box construction — outputs identical given identical
  inputs (c4251 endpath box pair equal to 9 decimals).
- shortestPath (for the geometry edges) — pl identical to 1e-6.
- Proutespline fit — outputs identical to 1e-6 (c6412, c4256).
- theta/evs — both sides zero evs when unconstrained (theta difference on
  merge-start segments noted, but unused by the fitter here).
- checkpath repair logic — algorithm line-identical; only the count
  write-back differs (M2).

## Artifact (contract)

```json
{
  "cause": "Three port defects in dot edge routing: (M1) chain dyna-ports resolved toward the orig's far endpoint instead of the segment vnode; (M2) checkPath writes the compacted box count back where C keeps routing over the stale pre-compaction count incl. stale array slots; (M3) recordInside omits C's rankdir rotation of the query point.",
  "origin": "edge-route-chain.ts:136/161 (M1); splines-routespl.ts:132+345 (M2); poly-inside.ts:148 (M3)",
  "causalChain": "M1 shifts tail ports/corridors on multi-rank ported edges (piece-count + Δ126); M2 makes the port route a clean 3-box polygon where C routes a degenerate 4-box one and loses c4251->c4253 to its own triangulation failure; M3 shifts record clip endpoints under rankdir=LR (Δ1.6-2.6).",
  "ruledOut": ["layout upstream (nodes exact)", "collect order (19/19 portless match)", "pathend box construction (identical outputs)", "shortestPath pl (1e-6)", "Proutespline fit (1e-6)", "evs/theta (unused unconstrained)", "checkpath repair logic (identical)"],
  "fixLocus": ["src/layout/dot/edge-route-chain.ts", "src/common/splines-routespl.ts", "src/common/poly-inside.ts", "T3: lost-edge failure path (splines install + emit gate)"],
  "perEdge": {
    "c4251->c4253:In0": "M2 (lost edge)",
    "c3378:Out0->c4046:In1": "M1 (+M3 endpoint)",
    "c6428:Out0->c6753:In0": "M1 (+M3 endpoint)",
    "c6412->c6414:In0": "M3",
    "c4256->c4258:In0": "M3"
  },
  "lostEdgeVerdict": "corridor-input",
  "classification": "port-defect"
}
```

## Notes for T2

- M1's faithful fix: pass the SEGMENT edge (which already carries the copied
  ports — fastgr.ts:138) to beginPath/endPath, as C does; watch
  routeEntryRun's portEdge merge (edge-route-chain.ts:302) and finishChain.
- M2's fix: stop writing `pp.nbox`; keep routing over the pre-checkPath
  count and leave compacted-out slots in the array (C memory model). Check
  the OTHER checkPath callers before changing the contract.
- M3's fix: rotate p by the graph rankdir in recordInside (and verify the
  bp-box frame matches C for ported heads); InsideContext needs rankdir
  access.
- M2 fix likely flips c4251->c4253 to a triangulation failure → T3's
  lost-edge semantics become live. Expect corpus-wide movement from M2/M3
  (any degenerate-box corridor; any record+rankdir graph) — watch gate + 
  survey are the guards.

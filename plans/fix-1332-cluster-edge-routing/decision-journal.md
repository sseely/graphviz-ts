<!-- SPDX-License-Identifier: EPL-2.0 -->
# Decision journal

Appended during execution.

| date | batch/task | decision / finding |
|---|---|---|
| 2026-07-01 | B1 plan | Branch `fix/1332-cluster-edge-routing` from main (f877474). T1 in main session per batch table. |
| 2026-07-01 | B1/T1 | Residual confirmed: nodes 0/91, edges 5/117; oracle exits 1 losing c4251->c4253:In0 (its own Pshortestpath triangulation failure). All 5 divergent edges are record-port-bearing; 19 portless records match exactly. Port internal y-frame +8 vs C (emit-normalized, benign). |
| 2026-07-01 | B1/T1 | THREE mechanisms pinned (all CONFIRMED with line-wise C/TS dumps): M1 chain dyna-port resolved toward orig far endpoint vs C's segment vnode (edge-route-chain.ts:136/161) → c3378/c6428 edges; M2 checkPath writes compacted nbox back vs C routing over the stale pre-compaction count + stale array slots (splines-routespl.ts:132+345; C routespl.c:318,683-800) → the lost edge (C's degenerate 16-pt polygon vs port's clean 12-pt); M3 recordInside omits C's rankdir rotation (poly-inside.ts:148; shapes.c record_inside) → Δ1.6-2.6 record clips under rankdir=LR. |
| 2026-07-01 | B1/T1 | Ruled out: upstream layout (nodes exact), collect order, pathend box construction (9-decimal equal), shortestPath pl (1e-6), Proutespline fit (1e-6), evs/theta, checkpath repair logic. lostEdgeVerdict=corridor-input → D1 rung 2 path: with M2 fixed, port expected to fail the same triangulation → T3 lost-edge semantics required. Artifact: .agent-notes/1332-edge-routing-diagnosis.md. |
| 2026-07-01 | B1/T1 | C instrumentation (routespl.c, splines.c) reverted; plugin rebuilt; oracle byte-verified vs pre-instrumentation SVG. TS temp dumps reverted (git checkout ×4 files). |
| 2026-07-01 | B1/T1 | Write-set flag for T2: fixLocus includes `src/common/splines-routespl.ts` (M2) and `src/common/poly-inside.ts` (M3) — OUTSIDE T2's provisional set → interactive expansion ask before T2 edits. M1 (edge-route-chain.ts) is in-set. |
| 2026-07-02 | B2/T2 | Write-set expansion APPROVED by user: + `src/common/splines-routespl.ts` (M2), + `src/common/poly-inside.ts` (M3), + matching `.test.ts`. Implementation order M3 → M2 → M1, per-element gate between each. |
| 2026-07-02 | B2/T2 | M3 recordInside rankdir rotation (poly-inside.ts, mirrors polyInside's existing pattern) → c6412->c6414 and c4256->c4258 exact. |
| 2026-07-02 | B2/T2 | M2 in two parts, both C-faithful: (a) checkPath no longer writes pp.nbox back; (b) removeDegenerateBoxes compacts by STRUCT COPY (JS reference assignment aliased the shifted slot with its stale copy, so pair repairs mutated both — C copies structs by value). Forced-polygon experiment: TS shortestPath FAILS on C's exact 16-pt degenerate polygon → lostEdgeVerdict confirmed corridor-input, D1 rung 2 live. |
| 2026-07-02 | B2/T2 | M1: routeChainSegmented now takes explicit begin/end path edges; routeMultiRankEdgeFaithful + routeEntryRun pass the SEGMENT edges (C's normal-chain model; segment fast edges carry copied ports per fastgr copyVirtualPorts == C new_virtual_edge); routeBackEdge keeps its golden-pinned fwdEdge (hackflag) view at both ends. → c3378:Out0->c4046:In1 and c6428:Out0->c6753:In0 exact. |
| 2026-07-02 | B2/T2 | 1332 per-element: nodes 0, edges 1 (only the lost edge remains, drawn by the LEGACY straightEdgeSplineWithRank fallback after both faithful attempts correctly fail) → T3 entry condition met. |
| 2026-07-02 | B2/T2 | Push-forward (unit-test shape): M2 ×3 + M3 ×2 fix-sensitive unit tests added (red without fixes, verified). M1 has NO small fix-sensitive repro: 3 minimization attempts render byte-identical pre/post because mincross places chain vnodes toward the head — the vnode-vs-head dyna split needs 1332's cluster crowding. M1 is guarded by the 1332 per-element gate + T5 survey (1332's verdict transition depends on it). |
| 2026-07-02 | B2/T2 | Gates: tsc 0; vitest 2551/2551 (+5 new, 0 regressions, goldens green). |

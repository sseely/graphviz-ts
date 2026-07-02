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

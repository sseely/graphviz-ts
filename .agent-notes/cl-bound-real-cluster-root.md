<!-- SPDX-License-Identifier: EPL-2.0 -->

## Observation: clBound treated root-graph as a real cluster (missing REAL_CLUSTER)

- **Context**: graphs-clust5 residual (Δ10, firstDiff `g[8]/path[1]/@d`). One
  isolated edge `a -> x0` (a at root level, x0 inside cluster0) over-segmented:
  native draws one cubic (4 pts), the port two cubics (7 pts) with a tail kink.
  Node positions were already identical — pure edge-routing.
- **Localization (C box-dump oracle)**: instrumented C `make_regular_edge`
  (after `completeregularpath`) and the port `routeRegularEdgeFaithful` to dump
  `P.boxes`. C corridor for a→x0 was graph-wide `[-64,528]` → straight 1-cubic.
  Port corridor was a narrow staircase `[224,294]→[146,217]→[115,146]` →
  pinched at x=146 → 2-cubic kink. Raw `maximalBbox(x0)`: port UR.x=146 vs C 258.
- **Root cause**: in `maximal_bbox`, the right/left neighbor's cluster is taken
  via C's `REAL_CLUSTER(n) ≡ (ND_clust(n) == g ? NULL : ND_clust(n))`
  (dotsplines.c:2137) — a node whose cluster is the routing graph `g` (root)
  is NOT a real cluster. `mark_lowclusters` assigns `ND_clust = root` to every
  top-level node, so x0's right neighbor `b` (top-level) has clust = root.
  C's `cl_bound` calls `REAL_CLUSTER(b)` → NULL → no clamp. The port's `clBound`
  used `adj.info.clust` raw (= root G), so `interferes(root, cluster0, cluster0)`
  fired and clamped x0's box to the root bbox (UR.x 258→146).
- **Fix** (edge-route-faithful.ts): add `realCluster(n, g)` helper mirroring
  REAL_CLUSTER; apply it to the adjacent node's cluster in `clBound` (NORMAL
  branch) and `virtualAdjCluster` (orig tail/head). tcl/hcl keep raw
  `ND_clust(n)` (C does NOT wrap those). Thread `ctx.g` (the routing graph =
  root) into clBound.
- **Result**: clust5 all edge paths + full geometry conformant with native. Survey:
  **graphs-clust5 diverged→conformant, 0 regressions** (rules-gate PASS, both
  baselines). Single-graph fix (no platform copies were diverged).
- **Confidence**: High (C box-dump oracle + clean gate).

<!-- SPDX-License-Identifier: EPL-2.0 -->
# 2183 diagnosis (T1+T2+T3, fix-2183-ortho-concentrate)

## Verdict — one root cause for all three symptom classes

```json
{
  "mechanism": {
    "cause": "infuseAllNodes feeds infuseEdgeChain FAST-graph out-edges (n.info.out) where C's rebuild_vlists walks the cluster's ORIGINAL cgraph out-edges (agfstout(g,n), conc.c:146-155). On a fast segment to_virt is unset and targetRank is the first vnode's rank, so the chain walk never infuses intermediate vnodes; a cluster rank populated only by chain vnodes (cluster_A rank 9) gets no rankleader.",
    "origin": "src/layout/dot/conc.ts:infuseAllNodes (~:272); C ref lib/dotgen/conc.c:137-156 (rebuild_vlists first loop)",
    "causalChain": "rankleader[9]==null → fillAllRankVlists returns -1 → rebuildVlists/dotConcentrate return -1 → dotPosition returns EARLY (position.ts:168) → x-solve, cluster containment, set_aspect, cluster geometry all skipped → (a) x-layout collapses to mincross-era values (canvas 137pt vs oracle 385pt; y fine — set_ycoords ran before the abort), (b) cluster bbs stay uninitialized → degenerate 5-point polygons at (63,0) and NO cluster labels, (c) the ortho maze built from the collapsed coords has adjacent node cells → shortPath finds 3-node degenerate paths for a->b and o->r → convertSPtoRoute yields 0 segs → attachOrthoEdges skips them (same skip exists in C) → 2 lost edges.",
    "ruledOut": [
      "ortho concentrate dedup (buildEdges): both edges GATHERED (21/21), lost after routing — instrumented",
      "convertSPtoRoute conversion bug: it faithfully mirrors C; the 3-node path is real input (C paths for the same edges have len 5, port len 3 — instrumented both sides)",
      "node sizes/labels: all 18 node widths byte-identical to oracle",
      "splines=ortho as trigger: variant renders show concentrate=true alone degenerates clusters (no-conc variant is near-oracle 364x697 with labels; no-ortho variant still degenerate 49x673)",
      "emit (device-cluster): polygons ARE emitted, from garbage bb — upstream data, not emit"
    ]
  },
  "fixLocus": ["src/layout/dot/conc.ts:infuseAllNodes — iterate the cluster's ORIGINAL out-edges (g.edges by tail), matching agfstout"]
}
```

## T3 delta attribution

All numeric deltas (maxΔ 248) are class (a) expected-downstream of the
early abort — the x-solve never ran. No independent numeric defect
identified; no maze tie-break claim needed at this stage. Re-measure
after the fix; any residual gets its own attribution.

## Write-set re-scope (gate)

Provisional write-set (ortho-adapter.ts / device-cluster.ts) is
superseded: the pinned origin is `src/layout/dot/conc.ts` (single file,
plus its test). Same character as the 1213 precedent (crude anticipated
locus → pinned actual locus).

## Secondary observation (not fixed here, watch in re-measure)

`fillRankVlist` bakes the window into a DETACHED slice
(`v = rootRank.v.slice(lead.order)`, vStart=0) instead of the aliasing
convention used everywhere else (`v = rootRank.v; vStart = lead.order`,
cf. applyVlistReset). C keeps a live pointer alias (conc.c:168). Stale
if root ranks shift between concentrate and window consumption
(flat_edges label insertion runs AFTER concentrate). If post-fix
residuals implicate windows, this is the next suspect.

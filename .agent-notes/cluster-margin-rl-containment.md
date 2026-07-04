# Cluster margin / RL containment / constraint=none — ALL RESOLVED

Investigating 2470's 38483 maxDelta (was the #1 diverged input) peeled four bugs,
all now fixed and on main.

## 1. Cluster `margin` attribute never read — FIXED (1e1dbfa)
`GraphInfo.clusterMargin` was declared but never assigned; graphMargin/graphMarginY
fell back to CL_OFFSET (8) always. Added `clusterMarginOf(g)` =
late_int(g, G_margin, CL_OFFSET, 0) with subgraph-chain (agxget) inheritance.

## 2. separate_subclust wrong under flip — FIXED (e0eeae4)
Two compensating errors in position-cluster.ts:separateClustPair:
- read raw `.v[0]` (root's leftmost) instead of cluster-local via rankGet(vStart);
- make_aux_edge args swapped vs C (`right.rn,left.ln` instead of `left.rn,right.ln`).
They cancelled for rankdir=TB but compounded under flip (LR/RL) → clustered nodes
collapsed in the within-rank axis. Both corrected → mirrors position.c:472-480.

## 3. mapbool("none") returned true — FIXED (e0eeae4)
rank.ts:mapbool did `parseInt(s,10) !== 0` → NaN !== 0 = true for non-numeric
strings, so `constraint=none` was treated as a RANK constraint, mis-ranking
clusters joined only by constraint=none edges (121/258 got an extra rank). Now
mirrors lib/common/utils.c:mapBool (leading-digit only parses; else default false).
This was the prerequisite that made fix #2 land with 0 regressions.

## Results (rules survey, 0 regressions throughout)
- 2470 height 18043 → 39950 (C 39897); maxΔ 38483 → 16982 (no longer #1 diverged).
- 1879 22872→1149, 2471 16160→3097, 2620 8074→3207, 1436 1643→565.
- share/windows-clust5 → conformant; 121/258 → match C geometry exactly.
- gate improvements 10→12, regressions=0. PARITY.md/parity.json refreshed (f0469dd).

## STILL OPEN: 2470 residual (separate issue)
2470 is still diverged at maxΔ 16982, firstDiff `svg/g[1]/g[232]/path[1]/@d` — an
EDGE-SPLINE divergence now that the cluster node spacing is correct. 2239 (5287,
childCount) also unchanged — a different (non-spacing) cluster issue. Both are
separate follow-ups, not cluster-margin/separation.

<!-- SPDX-License-Identifier: EPL-2.0 -->
# Decision journal

Appended during execution.

| date | batch/task | decision / finding |
|---|---|---|
| 2026-06-30 | prior mission | Diagnosed: port drops 6 concentrate edges (maxDelta 0, `svg/g[1][childCount]`). Root cause = `dotSplines_` collect iterates `g.nodes.values()` (NORMAL only), skipping the virtual `splineMerge` node `left` that owns the 5 secondary DOWN-sweep chains (+1 from Stand). Full artifact: `git show fix/graphs-b15:.agent-notes/graphs-b15-concentrate-drop.md`. |
| 2026-06-30 | prior mission | Fix attempt (iterate nlist + bespoke `routeConcentrateSecondaryChain`) emitted all 153 edges but DOUBLED ~40 beziers (maxDelta 0→432). Two boolean guards failed at the same 41 edges. Reverted (`a124fed`); deferred as needing "edgecmp-grouping/getmainedge dedup — each orig routes once". |
| 2026-07-01 | re-scope | Grounded the real fix: the port ALREADY has `edgecmp`/`getMainEdge`/`groupSize`/`routeEdgeGroup` (splines.ts). The gap is the COLLECT step (splines.ts:521) missing virtual `splineMerge` nodes. Faithful fix = mirror C's rank-array collect (`dotsplines.c:281-299`) and route new edges through the EXISTING group dispatch so each `getMainEdge` group routes once — NO side router, NO boolean guard (AD-2/AD-3). Bar = conformant AND maxDelta ≤ HEAD (AD-4). User approved this scope. |

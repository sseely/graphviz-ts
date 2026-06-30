# Findings: grouping is necessary but INSUFFICIENT — second divergence

**Status: mission STOPPED (honest stop).** The caller-side grouping fix (T2)
is correct, faithful, and golden-neutral, but it does **not** close the `#241_0`
curl. A second, deeper divergence in the aux **back-edge routing** blocks it,
and that fix is outside this mission's scope (AD-2 / scope-creep STOP).

## What T2 did (kept on the branch, NOT merged)
`edge-route.ts` `routeFaithfulSidePort` now groups all adjacent same-rank
side-port flats between a node pair into ONE `makeFlatAdjEdges(cnt=N)` call,
ordered so `group[0]` is a forward edge (`tail = lower-order node`), matching
C's `make_flat_edge` (which normalizes the lead edge forward via `makefwdedge`
and passes it as `e0`, so `auxt = clone(node2)`). Helper:
`collectAdjacentFlatGroup` + `isGroupableFlat`.

Verified the grouping fires correctly on `#241_0`:
`trig=2->3 lo=2 n=3 [2->3, 2->3, 3->2]` — back edge cloned `auxh->auxt`.

## Why it is INSUFFICIENT (the proof)
With grouping, the per-edge aux spline sizes are:
`2->3(e/w):4  2->3(ne/nw):7  3->2(sw/se back):4` — the **back edge stays
size 4 (straight)**; C gives it 7 (curl).

A controlled experiment (otn fixed to node2, varying clone order) shows clone
ORDER is NOT the cause:
```
C-order   [back, ne/nw, e/w]: 3->2:4  2->3:7  2->3:4
port-now  [e/w, ne/nw, back]: 2->3:4  2->3:7  3->2:4
mixed     [ne/nw, back, e/w]: 2->3:7  3->2:4  2->3:4
```
In EVERY order the forward corner-port edge (ne/nw) curls to 7 and the back
corner-port edge (sw/se) stays 4. So the divergence is in how the port routes
the **back-edge clone**, independent of grouping, order, and `otn`.

## The second divergence (root, pinned)
In the aux graph, `auxt` (rank 0) and `auxh` (rank 1) are on **different ranks**
(the hvye weight-10000 edge forces the gap), so the cloned edges are **regular
adjacent-rank** edges, not flat. The aux is routed by `dotSplines_`
(`splines.ts`), whose grouped `dispatchEdgeGroup` path **skips same-rank edges**
and whose parallel path needs a shared main-edge; the distinct clones fall
through to `routeDotEdges` → `routeOneEdge` per edge.

For the back-edge clone (`auxh` rank1 → `auxt` rank0), `routeOneEdge` calls
`routeFaithfulAdjacentBack` **first** (guard `tr === hr + 1`, which matches),
*before* the side-port path. `routeFaithfulAdjacentBack` →
`makeFwdEdge` → `routeRegularEdgeFaithful` routes it **straight**, ignoring the
`sw/se` corner ports. C's `make_regular_edge` honors those ports and curls it
(size 7).

- Port: `src/layout/dot/edge-route.ts` `routeOneEdge` (calls
  `routeFaithfulAdjacentBack` before the side-port branch) /
  `routeFaithfulAdjacentBack`.
- C: `lib/dotgen/dotsplines.c:make_regular_edge` (adjacent back edge with ports).

The forward corner-port edge (`ne/nw`, `auxt->auxh`) curls correctly because it
takes the side-port path (`routeFaithfulSidePort` → port-driven curl); only the
back edge is intercepted by the straight back-edge path.

## Impact characterization (the grouping change alone)
- Curated goldens: `vitest` 1992/1992 pass; the only non-pass is the `#241_0`
  back-edge assertion (now an `xfail` tripwire). Every existing golden
  conformant.
- Corpus survey (796): **diverged 357 → 357 (zero new diverges)**; `#241_0`
  unchanged (diverged, maxDelta 126); the only 2 verdict deltas (`2743`, `2782`)
  are `errored↔timeout` flakiness, not geometry. `parity.json` restored to
  baseline (no committed change).
- So the grouping change is a safe, faithful prerequisite — banked on the branch,
  **not merged** (mission goal unmet).

## Recommended next mission (re-scope)
Target the aux back-edge port-curl: make an adjacent-rank back edge **with side/
corner ports** honor those ports (curl) instead of routing straight — i.e.
`routeFaithfulAdjacentBack` should defer to / reproduce the side-port curl when
`hasSidePort(e)`, matching C's `make_regular_edge`. This touches **core
back-edge routing** (all adjacent back edges, not just the aux), so it carries
real golden-risk and needs its own diagnosis + regression gate. Build it on top
of this branch's grouping change (the necessary first half).

## STOP rationale (brief stop conditions hit)
- "Implementing grouping requires restructuring `routeDotEdges` beyond the
  adjacent-flat dispatch (touching regular/back/labeled routing)" — TRIGGERED.
- AD-2 (caller-side only) cannot achieve the goal; the real fix is in back-edge
  routing. Surfacing rather than silently expanding scope.

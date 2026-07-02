<!-- SPDX-License-Identifier: EPL-2.0 -->
# T1 design: graphs-b15 collect + secondary-chain routing

## Headline (the advance past the prior blocker)
Collecting from the **rank array** (incl. virtual `splineMerge` nodes) and routing
through the **existing group loop** produces **NO doubling** — the experiment held
`maxDelta = 0` (vs the prior side-router's 432). `dedupByOrig` inside
`dispatchEdgeGroup` collapses the same-orig duplicates (a long edge collected from
both its NORMAL tail and a splineMerge intermediate → same `getMainEdge` → one
group → routed once). The prior session's doubling came from a **bespoke
`routeConcentrateSecondaryChain` running alongside the dispatch**; routing the
same edges *through* the dispatch avoids it. **This de-risks the mission's main
hazard.**

## Two-part gap (experiment-verified)

### Part A — collect (necessary, safe)
`dotSplines_` (`splines.ts:523`) iterates `g.nodes.values()` = NORMAL only.
`nodeNeedsRouting(n)` (`splines.ts:296`) ALREADY gates `NORMAL || splineMerge(n)`
correctly — only the **iteration source** is wrong. Fix = iterate the rank array
`g.info.rank[minrank..maxrank].v[]` (**null-guard `.v` slots** — C guards them;
unguarded → `Cannot read properties of null`), matching C `dotsplines.c:281-299`.
Experiment: rank-array collect visited 139 rank nodes (94 virtual, 17
splineMerge, 94 absent from `g.nodes`), gathering 210 edges (up from ~fewer).

### Part B — secondary back-edge chains still don't get `spl` (the real work)
With the collect fixed, output was STILL 147 edges (6 missing), maxDelta 0. Why:
- The 6 dropped edges are **back edges** (tails at high rank/bottom → HoverRest
  (y=-392) / Stand (y=-489) at low rank/top). Verified via node y-coords.
- After the DOWN sweep, each secondary's first vnode is merged into `left`;
  `left.out` gains one edge per secondary chain: `left→vn_X`, `to_orig`→orig X.
- Collected as lone edges (each `getMainEdge` = its own orig X → own group of 1).
  `dispatchEdgeGroup` → `routeMergedChain(g, X)` → `mergedChainRuns` returns null
  because `rh <= r` for a back edge (`edge-route-chain.ts:287`) → returns false →
  `routeLoneEdge(X)`. That router walks X's chain from X's own tail, but the chain
  was rewired through `left`, so it cannot complete → **no `spl` → no `<g>`**.

## Fix design (for T2)
1. **Collect:** replace `splines.ts:523` with rank-array iteration
   (`minrank..maxrank`, null-guard `.v`), keeping the existing
   `collectNodeEdges`/`nodeNeedsRouting` gate. Mirror `dotsplines.c:281-320`.
2. **Secondary chain routing:** in the lone-edge branch of `dispatchEdgeGroup`
   (`splines.ts:~395-401`), when the representative edge starts at (or its chain
   passes through) a `splineMerge` node and `routeMergedChain` declines, route the
   chain **from the splineMerge node** down the intact `out.list[0]`/`to_virt`
   chain to the original's endpoint and `clipAndInstall` on the original — the
   logic the prior `routeConcentrateSecondaryChain` used, but folded INTO the
   dispatch so `dedupByOrig` prevents doubling. Handle the back-edge direction
   (route low-rank→high-rank then `swapSpline` if `swapEndsP`).
   - C reference: each `left→vn_X` routes independently via `make_regular_edge`
     (cnt=1), which follows the chain and sets `ED_spl` on X.

## Interface contract (consumed by T2)
```
collectChange = { file: "src/layout/dot/splines.ts", line: 523,
  fromIter: "g.nodes.values()",
  toIter: "g.info.rank[minrank..maxrank].v[] (null-guarded)",
  splineMergePredicate: "existing nodeNeedsRouting (NORMAL || splineMerge)" }
coalesces = true            // group-loop dedupByOrig prevents doubling (maxDelta 0 verified)
getMainEdgeFix = null       // getMainEdge already correct
secondaryChainRouting = "fold prior routeConcentrateSecondaryChain into the lone
  dispatch when routeMergedChain declines for a splineMerge-sourced back-edge chain;
  install spl per orig; no side router, no boolean guard"
cReference = "dotsplines.c:281-320 (collect), 99-108 (getmainedge), make_regular_edge (per-orig route)"
routeOnceProof = "rank-array collect + existing dispatch → 147 edges, maxDelta 0
  (NOT 432): dedupByOrig collapses same-orig duplicates. Secondaries still absent
  because routeMergedChain declines back edges → routeLoneEdge cannot walk the
  rewired chain."
```

## Ruled out
- **Doubling via collect+dispatch** — experiment held maxDelta 0. The hazard was
  the *side router*, not the collect.
- **getMainEdge/to_virt wrong** — grouping/dedup works; secondaries are correctly
  1-edge groups resolving to their own origs.
- **Collect-only sufficiency** — DISPROVEN: 147 edges after the collect fix.

## Scope note
Bigger than a one-line collect change: Part B reworks the lone/merged-chain
routing for splineMerge-sourced back-edge chains. Blast radius = `splines.ts`
dispatch + `edge-route-chain.ts` chain routing. The 789-corpus `survey:gate`
(0 regressions, maxDelta guard) is the guard (AD-4). Not an AD-5 escape — genuine
port defect with a now-clear, de-risked fix path.

## T2 attempt-1 + deeper dive (2026-07-01) — fix locus sharpened

**Reproduced maxDelta 432** with collect(rank-array) + secondary router folded
into the lone dispatch. NOT the 6 targets — 8 LONG edges doubled (3 paths vs 2:
Stand:Normal→JumpVertical, Stand:Target→JumpVertical, Walk→Strafe, Walk→Fall,
WalkStepUp→Fall, Strafe→Fall, Fall→LandRunning, HoverRest→Fall).

**Group-structure probe** (`__G__`): each doubling orig fragments into MULTIPLE
cnt=1 groups sharing one getMainEdge, e.g. Stand:JumpVertical → 4 groups:
`Stand->v`[NORMAL tail, real tail port, EMPTY head port] and
`left->JV`[splineMerge, empty ports → portGateEdge=main edge, head port
JumpVertical:In], ×2 origs (Normal/Target samehead-merged).

**Mechanism:** `groupSize` (`splines.ts:339`) splits consecutive same-getMainEdge
CHAIN SEGMENTS via the cross-rank `portEq` check. Asymmetry: for `Stand->v`,
`portGateEdge`=e0 (has tail port) carries the SEGMENT's empty head_port; for
`left->JV`, `portGateEdge`=main edge carries JumpVertical:In → `portEq(head)`
mismatches → split. C's group loop (`dotsplines.c:344-383`) breaks only on
getmainedge (+ ED_adjacent/label/`-C` MAINGRAPH), and `make_regular_edge` routes
the whole getmainedge group once, handling multi-orig + multi-segment internally.

**Scope (larger than one fn):** the port's concentrate merge (`conc.ts`) yields
TWO separate normal-tail chains from `Stand` (one per samehead orig), vs C's
merged topology. So a faithful fix spans: (1) `conc.ts` merge topology,
(2) collect (rank array — done, correct), (3) `groupSize` (stop fragmenting
same-getmainedge segments; mirror C's ea/eb + portcmp exactly), (4) the group
router = port C's `make_regular_edge` group handling (route each getmainedge
group's distinct origs ONCE using ALL their segments) replacing the
dedupByOrig/routeMergedChain/routeLoneEdge/secondary decomposition.

**Status:** genuine multi-component rework of the core routing dispatch.
Not a bounded change; needs a dedicated focused effort with the C oracle. Two
independent sessions now converge here. Branch `fix/graphs-b15-edgecmp` holds
docs only (src clean); b15 stays a documented edge-count divergence until the
rework lands.

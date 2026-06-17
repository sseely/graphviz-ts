# Decision Journal — DOT-1b (retire the fitter)

Appended during execution (per ~/.claude/rules/autonomous-execution.md).

| Task | Date | Decision | Rationale | Flagged |
|------|------|----------|-----------|---------|
| T2 | 2026-06-17 | **Pre-mission feasibility spike DONE — T3 is viable.** Instrumented the C `make_regular_edge` + `clip_and_install` (local graphviz build, reverted after) to capture the exact opposing-pair geometry. Recipe below resolves the DOT-1 puzzle. | Burned down T3's epistemic risk before committing to the autonomous run. | No |
| T1 | 2026-06-17 | **`makeFwdEdge` exported + adjacent-back faithful path landed.** Generalized `makeBackFwdEdge`→`makeFwdEdge`, sets `to_orig=e`/`edge_type=VIRTUAL` so `clipAndInstall`→`newSpline` installs on the original edge. Wired `routeFaithfulAdjacentBack` ahead of BOTH the multi-rank back dispatch (`routeOneEdge`) and the non-forward dispatch (`routeEdgeNonForward`). | C source faithful (makefwdedge + clip_and_install). Adjacent back edges with `to_virt` would otherwise be claimed by `routeBackEdge`→fitter, so the check must precede it. | No |
| T1 | 2026-06-17 | **Explicit `swapSpline` in the adjacent-back path** rather than relying on the global `edgeNormalize` pass. | TS phase ordering: `dotSplines_` runs `edgeNormalize` (line 410) *before* `routeDotEdges` (line 411), so the global swap has already passed by the time a single back edge is routed. Surgical explicit swap; NOT touching the global ordering (would risk goldens). Faithful to C's `swap_spline` mechanism, invoked at the right point for the TS pipeline. | No |
| T1 | 2026-06-17 | **Test bypasses the group path via maxphase=3 model-level layout.** No natural renderSvg input routes a lone adjacent back edge through the single-edge path — the group router (`routeParallelEdgeGroup`) always claims opposing pairs `a->b;b->a` (confirmed: even `b->a[constraint=false]` groups). Pinned b→a against `DOT_BT_CHAIN_AB` (the real dot oracle for a centred bottom→top arrow-at-top adjacent edge), maxΔ≈0.23pt. | The single-edge faithful path is otherwise unreachable from renderSvg; a focused model-level test is the only way to exercise + pin it. | No |
| T1 | 2026-06-17 | **Gate PASS: 1812 passed / 0 failed (1810 baseline + 2 T1 tests), 115 goldens byte-identical, tsc 0, lizard clean.** | AD-3 invariant held — zero golden churn. | No |

## T2 spike recipe — C opposing/parallel routing (for T3)

**Method:** added throwaway `fprintf` to `~/git/graphviz` `make_regular_edge`
(dump `pointfs`) and `clip_and_install` (dump final `newspl` + `tn`/`hn`/`orig`),
rebuilt `libgvplugin_dot_layout`, ran `digraph{a->b; b->a}`. C source reverted,
plugin rebuilt clean, `/tmp/gvplugins` refreshed.

**Observed (relative coords; absolute x = +node-center 27, SVG y = −internal y):**
- Base (routed once for `fe`=a→b): straight vertical, endpoints at node centers,
  interior duplicated — `(0,89)(0,89)(0,19)(0,19)`.
- The Multisep offset shifts **interior control points only** (k=1..n−2); endpoints
  stay at center. Back member b→a's shifted input: `(0,89)(9,89)(9,19)(0,19)` —
  bulges right, endpoints centered.
- Final installed splines (PRE-normalize):
  - a→b (orig=a→b): `(-5.88,72.05)(-6.67,64.57)(-6.92,55.58)(-6.63,47.14)`
  - b→a (fe=a→b fwd-view, orig=b→a): `(6.64,60.69)(6.92,52.24)(6.66,43.25)(5.86,35.79)`
- `edge_normalize` (post-routing pass) calls `swap_spline` on every back edge
  (`swap_ends_p`==true) → reverses point order + arrow flags. b→a becomes
  `35.79→60.69`, arrow at a = **the oracle exactly**.

**Mechanism (the DOT-1 blind spot):** C routes the back member NOT by manually
reversing the base, but by (1) `makefwdedge` → a forward view (tail/head swapped,
`to_orig`=orig, edge_type=VIRTUAL); (2) `clip_and_install(fwdview, aghead(fwdview),
shiftedPts)` — its reversed-edge branch (`tn != agtail(orig)`) swaps which port
clip flags/boxes apply; (3) the separate `edge_normalize`/`swap_spline` pass
reverses the spline afterward. DOT-1 failed because it passed `orig` directly AND
manually reversed → double-reversal + wrong clip ends.

**T3 recipe (faithful):**
1. Route ONE forward base for the group's forward representative
   (`routeRegularEdgeFaithful` adjacent / `routeMultiRankEdgeFaithful` multi-rank).
2. Per member: shift **interior** control points by the C offset
   (`dx = Multisep*(cnt-1)/2`, then +Multisep cumulatively); pass a FRESH copy to
   clipAndInstall (it mutates in place — DOT-1 bug).
3. Back members: build the forward view via T1's `makeFwdEdge`, call
   `clipAndInstall(fwdView, aghead(fwdView)=fwdView.head, ptsCopy)`. Do **NOT**
   manually reverse.
4. Rely on the existing `swapEndsP`/`swapSpline` pass (splines.ts:242,255) to
   reverse back-edge splines post-routing — confirm it runs for group members.
5. TS `clipAndInstall`→`getPortConfig` already implements the reversed-edge port
   swap (`isFwd = fe.tail === orig.tail`) — no change needed there.

**Conclusion:** T3 viable. The fix is to mirror C's makefwdedge + clipAndInstall +
swapSpline sequence rather than reverse-the-base.

## T2 spike — TS byte-exact proof (2026-06-17)

Prototyped the recipe in `splines-route.ts` (throwaway, reverted): forward base via
`routeRegularEdgeFaithful`/`routeMultiRankEdgeFaithful`; interior Multisep shift;
back members via `makeFwdView` (swap ends, `to_orig=e`, `edge_type=VIRTUAL`) →
`clipAndInstall(fwdView, fwdView.head, freshCopy)`; NO manual reverse.

**Result — geometry byte-exact:**
- a→b: `M21.12,-72.05…20.37,-47.14` — exact oracle match.
- b→a: control points `{32.86,-35.79; 33.66,-43.25; 33.92,-52.24; 33.64,-60.69}`
  match the oracle set EXACTLY — only the point ORDER was reversed (mine ran
  60.69→35.79; oracle 35.79→60.69).
- `dot-multi-edge` + `mc-edge-multicolor` goldens: byte-identical.

**Two residuals for T3 (both small, both understood):**
1. **Back-member point-order normalization.** `edgeNormalize` (splines.ts:251,
   runs in `dotSplines_(g, true)` at line 410) did NOT reverse the group-installed
   b→a — likely the spline is installed on the `makeFwdView` object and b→a's
   `e.info.spl` alias/`swapEndsP` check misses it. T3 must ensure the back member's
   spline is installed on the original edge so `edgeNormalize` reverses it (or
   reverse explicitly once — but NOT double like DOT-1). Investigate `newSpline`/
   `clipAndInstall` install target for a `to_orig` virtual `fe`.
2. **AC4 spacing is a stale fitter-era expectation.** `multi-edge.test.ts` AC4
   expects spacing ~13.37 (<15); the faithful spacing is ~17.3 and is CORRECT —
   the byte-identical `dot-multi-edge` golden proves the faithful 3-parallel
   matches dot. T3 updates AC4's expected value to the oracle-derived spacing.

**Verdict: STRONG GO.** The hard geometry is solved; T3 is now bookkeeping
(install-target wiring + a stale-test update), not an open investigation.

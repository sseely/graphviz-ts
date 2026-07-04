# Parallel/opposing cross-rank corridor routing — fixed; lone-edge recover_slack follow-up

## Observation: parallel/opposing multi-rank group base routed the wrong edge
- **Context**: mission fix-parallel-corridor-route. Parallel/opposing cross-rank
  edges (e.g. ldbxtried `n0->n2` ×3, graphs-NaN 2-cycles) under-segmented to a
  straight line ending at a virtual node instead of routing the pathplan corridor.
- **Finding**: `baseSplineForGroup` (splines-route.ts) routed the group's shared
  base from the FIRST virtual chain segment (`edges[0]`, head = a VIRTUAL node at
  rank r+1) instead of `resolveOrigEdge(edges[0])`. `routeRegularEdgeFaithful`
  accepted the adjacent-looking segment and returned a straight base to the vnode,
  short-circuiting `routeMultiRankEdgeFaithful`. Also `installShiftedEdge` clipped
  each copy's head to `fe.head` (the vnode) rather than the real head.
- **Fix** (commit `fix(T1.2)`): resolve the representative to its original edge in
  `baseSplineForGroup`; add `groupRealHead(e)` and clip copies to the real head.
  Mirrors C `make_regular_edge` (realedge resolve + `while(ND_node_type==VIRTUAL)`
  chain walk + `clip_and_install(e, aghead(e))`).
- **Impact**: survey gate PASS — **0 regressions, 13 improvements** (graphs-NaN,
  b102, b143, pmpipe, xx, 2193 + share/windows/linux variants flip
  diverged→match). NaN was a long-standing 2-cycle blocker.
- **Confidence**: High (C-instrumented oracle T0.1; port probe T0.2; survey gate).

## ROOT CAUSE PINNED (2026-06-25, C-instrumented) — it is EDGE ROUTING ORDER, not recover_slack
The lone `n0->n1` is ADJACENT (ranks 0->1), routed by `routeRegularEdgeFaithful`.
C-instrumented oracle (GV_DUMP_MRE in recover_slack + the make_regular_edge
dispatch) proves:
- **recover_slack is FAITHFUL**: C and the port BOTH move the shared rank-1 vnode
  `%0` identically (x 967->789, box [729.3,848.7]). Not the miss.
- **The miss is ORDER**: C routes ALL edges (lone + parallel/opposing groups) in
  ONE interleaved edgecmp pass. There `n0->n1` is dispatched at position **30**
  and the `n0->n2` group (cnt=3, head `%0`) at position **85** — so C routes
  `n0->n1` BEFORE the group moves `%0`, and reads `%0` at its original x=967 ->
  correct 7-pt corridor. The port splits routing into TWO passes:
  `dotSplines_` routes ALL groups first (recover_slack moves `%0`->789), THEN
  `routeDotEdges` routes lone edges -> `n0->n1` reads the moved `%0`=789 ->
  wrong 4-pt straight. Disabling recover_slack "fixes" n0->n1 only because it
  hides the group's move; the real fix is to route in C's single edgecmp order.
- **Confirmed**: port-with-recover_slack-disabled conforms to C's 7-pt n0->n1.
- **Fix locus**: the routing-pass STRUCTURE (splines.ts dotSplines_ groups-loop +
  edge-route.ts routeDotEdges) — route lone and group edges in one edgecmp-ordered
  pass, NOT groups-then-lone. HIGH blast radius (shared router); narrow benefit
  (only graphs where a lone edge shares chain vnodes with a later-routed group,
  e.g. ldbxtried). Needs the same investigation-first + 0-regression survey
  discipline as the parent mission.

## [SUPERSEDED by the above] earlier hypothesis: lone edge under-segments once its chain vnodes are recover_slack'd
- **Context**: ldbxtried `n0->n1` (lone, dir=both, multi-rank from cluster0).
  PRE-fix it matched the headless ref (7-pt corridor); POST-fix it under-segments
  to a 4-pt straight line ending at a virtual node.
- **Finding**: `n0->n1` does NOT pass through the group router (it is lone), so the
  fix does not touch it directly. The regression is a SHARED-STATE side effect:
  routing the `n0->n2` GROUP now calls `recoverSlack` (via
  routeMultiRankEdgeFaithful), repositioning shared chain virtual nodes
  (`resizeVnInBox`). The lone-edge router (`edge-route.ts:routeOneEdge` →
  multi-rank path) then routes `n0->n1` from those moved vnodes and produces a
  degenerate straight path. C also recover_slacks these vnodes (every multi-rank
  edge does) yet C's `n0->n1` stays a 7-pt corridor — so this is a LATENT
  faithfulness gap in the port's LONE multi-rank router, exposed (not caused) by
  the now-more-C-faithful shared vnode state.
- **Impact**: Contained — `graphs-ldbxtried` was already `diverged` in the survey
  baseline and stays diverged (no verdict regression; 0 net regressions). conformant
  graphs (395) are fully protected by the gate (any edge change → regression; none
  occurred). Keeps ldbxtried's whole-SVG golden from conformant with → marked
  `knownResidual`.
- **Scope**: Fixing it requires changes in `edge-route.ts` (the lone-edge router),
  OUTSIDE this mission's T1.2 write-set (`splines-route.ts`,
  `edge-route-faithful.ts`) — a brief stop condition. **Follow-up mission**: make
  the lone multi-rank edge router (routeOneEdge / its routeMultiRankEdgeFaithful
  fallback) route the corridor faithfully when chain vnodes have been
  recover_slack'd. Repro: `~/git/graphviz/graphs/directed/ldbxtried.gv`, edge
  `n0->n1`; instrument C make_regular_edge for the lone n0->n1 vs the port.
- **Confidence**: High that it is shared-vnode/recover_slack interaction (pre/post
  fix render diff isolates it; my fix touches only the group path). Medium on the
  exact lone-router locus (not yet C-instrumented for n0->n1 specifically).

## Oracle recipe (reusable)
Instrument `~/git/graphviz/lib/common/routespl.c routesplines_` with
`getenv("GV_DUMP_MRE")`-gated dumps of boxn / `pp->start.p`/`end.p` / box list /
`Pshortestpath` polyline; `cd ~/git/graphviz/build && make gvplugin_dot_layout`
(symlinked into /tmp/ghl so the headless oracle picks it up); render with
`GV_DUMP_MRE=1 GVBINDIR=/tmp/ghl ~/git/graphviz/build/cmd/dot/dot -Tsvg`. Revert
routespl.c + rebuild for a clean oracle before generating golden refs / surveying.

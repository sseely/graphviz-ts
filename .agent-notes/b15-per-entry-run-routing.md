<!-- SPDX-License-Identifier: EPL-2.0 -->
# graphs-b15: per-entry run routing (make_regular_edge model)

## Observation: C routes one make_regular_edge call PER COLLECTED ENTRY, not per getmainedge group
- **Context**: Porting C's concentrate secondary-chain routing (graphs-b15 dropped
  6 edges). Instrumented `dotsplines.c` (B15DUMP env gate, rebuilt
  gvplugin_dot_layout → /tmp/ghl) dumping the sorted collect list, group
  boundaries, and clip_and_install calls.
- **Finding**: Both prior sessions' model ("make_regular_edge routes a
  getmainedge group once, handling multi-segment internally") is WRONG. C's
  collect yields one entry per merge-bounded RUN (b15: 173 entries; a long orig
  through a splineMerge node = lead-in entry + trunk entry). The group loop's
  MAINGRAPH break (`"Aha! -C is on"`, dotsplines.c:375) forces cnt=1 for
  consecutive same-main REGULAREDGE entries, so each run routes separately;
  clip_and_install APPENDS one bezier per run onto the resolved orig, in
  edgecmp order (oracle draws the merge-side half FIRST). cnt>1 groups are only
  rep+AUXGRAPH (ND_other parallel/opposing copies). A concentrate secondary's
  drawn spline = ONLY its own branch from the merge node; the trunk belongs to
  the rep.
- **Impact**: The port fix was three parts, all in the dispatch (conc.ts was
  fine): (1) rank-array collect; (2) C's edgecmp portcmp/GRAPHTYPEMASK
  tie-breaks (bezier append order) + C-faithful groupSize incl. MAINGRAPH
  break; (3) routeEntryRun (edge-route-chain.ts) routing a partial run
  (either end at a splineMerge node) via routeChainSegmented + clipAndInstall
  on the entry, with a post-loop one-shot swapSpline for back-edge origs
  (port's edgeNormalize can't see ND_other origs). routeMergedChain DELETED —
  its run-splitting + trunk-ownership rule compensated for the old NORMAL-only
  collect and double-routes once trunk entries are collected.
- **Confidence**: High (C-side + TS-side instrumented dumps compared line-wise;
  install counts match 168/168).

## Observation: compareSvg does not descend past a childCount mismatch
- **Context**: b15's committed verdict was "diverged, maxDelta 0". After
  restoring the 6 edges, maxDelta jumped to ~1033.
- **Finding**: compareNodes stops pairing children when counts differ, so any
  graph with a childCount diff at svg/g[1] reports maxDelta 0 regardless of
  geometry. HEAD's b15 actually had 41/153 edges diverging from the oracle
  (e.g. Stand->JumpVertical drawn as ONE straight path vs oracle's 2
  merge-split beziers) — invisible until the count matched.
- **Impact**: "maxDelta stayed 0" is meaningless across a fix that changes
  element counts; gate such fixes by per-edge path comparison (this fix:
  41 diverging → 28, 0 regressions, 13 fixed, 6 restored). The residual 28 all
  also diverged at HEAD (pre-existing x-coord/routing residuals, separate
  problem).
- **Confidence**: High.

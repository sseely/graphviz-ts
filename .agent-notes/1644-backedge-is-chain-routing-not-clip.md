<!-- SPDX-License-Identifier: EPL-2.0 -->

## Observation: 1644 0.03 is back-edge CHAIN ROUTING, not the clip

- **Context**: 1644 (graph g {1--2;2--3;4--3;5--3;3--1}) structural-match maxΔ
  ~0.04. Only the `3--1` edge diverges — the lone multi-rank BACK edge (tail
  rank2 > head rank0); the 4 adjacent-rank edges byte-match. Nodes byte-match.
- **Disproven hypothesis (do NOT re-try)**: I suspected the back-edge path's
  custom clip (`reverseClipBackChain` → `bezierClipNode`/`nodeInsideFn`,
  edge-route-clip.ts) diverged from the faithful `clipAndInstall` (`bezierClip`,
  splines-geom.ts) used by forward edges. Refactored `routeBackEdge` to route
  fwd → reverse → `clipAndInstall`. Result: **byte-IDENTICAL** output
  (`M102.47,-35.85...`, still 0.03 off oracle `M102.48,-35.82`). The two clip
  stacks AGREE for this edge. Refactor reverted (no parity benefit, adds arrow
  risk on directed back edges).
- **Actual cause**: the pre-clip chain spline. faithfulBackFwdPoints (makefwdedge
  route) yields a straight line with endpoints `(54,161)→(109,19)` — node1 is
  (54,162), node3 (109,18), so endpoints sit 1px INSIDE the centers (correct:
  snapping to exact centers via a HACK made it WORSE, 102.26). Clipping that line
  against node3's ellipse gives 102.47; C gets 102.48. So C's pre-clip line
  endpoint/direction differs by a sub-0.5px amount (beginSeg / maximalBbox /
  appendRegularEnd / straightening), which the clip faithfully propagates to
  ~0.03 in the final bezier.
- **Verdict**: sub-pixel back-edge chain-routing fidelity, single graph, 0.03.
  Not worth chasing alone.
- **Confidence**: High — empirical (refactor byte-identical; center-snap hack
  worse) pins it to pre-clip routing, not clip.

## dfa family CONFIRMED same class (2026-06-28)

- dfa (graphs-dfa + share/windows/linux variants, ~0.33 maxΔ): 8 diverging edges,
  all the BACK direction of labeled 2-cycles (start->n1 forward byte-matches;
  n1->start diverges). The edge LABEL creates a vnode at an intermediate rank, so
  start(rank0)↔n1(rank2) span 3 ranks → n1->start is a MULTI-RANK back edge →
  `routeBackEdge` (SAME router as 1644). So dfa == 1644 class, larger magnitude.
- Pre-clip chain (n1->start): straight `(105,638.6)→(105,551.8)` in LAYOUT
  coords. Findings:
  - x=105 vs node cx 105.37 is a RED HERRING — a uniform graph offset (+0.37)
    applies to nodes AND edges at emit, so both render at 105.37. x is fine.
  - Node coord.y matches C exactly (start 639.6, n1 550.8). The chain straightens
    (smode) past the rank1 vnode (at x=120) to a direct vertical line — C does too
    (oracle n1->start is straight at 105.37).
  - Divergence is the terminal Y-inset: pre-clip endpoints are ±1 inside the node
    centers (638.6=639.6-1, 551.8=550.8+1). The coarse bezier_clip (0.5 tolerance,
    IDENTICAL in C splines.c:146 and port) then lands the boundary crossing
    0.15-0.41 BEYOND the geometric ellipse top, at a DIFFERENT point than C
    because C's pre-clip terminal y differs sub-pixel.
- **Root locus**: the ±1 inset / terminal y in beginSeg (appendRegularEnd with
  `coord.y - rankHt(...)`) / maximalBbox / the straightened-chain endpoint, fed
  into clip_and_install. Both clip stacks faithful; the INPUT spline differs.
- **BLOCKED on C ground truth**: to fix, need C's pre-clip spline for a back-edge
  chain (the exact terminal points routesplines feeds clip_and_install). Requires
  instrumenting native dot — rebuild gvplugin_dot_layout → /tmp/gvplugins and
  dump the pts in make_regular_edge before clip_and_install. See
  [[recover-slack-and-c-harness]]. Not a code-only fix; deferred.

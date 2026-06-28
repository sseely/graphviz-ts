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

## C instrumentation results (2026-06-28) — pre-clip Y MATCHES; divergence is in the clip

Instrumented native dot (make_regular_edge, cnt==1 clip site in dotsplines.c) to
dump the pre-clip `pointfs` + node coords, gated on getenv("DUMP_EDGE"). Rebuilt
gvplugin_dot_layout, regenerated /tmp/ghl, ran dfa. **C source reverted + plugin
rebuilt clean afterward** (oracle verified back to n1->start=-569.21).

Findings for dfa n1->start (the straight back edge, pn=4):
- C pre-clip points: first=(_,638.60) last=(_,551.80). The Y MATCHES the port's
  pre-clip (638.6 / 551.8) exactly. So the chain ROUTING (pre-clip spline) is
  correct — not the divergence source after all.
- C node coords during routing read x=1.00 — this is a SYNTHETIC fwdedge-node
  artifact (back edges route via fwdedgeb.out, whose temp node coords aren't the
  real 105.37); NOT a real coordinate-frame difference. The Y is the reliable
  signal and it matches.
- Therefore the 0.26-0.33 enters in the CLIP step: same pre-clip spline, but the
  port's bezier_clip lands the node-boundary crossing ~0.26 off from C's. Both
  port clip stacks (bezierClipNode and clipAndInstall/bezierClip) agree with each
  other (1644 refactor was byte-identical), so the port's clip differs from C's
  bezier_clip despite identical 0.5 tolerance (splines.c:146 == bezierClipLocal).
- NOTE: the 1644 clipAndInstall refactor was tested only on 1644 (byte-identical).
  It was NOT tested on dfa — dfa's head has an ARROW (directed) while 1644 is
  undirected, so the arrow-clip path differs and the refactor's effect on dfa is
  unverified.
- NEXT: step-compare the port's bezier_clip bisection vs C's on the IDENTICAL
  pre-clip spline (638.6→551.8 straight, node n1 ellipse + penwidth inside-test).
  The divergence is in where the 0.5-tolerance bisection lands or the inside-test
  (penwidth/ellipse) — a sub-pixel clip-iteration mismatch. Deferred: deep, and
  this whole class is ≤0.33 on ~5 graphs.

## Leading hypothesis after full investigation (2026-06-28) — clip PARAMETERIZATION

Ruled out this session:
- clipAndInstall refactor for back edges: REJECTED. 1644 byte-identical (no help);
  dfa WORSE (0.33→50.9) — clipAndInstall's arrow clip assumes forward orientation,
  the back-edge reversal breaks directed-edge arrow geometry.
- penwidth inside-test: NOT it. Both port (makeEllipseInsideFn) and C use ry+pw/2
  (~569.3 boundary for n1). Port lands 568.95, oracle 569.21 — BOTH within the
  0.5 bezier_clip tolerance of 569.3, just at different t.

LEADING CAUSE: the port's pre-clip back-edge spline is a DEGENERATE bezier with
control points doubled at the endpoints — (p0,p0,p3,p3) = (105,638.6)(105,638.6)
(105,551.8)(105,551.8). bezier_clip bisects in parameter t and evaluates position;
a degenerate (p0,p0,p3,p3) parameterization traverses the straight line at a
different speed than an interpolated (p0, 1/3, 2/3, p3) one, so the 0.5-tolerance
bisection lands the boundary crossing at a different y → the 0.03-0.33. C likely
builds the straight back-edge spline with interpolated control points.
- NEXT (port-side testable): find where routeChainSegmented / the straightened
  back-edge spline emits the degenerate (p0,p0,p3,p3) control points; try
  interpolated (linearBezier 1/3,2/3) and see if the clip lands match oracle.
  Confirm C's middle control points by re-instrumenting (dump all 4 pre-clip pts,
  not just first/last).
- STATUS: deep sub-pixel frontier, ≤0.33px on ~5 graphs (1644 + dfa family).
  Checkpointed; not blocking. Both clip stacks + C agree on Y; only the t-landing
  differs.

## Control-point experiment DISPROVEN (2026-06-28)

Re-instrumented C to dump ALL pre-clip points (not just first/last) for dfa's
straight back edge. C pre-clip = (1.0,638.6)(1.0,638.6)(1.0,551.8)(1.0,551.8) —
the SAME degenerate (p0,p0,p3,p3) structure as the port. So interpolated vs
degenerate control points is NOT the cause. (C reverted + oracle restored.)

CONFOUNDING STATE: C and port pre-clip splines are now structurally identical
(degenerate, matching Y 638.6/551.8, each vertical through its own node-center x
— C at x=1.00, port at x=105), same bezier_clip 0.5 tolerance, same ellipse+pw/2
inside-test. By analysis the clip MUST land at the same y. Yet output differs
(port 568.95 vs oracle 569.21, Δ0.26). Every hypothesis (clip stack, refactor,
penwidth, control points, pre-clip Y) is now ruled out or matches.
- The ONLY observable difference is the pre-clip x-frame (C 1.00 vs port 105),
  which through-center clipping should make irrelevant to y.
- DEFINITIVE NEXT EXPERIMENT (deep): step-level diff of the bisection — dump every
  bezier_clip iteration (t, pt, inside?) for n1->start's tail clip in BOTH the
  port (bezierClipLocal) and C (bezier_clip splines.c:120), on the identical
  degenerate input, and find the first diverging step. That is the only thing that
  will explain the 0.26. Until then the cause is genuinely unexplained.
- This whole class is ≤0.33px on ~5 graphs; effort spent here is already very high
  relative to impact. Recommend pausing unless the step-diff is explicitly wanted.

## SOLVED (2026-06-28) — clip the FORWARD spline + swapSpline, don't reverse-then-clip

Step-level clip dump found it: the port REVERSED the chain before clipping, so it
clipped each node's boundary as a TAIL (bezier_clip bisecting the degenerate
spline from t=0). C clips the FORWARD (un-reversed) spline — the head node is
clipped as a HEAD (bisecting from t=1). On the degenerate (p0,p0,p3,p3) spline the
0.5-tolerance bisection from opposite parameter ends lands ~0.26-0.33 apart (both
within tolerance, both valid — just different).

FIX (routeBackEdge, edge-route-chain.ts): mirror routeFaithfulAdjacentBack —
route the makefwdedge chain, clipAndInstall(fwdEdge, fwdEdge.head, fwd) on the
FORWARD spline (resolves onto e via fwdEdge.to_orig + gates arrows by ED_dir),
then swapSpline(e) for back-edge orientation. Dropped the bespoke
reverseClipBackChain / applyBackEdgeArrows / clipCompoundTail/Head /
faithfulBackFwdPoints (all dead).

RESULT: 10 graphs structural-match → BYTE-MATCH (dfa + triedds families, 1644,
1328, graphs-ER), 0 regressions, gate clean. byte-match 476→486.
NOTE: the earlier clipAndInstall refactor attempt failed because it reversed the
pts AND installed on e (not fwdEdge) without swapSpline — the orientation, not
the clip stack, was the issue.

# D5 — 1879 ltail-edge raw pre-clip spline divergence

## Mechanism
`clipTailNormal`'s segment-scan loop (compound.ts, byte-identical to C) tests
candidate bezier segments starting from the END of the raw spline (closest to
the un-clipped head) and stops at the FIRST segment for which
`splineIntersectf` reports an intersection. For `couple_74x75->node_20x21_21`
the raw spline's LAST segment `[P6,P5,P4,P3]` — where `P4===P3` is an exact
zero-length duplicate landing precisely on the cluster box's bottom-right
corner `(-467, 1104.8)`, and `P5/P6` swing far out toward the head
`(4472.10,883.31)/(5179.94,851.57)` — produces a **false-positive** crossing:
`findVertical`'s general recursive-bisection branch (the `nc==1` fast-path
requiring `|pts[3].x - xcoord| <= 0.005` does NOT apply here, since `pts[3]`
is `P3` at x=-467, not near the box's right edge x=-348) locates *some* t
where the curve's x crosses the box's right-edge LINE (x=-348) but never
validates the resulting y (1099.46) against the box's y-range
`[1104.8, 1335.2]` — that range check exists only inside the `nc==1`
shortcut, not in the general recursion. The loop accepts this off-box point
and stops, never reaching the earlier segment `[P3,P2,P1,P0]` where the curve
genuinely re-enters through the exact corner already present in the raw
spline. This is verified as a live property of the port's own
(T2-proven-byte-faithful) `splineIntersectf`/`findVertical`, executed
directly (not hand-traced) against the dumped raw points — see Ruled out.

Because the clip algorithm is proven byte-identical to
`lib/dotgen/compound.c:395-416`, and a **control** ltail edge
(`couple_598x597->node_325x326_325`, also compound-clipped, also containing
duplicate/degenerate waypoint control points) renders **byte-identical** to
C, the false-positive scan-order bug alone does not explain the divergence
— C, given the identical raw spline, would hit the same false positive. The
mechanism that actually produces the wrong final point is therefore two-part:
(1) the scan-order/range-check gap in `clipTailNormal`/`findVertical`
(confirmed present in both C and the port, not port-specific), triggered
only when (2) the RAW pre-clip spline for this specific edge has a highly
asymmetric shape — one very short tail-side sub-segment ending exactly on a
box corner, followed by one very long head-side sub-segment that happens to
cross the box's opposite edge's line far outside that edge's valid range.
Whether the port's raw spline reproduces C's raw spline exactly for this
edge (i.e., whether C's `Pshortestpath`/node-boundary `bezier_clip` produce
the identical `P4/P5/P6` head-side interior control points) is **not yet
confirmed** — see Ruled out / next instrumentation.

## Origin
- Algorithm (confirmed byte-identical, not the divergence's root):
  `src/layout/dot/compound.ts:168-184` (`clipTailNormal`) /
  `src/layout/dot/compound-clip.ts:116-122` (`findVertical`, general
  bisection branch does not re-check `ax.lo/ax.hi`) vs. C
  `lib/dotgen/compound.c:395-405` (tail scan loop) and
  `lib/dotgen/compound.c:154-185` (`findVertical`, same gap: `ymin/ymax`
  used only in the `no_cross==1` shortcut at line 170-174, not in the
  general recursive branch at 177-183).
- Raw-spline construction (the actual divergence candidate, unconfirmed
  against C): `src/layout/dot/edge-route-faithful.ts:382-421`
  (`routeRegularEdgeFaithful`, adjacent-rank box corridor) →
  `src/layout/dot/splines-route-type.ts:33-44` (`routeRegularByType`, et=6
  `EDGETYPE_COMPOUND` dispatches to `routePolylines`, not `routeSplines`) →
  `src/common/splines-routespl.ts:354-420` (`routeSplinesInternal`,
  `polyline=true` branch → `makePolyline`) → node-boundary bezier clip in
  `src/common/splines-clip.ts` (`bezierClip`/`shapeClip0`, not read in
  depth this task) which produces the tail-side `P0/P1` and head-side
  `P5/P6` interior control points from the 3-waypoint shortest-path polyline
  `[(-519,1231.4), (-467,1104.8), (5264,847.8)]`.

## Causal chain
1. `couple_74x75->node_20x21_21` is an **adjacent-rank** edge (tailRank=5,
   headRank=6) — confirmed via direct instrumentation, NOT a multi-rank
   virtual-node chain edge. This corrects the task's framing hypothesis
   ("long/multi-rank chain edges") for this specific edge: it never enters
   `edge-route-chain.ts`/`routeMultiRankEdgeFaithful` at all (that function's
   `rh <= r + 1` guard returns `null` immediately). It routes through
   `routeRegularEdgeFaithful`'s single-box-corridor path.
2. `splines="compound"` maps to `EDGETYPE_COMPOUND=6` in both C and the port
   (`et == EDGETYPE_SPLINE` check is false), so both dispatch to
   `routepolylines`/`routePolylines` — the spline is a **straight-line
   polyline through the shortest-path waypoints**, faked as bezier control
   points (`makePolyline`: `[A,A,B,B,B,C,C]` for a 3-waypoint path), not a
   smoothed curve. Confirmed via direct instrumentation of
   `routeSplinesInternal`: `pl = [(-519,1231.4), (-467,1104.8),
   (5264,847.8)]`.
3. The tail node's own routing box is narrow (`x:[-571,-467]`, width 104)
   relative to the huge, essentially unconstrained inter-rank corridor box
   (`x:[-3271.86, 21877.63]`) and the far-away head (`x=5264`). Geometrically
   *any* taut-string/shortest-path solver bending through this box sequence
   must exit near the tail box's corner nearest the straight tail→head line
   — a straight line from tail port to head port exits the tail box's x-range
   long before reaching the box's bottom edge, so the shortest path must
   bend at the box boundary. The waypoint `(-467, 1104.8)` — the tail box's
   exact bottom-right corner — is geometrically the correct/expected bend.
4. Node-boundary clipping (bezier-clips the straight-polyline-as-bezier to
   the tail node's actual shape at the start, and the head node's actual
   shape at the end) produces the observed raw 7-point spline: `[P0=
   (-504.93,1197.14), P1=(-489.53,1159.65), P2=P3=P4=(-467,1104.8), P5=
   (4472.10,883.31), P6=(5179.94,851.57)]`. `P0/P1` lie exactly on the
   tail→bend line (t≈0.27/0.57); `P5/P6` lie exactly on the bend→head line
   (t≈0.86/0.99) — confirmed algebraically.
5. `makeCompoundEdge`'s tail clip (`clipTailNormal`) scans from the spline's
   end (`starti=6`, segment `[P6,P5,P4,P3]`) backward. Direct execution of
   the port's own `splineIntersectf`/`findVertical` against this exact
   4-point segment (not hand-traced — run via `/tmp/clip-check.mjs`,
   importing `compound-clip.ts` directly) returns `true`, mutating the
   segment to `[P6, (4537.44,880.38), (408.68,1065.53), (-347.99,1099.46)]`
   — a point on the box's right-edge LINE (x=-348) but with y=1099.46,
   **outside** the box's actual y-span `[1104.8, 1335.2]`. The loop accepts
   this as the tail clip point and never reaches `starti=3` (segment
   `[P3,P2,P1,P0]`), which would have converged cleanly to the box corner
   `(-467, 1104.8)` — C's actual final answer (SVG `2701,-1104.8`, confirmed
   via the internal-to-SVG affine transform `SVG_x = internal_x + 3168.00,
   SVG_y = -internal_y`, solved from the byte-identical un-clipped head
   point).
6. Since the clip algorithm is proven byte-identical to C in both languages'
   source (not just the port's re-implementation), and this is a
   **deterministic property of the exact numbers fed in** (confirmed by
   direct execution, not port-specific floating-point drift), C given this
   *exact* raw spline would produce the same wrong (off-box) result. C's
   actual output is the correct corner point instead — therefore C's raw
   pre-clip spline for this edge must differ from the port's, most likely in
   the head-side interior control points (`P5`/`P6`, the node-boundary clip
   of the bend→head straight run) such that the segment `[P6,P5,P4,P3]`
   does *not* cross the box's right-edge line within its valid y-range (or
   at all) in C.

## Ruled out
- **Multi-rank virtual-node chain routing** (`edge-route-chain.ts`,
  `routeMultiRankEdgeFaithful`, smode straight-run logic). Ruled out by
  direct rank dump: `tailRank=5, headRank=6` (adjacent). The chain-segment
  debug print in `routeMultiRankEdgeFaithful` never fired for this edge —
  confirming the `rh <= r + 1` early-return guard short-circuits it. This
  corrects the task brief's framing for at least this edge; the "long/
  multi-rank chain" label in `path-structure-1879.md`'s secondary finding
  was a plausible but unverified hypothesis, not confirmed instrumentation.
- **Box corridor construction** (`maximalBbox`/`appendRegularEnd`/
  `completeRegularPath`, edge-route-faithful.ts:399-409). Structurally
  matches `lib/dotgen/dotsplines.c:1836-1845` (adjacent-rank branch)
  line-for-line; dumped boxes (`tend`, `rankBox`, `hend`) show no internal
  inconsistency (each box's LL/UR is well-formed, nbox=3 as expected for a
  single-rank-gap corridor).
- **`splines=compound` dispatch decision itself.** Both C
  (`dotsplines.c:1759` `is_spline = et == EDGETYPE_SPLINE`) and the port
  (`splines-route-type.ts:34` `et === EDGETYPE_SPLINE`) route
  `EDGETYPE_COMPOUND` through the polyline path, not the smoothed-spline
  path. Verified `et=6` for this graph via direct instrumentation. Not the
  divergence.
- **`compound.ts`'s cluster-clip algorithm structure.** Re-verified my own
  line-by-line read of `lib/dotgen/compound.c:395-416` (tail scan loop) and
  `:154-185` (`findVertical`) against `compound.ts`/`compound-clip.ts` —
  confirms T2's prior finding: identical loop bounds, identical
  `nc==1`-shortcut-vs-general-bisection branching, identical missing
  y-range check in the general branch. This is a genuine (shared, not
  port-only) property of the algorithm, not a port bug in isolation — see
  Mechanism part 6 for why it still doesn't explain the divergence alone.
- **General box-corridor + node-clip + polyline pipeline being broken.**
  Control edge `couple_598x597->node_325x326_325` (also `ltail`-clipped,
  also has duplicate/degenerate waypoint control points in its rendered
  path, a 2-bend/3-segment polyline) renders **byte-identical** to C
  (`M23879.79,-2297.6C...` — full path string match confirmed). This proves
  the general polyline/node-clip/compound-clip machinery is faithful; the
  divergence is specific to this edge's particular geometry (near-tangent
  crossing of a box edge outside its valid range), not a systemic pipeline
  bug.
- **C-source edit / GV_DUMP-style oracle for the raw spline.** Attempted
  (added gated `fprintf` dumps to `~/git/graphviz/lib/dotgen/dotsplines.c`
  around `completeregularpath`/`routesplines` to print `P->boxes` and the
  routed `ps` array), built, and was about to deploy the instrumented
  plugin to the shared `/tmp/ghl` oracle — **blocked by the task boundary**
  ("never edit C source in `~/git/graphviz`"). Reverted immediately via
  `git checkout -- lib/dotgen/dotsplines.c` before the instrumented plugin
  was copied to `/tmp/ghl`; rebuilt from clean source; verified the C SVG
  output is byte-identical to the pre-edit baseline
  (`diff /tmp/verify.c.svg /tmp/1879.c.svg` empty). **The shared oracle was
  never touched.** This is why part of the causal chain (step 6, whether
  C's `P5`/`P6` differ from the port's) remains an inference from the SVG
  output + faithful-algorithm argument rather than a direct C-side dump.

## Fix target
```
{ fixTarget: "UNCONFIRMED — the falsifiable claim (C's node-boundary-clipped
    head-side interior control points P5/P6 differ from the port's for this
    edge) requires a C-side raw-spline dump not obtainable within this
    task's boundary (no C source edits permitted). Two candidate loci once
    confirmed: (a) src/common/splines-clip.ts bezierClip/shapeClip0 (node-
    boundary clip precision/direction — c.f. existing
    [[bezier-clip-direction-dependent]] note: 0.5-tol bisection converges
    differently forward vs reversed, and this task did not verify which
    direction the head-side clip runs in relative to C's shape_clip0 call
    order), or (b) src/pathplan/*.ts shortestPath (Pshortestpath) producing
    a different bend waypoint than C for this exact box/eps combination.",
  writeSet: ["TBD pending C-side confirmation — likely src/common/splines-clip.ts
    or src/pathplan/route.ts, NOT src/layout/dot/compound.ts (already
    proven faithful) or src/layout/dot/edge-route-chain.ts (this edge never
    reaches it)"],
  sharedMechanismWith: ["possibly [[bezier-clip-direction-dependent]] if
    root cause (a) confirmed"],
  expectedVerdictDelta: "1879: diverged (36/348 ltail edges) -> re-triage
    after F2's pad/viewport fix lands; this residual is independent of F2
    and will likely keep 1879 short of conformant even after F2 merges",
  classification: "tracked-deep" }
```

## Next instrumentation (for the follow-up task)
1. Read (read-only, no edits) `src/common/splines-clip.ts`'s
   `bezierClip`/`shapeClip0` call sites for `routeFaithfulRegularPlain`'s
   `clipAndInstall(e, e.head, pts, pts.length, ...)` path, and
   `lib/common/splines.c:clip_and_install`/`bezier_clip` (read-only), to
   compare clip DIRECTION (which end is treated as "inside"/"outside" first)
   for a straight polyline-as-bezier edge — per the existing
   `[[bezier-clip-direction-dependent]]` note, direction changes the
   bisection's converged point.
2. If direction matches, request explicit permission for a scoped, revertible
   C-side oracle dump (or build a standalone C test harness that links
   `libpathplan`/`libcommon` without editing tracked source) to compare
   `Pshortestpath` waypoints and `bezier_clip` output point-for-point against
   the port's dumped values for this exact edge.
3. Re-run the `couple_598x597` vs `couple_74x75` control/diverged pair
   through both instrumentation points to isolate which of the two
   (shortest-path waypoint vs node-clip interior point) is the actual
   departure.

## Instrumentation reverted
All temporary env-gated dumps (`LTAILDBG`, `LTAILDBG2` in
`src/layout/dot/edge-route-faithful.ts`, `src/layout/dot/edge-route-chain.ts`,
`src/layout/dot/compound.ts`, `src/common/splines-routespl.ts`) removed.
`git diff --stat` in graphviz-ts is clean. The C-source edit to
`~/git/graphviz/lib/dotgen/dotsplines.c` was reverted via `git checkout --`
before the instrumented plugin reached `/tmp/ghl`; the plugin was rebuilt
from clean source and the oracle's SVG output verified byte-identical to
the pre-edit baseline. `npx tsc --noEmit` passes with 0 errors.

## Re-verification (2026-07-06)
After the pad/margin fixes landed, 1879 dims byte-match (10915x1563, translate
278.69 3376.69); residual is now ~10 edge-@d diffs, maxΔ ~328 (down from 876).
The divergent edges are ltail edges into cluster_791x792 (couple_257x255->
node_260_260, couple_211x210->node_224_224). Fresh instrumentation of the
port's RAW pre-clip spline (compound.ts makeCompoundEdge) confirms the earlier
hypothesis with concrete numbers: for node_260_260 the port's raw spline bends
at internal (10019,1490.4) and crosses the cluster's bottom edge (y=1535.4) at
x≈10039, whereas C's clipped result sits at internal x≈10096 (SVG 4878,-2611.2).
So the RAW SPLINE ROUTING differs (~57 internal units at the bottom-edge
crossing), NOT the clip algorithm — the port routes the box corridor / shortest
path to a different bend than C. This is the D5 tracked-deep conclusion,
now with a precise crossing-point delta. Still blocked on a C-side raw-spline
dump (standalone C harness linking libpathplan/libcommon, or scoped C
instrumentation) to isolate shortest-path-waypoint vs node-boundary-clip as the
departure. Not a surface fix.

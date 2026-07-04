# pgram PP->OCT residual = flat-spline frame-mapping 0.35px (documented, not chased)

## Observation: pgram's last residual is a single flat-edge sub-pixel delta
- **Context**: after the flat-edge minlen-trunc x-NS fix (merged), pgram's NODES
  all match C; the only remaining divergence is the `PP->OCT` flat edge, ~0.32–0.35px.
  pgram stays structural-match on this alone.
- **Geometry**: uniform shift — x matches exactly (122.85), every Bézier y-control
  point shifts by exactly 0.35 (C `-134.51…-128.54`, port `-134.86…-128.89`).
- **Ruled out (each verified):**
  - NOT x-coord NS — fixed separately (flat-edge minlen trunc); all nodes match.
  - NOT adjacency — `checkFlatAdjacent` marks PP->OCT `adjacent=1` via the
    `hi-lo<=1` shortcut (lo=0,hi=1), correctly (matches C).
  - NOT `repositionFlatAux`/`midx` — PP->OCT is adjacent+no-port, so it routes via
    `makeAdjFlatNoPortEdge`→`makeSimpleFlat`, NOT the recursive `makeFlatAdjEdges`
    (FLATDBG never fired). And C's `midx` is `double` (dotsplines.c:1131), not a
    truncation bug anyway.
  - NOT a fractional endpoint — `makeSimpleFlat` for PP->OCT uses INTEGER within-rank
    values: `pts=(0)(18)(36)(54)`, `rw=lw=18`, ports 0. `coord.y=122.851` is
    fractional but maps to the SVG-x that MATCHES C.
- **PINNED (C+port instrumented, 2026-06-29 follow-up): `clip_and_install`
  line-vs-shape intersection.**
  - Dispatch matches C: C's `make_flat_adj_edges` no-port+no-label branch calls
    `makeSimpleFlat` (dotsplines.c:1156-1165) — exactly like the port. NOT the
    recursive aux pipeline.
  - C's `makeSimpleFlat` (dotsplines.c:1075) is conformant to the port's: same
    `tp/hp = coord + port`, `dy`, points `tp,(2tp.x+hp.x)/3@dy,(2hp.x+tp.x)/3@dy,hp`,
    `clip_and_install`. The UNCLIPPED spline is IDENTICAL in both:
    `(0,122.851)(18,122.851)(36,122.851)(54,122.851)`.
  - The divergence is entirely in `clip_and_install`: the port's stored clipped
    spline is `x: 35.86→29.89`, C's `x: 35.51→29.54` — a UNIFORM 0.35 shift. The
    spline is clipped against OCT (octagon); the line y=122.851 crosses OCT's left
    boundary at x=35.86 (port) vs 35.51 (C) (the geometric leftmost is 36). The
    node polygons are identical, so it is the bezier/line–polygon INTERSECTION
    routine in clip_and_install that differs, not the boundary or the inputs.
- **Decision**: DOCUMENTED, not chased. The remaining delta is a 0.35px difference
  in the shared bezier-clip intersection geometry (a known-fragile residual class —
  cf. bbox control-hull-vs-curve, 2368 hypot tie-break). Fixing it means surgery on
  the shared clip routine used by EVERY edge — high regression risk for a 0.35px
  single-edge delta on a structural-match graph. Per AD-5 / conformant-is-the-bar,
  tracked residual. Next step if ever pursued: instrument C `clip_and_install` /
  `shape_clip` bezier-split tolerance vs the port's `splines-clip.ts` for the OCT
  octagon intersection.

## Latent finding (separate, NOT applied — no validated case)
`hasInterveningNode` (flat.ts:198) returns true for ANY between-node, but C's
`checkFlatAdjacent` (flat.c:211) only blocks adjacency on NORMAL or LABELED-virtual
nodes (an unlabeled virtual does NOT block). This is a genuine C-faithfulness gap,
but it does NOT affect PP->OCT (which takes the `hi-lo<=1` shortcut), and no failing
corpus case was found, so it was NOT changed (would risk regressions without
evidence). Fix if a future graph is pinned to it: add a node-type check
(`NORMAL || (VIRTUAL && label)`).
- **Confidence**: High (all alternatives instrumented and ruled out).

---

## RESOLVED (merged 7fa9236) — root-caused, NOT documented-and-left

The "decision: documented, not chased" above was OVERTURNED on the user's
insistence to root-cause all the way down. Paired C+port instrumentation of every
clip stage (clip_and_install tailclip/headclip/arrowclip; makeSimpleFlat ED_spl)
pinned it: **bezier_clip's 0.5-pt-tolerance binary search is DIRECTION-dependent.**
The port's installFlatLeg pre-reversed the flat-edge points before clipping,
searching the curve opposite to C → ~0.35px shift on both endpoints. Fix = clip
FORWARD then swapSpline (the back-edge pattern). Clip now bit-identical to C's
ED_spl. conformant 505→519: 14 adjacent-flat graphs structural→byte. See memory
[[bezier-clip-direction-dependent]].

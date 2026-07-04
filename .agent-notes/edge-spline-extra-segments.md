# Investigation: long-edge splines get extra bezier pieces

## Observation: port subdivides long-edge splines more than C
- **Context**: After the font-aware vmetrics fix, rankdir_dot* nodes/text/labels
  byte-match the oracle; only edges (`<path>`) + arrowheads (`<polygon>`) differ.
- **Finding**: On rankdir_dot, 46/49 edge paths match exactly (median coord
  delta 0.0). The divergence is concentrated in **3 long edges** where the port
  emits **one extra cubic bezier segment**:
  - path 10: oracle 2 cubics (14 coords) vs port 3 cubics (20)
  - path 17: oracle 1 cubic (8) vs port 2 cubics (14)
  - path 21: oracle 2 cubics vs port 3
  C fits a single smooth bezier through the corridor; the port splits into more.
- **Impact**: This is the remaining `path/@d` divergence keeping rankdir_dot*
  (and ~49 Helvetica rows) diverged; maxDelta ~40-68 comes from the misaligned
  extra segment. Also the 2193 structural re-bucketing (point-count mismatch).
- **Confidence**: High.

## Observation: the recursive fitter (route.ts) is faithfully ported
- **Context**: C's `reallyroutespline` (pathplan/route.c:97) fits one bezier via
  `mkspline`, tests `splinefits`→`splineisinside` (handle length `a` from 4,
  halving to <0.005), and only splits at the max-deviation point if the fit
  fails the box corridor.
- **Finding**: `src/pathplan/route.ts` matches C's constants and structure
  exactly: `EPSILON1=1e-3`, `a=4`, `a<0.005`, `forceflag=(inpn==2)`, the
  `distN(sps)<distN(inps)-EPSILON1` shortcut guard. The fitter is NOT the bug.
- **Impact**: The extra-segment cause is UPSTREAM — the box corridor (barriers)
  or the input-point chain / endpoint slopes passed to `Proutespline`. Built in
  the dotsplines routing port (`src/common/splines-routespl.ts` + the dot
  edge-route chain). Node positions match the oracle, so the box GEOMETRY should
  match unless box construction for long-edge corridors diverges.
- **Confidence**: High (constant-level code comparison).

## Minimal reproducer
- `/tmp/le_long.gv`: `rankdir=LR`, chain n0..n15 with long spanning edges
  (n0->n15, n0->n12, n2->n14, n1->n13) + skip edges. Path 23 diverges:
  oracle 1 cubic (8 coords) vs port 2 cubics (14). Small 6-node LR chains do
  NOT reproduce — needs a long corridor over many ranks.

## Next steps (for the mission)
1. Instrument the port to dump the `Proutespline` inputs (barriers/box corridor,
   input points, endpoint slopes) for the diverging edge in the reproducer.
2. Instrument C's routesplines (rebuild gvplugin_dot_layout → /tmp/gvplugins per
   the v8-prof/oracle recipe) to dump the same, and diff.
3. Localize: box corridor geometry vs input-point chain vs endpoint slopes.
4. Fix the upstream divergence in splines-routespl.ts / edge-route chain; verify
   the reproducer + rankdir_dot* edges byte-match; survey for 0 regressions.

## CORRECTION (2026-06-23, mission edge-spline-routing) — root cause was ROUTING ORDER
- **Context**: S1 spike instrumented C `routesplines_`/`recover_slack` + the port.
- **Finding**: The premise above is partly stale. (1) The port UNDER-segments
  (emits FEWER cubics), not more, on the reproducer (`n12->n14`: port 1 / oracle
  2). (2) The corridor/fitter is faithful; the divergence was **edge routing
  ORDER**. C `dot_splines_` routes a rank-major list `edgecmp`-sorted (type desc,
  rank-span asc, |Δx| asc, AGSEQ asc); the port used `g.nodes.values()` order.
  Because `recover_slack` re-centres SHARED virtual nodes that other edges read
  as `maximal_bbox` neighbours, corridor geometry is order-dependent.
- **Fix (T2, merged 465b24a)**: `src/layout/dot/edge-order.ts` `edgeRouteCmp` +
  `routeDotEdges` reorder. byte-match 280→281, structural 236→274; verified the
  port routing order is byte-identical to C.
- **Residual (deferred D3)**: with order now correct, a long-edge piece-count
  divergence remains (e.g. `graphs/p3` `sleep--runmem`: port 3 cubics / oracle 4,
  maxDelta 0.48; same class on `*-rankdir_dot`/`dot2`). This is the brief's true
  target, minus the order confound. See
  `plans/edge-spline-routing/comparisons/graphs-p3-residual.md`.
- **Confidence**: High (instrumented C, order diffed byte-for-byte).

## RESOLVED (2026-06-23, mission long-edge-undersegment) — non-integer routing frame
- **Context**: S1 spike re-instrumented C `routesplines_`/`maximal_bbox` + the
  port for p3 `sleep--runmem` (port 3 / oracle 4).
- **Finding**: NOT box-corridor geometry, NOT smode segmentation, NOT the fitter
  (all faithful). `.probes/isolate.mjs` proved port's `Pshortestpath` pl → 3
  pieces and C's pl → 4 regardless of poly — so the pl is the lever. The two pls
  are identical modulo a frame translation of +138.36728; the bend points sit on
  box right-walls that `maximal_bbox`'s `round(b)` rounds differently because the
  port routes in a frame offset from C's integer frame by a NON-INTEGER amount.
  Origin: `normalizeXcoords` (position.ts) shifted node x by
  `minNormalLeftX = coord.x − lw`; `lw` is non-integer → fractional offset on
  every node. C does not normalize here.
- **Fix**: `shiftAllXcoords(g, Math.round(minX))` — round the delta to keep the
  routing frame integer (C's invariant); the fraction washes out in the
  postprocess translate, so final node positions are unchanged.
- **Result**: graphs-p3 diverged → byte-match; survey byte-match 282→297, 0
  regressions, 18 improvements (pm2way/process/b36/awilliams families); vitest
  2320 green.
- **Residual**: `*-rankdir_dot`/`dot2` (LR) are a SEPARATE class — the x-axis fix
  does not resolve them (rotation/other-axis frame); nodes byte-match so it is
  NOT the label-height layout residual. Documented in
  `plans/long-edge-undersegment/comparisons/rankdir-classification.md`, not chased.
- **Confidence**: High (instrumented C + port; end-to-end byte-match; 0 regr).

## SUPERSEDED (mission fix-xns-absolute-anchor) — normalizeXcoords REMOVED
- **Context**: x-NS absolute-anchor mission, Batch 0 trace (test/diagnostic/
  xns-trace.md). Instrumented C set_xcoords vs the port for 2368_1.
- **Finding**: the port's x-NS frame at set_xcoords is BYTE-IDENTICAL to C
  (virtual −38/66, 376=−119, 196=−29, 256=43, 316=115, 76=205). The raw
  pre-normalize frame is already C's exact INTEGER frame. The non-integer
  routing-frame offset this note's prior "RESOLVED" entry attributed to
  normalizeXcoords was self-inflicted: normalizeXcoords' own (lw-based,
  later-rounded) shift was the only thing displacing the frame. With the x-NS
  now bit-exact, normalizeXcoords is pure deviation — C has no normalize step
  for balance=2 (LR_balance skips scan_and_normalize).
- **Action**: removed normalizeXcoords + dead minNormalLeftX/shiftAllXcoords
  from position.ts. The full XNS_NONORM survey (normalize disabled) is
  GATE PASS, 0 regressions — the 18 graphs this note credited normalize with
  fixing (p3/pm2way/process/b36/awilliams) stay byte-match WITHOUT it
  (spot-verified p3.gv geometry byte-match vs oracle). Removing it also aligns
  the internal frame so degenerate spline-less edge labels land in C's frame
  (the mission's actual objective).
- **Confidence**: High (instrumented C end-to-end; 0-regression survey).

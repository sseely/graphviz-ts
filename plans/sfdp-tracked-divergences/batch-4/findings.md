# Batch 4 findings — B4 ratio=fill aspect-scaling

## Verdict: ALL 4 ids = ONE fixable bug (scale math is faithful; a downstream bb
recompute discards the scaled box). Not amplified-drift.

Diagnosed via the injection harness driving the REAL exported
`neatoSetAspectRatio`/`aspectFactors` on native-injected positions + native node
sizes: the port reproduces native's fill factors and pre-scale bb to full
precision. So `src/layout/neato/set-aspect.ts` is faithful.

## Mechanism (per diagnosis.md)
- **Origin:** `src/layout/sfdp/index.ts:161` — `postprocess()` does
  `g.info.bb = computeSubgraphBB(g, 0, singleComponent)`, an unconditional
  geometric recompute (node-box ∪ edge-curve union), AFTER `splineEdgesShifted`
  → `neatoSetAspectRatio` already set `g.info.bb` to the correct fill-scaled
  target box (which edge routing then only expands).
- **Causal chain:** ratio=fill scales node POSITIONS by the fill factor but (correctly,
  matching C) does NOT scale node half-sizes. `scaleBB` sets the graph box to
  `pre_bb × factor`, whose stretched-axis span = `pos_span·f + node_size·f`. The
  geometric recompute instead yields `pos_span·f + node_size` (half-sizes
  unscaled), i.e. SHORTER by `node_size·(f−1)`. Measured: graphs-trapeziumlr
  −15.86pt (predicted `sy·(yf−1)=36·0.4408≈15.87`); share −17.87; windows −17.86;
  1855 −32.21 (on the X axis — 1855 stretches X, and its Y axis is exact,
  independently corroborating that only the *scaled* axis shrinks).
- **Spec:** `lib/common/postproc.c:599 gv_postprocess` NEVER recomputes `GD_bb`
  — it only reads/mutates the existing box for label padding + translation. The
  port's own comment `src/layout/neato/splines.ts:1000-1003` states the box is
  only ever EXPANDED (clip_and_install), never recomputed-and-shrunk. The
  line-161 overwrite violates that invariant.
- **Ruled out:** scale factor divergence (port xf/yf == native to full precision
  for all 4); ROUND-on-size (1855 `size` resolves to {724,441} identically via
  both parse paths; not contributing); pre-scale bb divergence (identical —
  node sizes byte-identical, positions injected identically); pre-scale drift
  (positions injected exact).

## Per-id (all same mechanism/origin/fix)
- graphs-trapeziumlr: xf/yf=1.0/1.440760 (==native); recompute short −15.86 on Y.
- share-trapeziumlr:  xf/yf=1.0/1.357126 (==native); short −17.87 on Y.
- windows-trapeziumlr: xf/yf=1.0/1.356958 (==native); short −17.86 on Y.
- 1855: xf/yf=1.596513/1.0 (==native); short −32.21 on X (Y axis exact).

## Fix (T4.2) — proposed
At `src/layout/sfdp/index.ts:161`, do not let the recompute SHRINK the box below
the routing/scale box: union the recompute with the existing (scaled+curve)
`g.info.bb` instead of overwriting — componentwise `min(ll)`, `max(ur)` —
mirroring C's grow-only invariant. Frame-alignment caveat: line 160 shifts by
the geometric `bb.ll`; the pre-existing `g.info.bb` is shifted by the same
delta via `shiftGraphBBs`, so both boxes are co-framed at line 161 — but VERIFY
the union does not push `ll` negative (if it does, prefer keeping the routing
box for single-component via a normalize-without-recompute, like
`normalizeGraphBB` at pack/index.ts:343 which is the faithful no-recompute path).
Must re-sweep: the change runs for ALL sfdp graphs, so confirm 0 pass→diverged
on non-ratio graphs.

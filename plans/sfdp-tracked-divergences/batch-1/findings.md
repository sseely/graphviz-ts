# Batch 1 findings — B1 node-size/text-measure residual (graphs-b106, share-b106)

## Verdict: RESOLVED by the B4 fix (same root cause). No B1-specific change.

### Diagnosis (per diagnosis.md)
Injecting native positions into b106 left a residual of 4406 diffs (pre-fix).
Decomposed:
- Node POSITIONS faithful: every node center == native modulo a constant
  translation dy=+931.0 (dx=0); node box sizes byte-identical. → text-measure /
  node-sizing REFUTED.
- The +931 offset (and the +271 bb height) traced to the single-component
  `postprocess` in `src/layout/sfdp/index.ts`: the old code recomputed
  `g.info.bb` geometrically (`computeSubgraphBB` = node-box ∪ edge-curve union)
  and shifted by THAT `ll`. b106 carries a 113-line edge label
  (`Node1307->Node1300`) whose extent grows the routing box `g.info.bb` but is
  NOT in the node∪curve recompute → the geometric `ll` sat ~931pt above the
  routing `ll` → every coordinate offset by 931, blowing the bb and every
  edge/label draw op.

### Fix = the B4 fix (`fix(T4.2)` commit fa0240b)
Single-component keeps the routing box (`normalizeGraphBB`) instead of the
geometric recompute; shift by the routing-box `ll` (label + spline extent
included), matching C `gv_postprocess`/`translate_drawing`.

### Verification (injected, post-fix)
- graphs-b106: compareXdot 0 diffs (bb 1135.3×1781 == native, was 2052.6).
- share-b106: compareXdot 0 diffs.
Both → **drift-exonerated** on attribution regen (A1-drift accept; real render
still drifts because b106 is a large chaotic-spring graph, but the tracked
residual is gone).

### Note
The original B1 rep (graphs-unix) was already drift-exonerated by Mission 0.
"Edge-label placement" looked implicated (the 113-line label spanned the
offset frame) but was a symptom of the frame offset, not an xlabel-RTree bug.

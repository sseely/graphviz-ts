<!-- SPDX-License-Identifier: EPL-2.0 -->

## Observation: make_LR_constraints running position must truncate to int (x-coord NS degeneracy)

- **Context**: Mission plans/xcoord-ns-degeneracy. honda-tokoro diverged from
  native dot in within-rank cross-coord (cy, rankdir=LR); two weight=0 edges
  drove a degenerate x-coord network-simplex optimal face. 4-stage C-vs-port
  oracle dump (position.c create_aux_edges + ns.c rank2, gated on `GV_XDUMP`,
  reverted after) localized the FIRST divergence to Stage 1 (aux graph):
  port VIRTUAL/SLACK node ranks were FRACTIONAL (e.g. V@r108.4264, V@r36.1421)
  where C's were INTEGER.
- **Finding**: C `ND_rank` is an `int`. make_LR_constraints does
  `last = (ND_rank(v) = last + width)` — the double `last+width` truncates to
  the int field, and the assignment expression's value (the truncated int)
  feeds back into `last`. So C accumulates **integer** running positions. The
  port's `lrRankPair` (position-aux.ts) kept `last + width` as a float and
  accumulated the fraction. Fractional seed ranks perturb slack / tight-edge
  (slack==0) detection in feasible_tree → a different spanning tree → the
  network simplex selects a different vertex of the (equal-cost) optimal face.
- **Fix**: `const next = Math.trunc(last + width); v.info.rank = next; return
  next;` (position-aux.ts:lrRankPair). C double→int assignment truncates toward
  zero; positions are always ≥0 so trunc == floor here. Faithful, derivable,
  no honda special-casing.
- **Verification**: honda's entire x-coord NS solution now conforms to C —
  Stage 3 (pre-balance) + Stage 4 (post-LR_balance) named ranks identical, and
  ALL 18 pivots identical (count + sequence + virtual/slack refs). honda node
  positions now conformant with native (28 node labels were off 5–7px → 0).
  Corpus: survey:gate PASS, 0 verdict regressions on BOTH baselines (headless +
  pango); **12 graphs improved diverged→match** (2193, graphs-NaN/b102/b143/
  ports/xx families). 2471 node positions improved ~2400px toward native.
- **Confidence**: High (C int-truncation is a structural type fact; honda NS
  conforms to C end-to-end).

## RESIDUAL 1 (separate mission): honda edge-spline piece-count divergence

honda still has verdict "diverged" (maxΔ ~27.9, firstDiffPath an edge `@d`)
AFTER the x-coord fix. This is NOT x-coord NS:
- Node positions conformant C; the full NS pivot trajectory matches C.
- Only **2 of 40 edge paths** differ in bezier piece count (edge2: native
  2-seg / port 1-seg; edge27: native 2-seg / port 4-seg), plus coord deltas on
  labeled edges. The documented fitter piece-count / labeled-edge spline class
  (splines.c / dotsplines), independent of node placement.
- DISPROVED the mission README premise: setting the weight=0 edges to weight=1
  (two or all-four) STILL diverges (maxΔ 27.7 / 26.3) — weight=0 was never the
  EDGE driver; it only drove the (now-fixed) node-cy shift.
- Next mission: honda labeled-edge spline piece-count vs native (splines.c).

## RESIDUAL 2 (cluster x-coord interaction): 2796

2796 (cluster graph, rankdir=LR, 43 clusters) is already structurally diverged
(port emits 213 edges vs native 212 — a pre-existing cluster edge-emit bug).
The int-truncation fix shifts its whole-cluster block ~250px FARTHER from
native (uniform translation; node maxΔ 689→941 headless). This is movement
within an already-broken cluster layout (different graph structure than native),
NOT a per-node x-coord regression, and does NOT change verdict (diverged→
diverged; in the gate's pre-existing allowlist). Root is the cluster emit/
ranking divergence (cf. [[2471-blocker-is-cluster-ranking]]), surfaced — not
caused — by the more-faithful ranks. Candidate for the cluster x-coord NS work.

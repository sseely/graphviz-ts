<!-- SPDX-License-Identifier: EPL-2.0 -->

## Observation: 2368 residual after degenerate-label wiring = flat-label-rank vspace (NOT the label work)

- **Context**: mission fix-xns-absolute-anchor Batch 2 (degenerate labeled-flat
  emission via faithful edge_in_box). After Batch 1 (remove normalizeXcoords) +
  Batch 2 (makeFlatLabeledEdge handled-on-degenerate, drop routeLoneEdge skip,
  edge_in_box overlap gate, fwd-normalize backward labeled flats), 2368_1 and
  1624 byte-match; 2368's structural childCount divergence is RESOLVED.

- **2368 before**: diverged, maxΔ 5, firstDiff `svg/g[1][childCount]` — port drew
  6 edges, C drew 11 (the degenerate + non-degenerate labeled-flat legs missing).
- **2368 after**: 11 edges, 9 paths, all 22 labels — childCount now matches C.
  Residual: a uniform ~5pt vertical (bbox 143 vs 148) + ~1pt horizontal (604 vs
  608) divergence. maxΔ still ~5 (firstDiff moves from childCount to a coord).

- **Root of the 5pt (instrumented)**: NOT the degenerate-label path.
  - C `make_flat_labeled_edge` label vnode for 256->316 = (20.0, 40.4),
    ht 9.6 — BYTE-IDENTICAL to the port. So label/spline internal geometry match.
  - The topmost content is the `{rank=same line7;136}` group (top rank) + edge
    136->196; everything sits ~5pt lower in the port. The discriminator is the
    vertical spacing of the edge-label ("abomination") rank between the top
    rank-group and the main flat band. 2368_1 (a single rank=same band) has no
    such inter-group spacing and byte-matches; 2368 (three rank=same groups +
    edge labels) accumulates the 5pt.
  - Plus a ~1pt node-x delta (e.g. node 136 at x=255 port vs 256 C): x-coord NS
    tie-break among multiple optima (the 2371-class issue, see
    [[2371-is-xcoord-ns-solution-selection]]).

- **Impact**: 2368 is dramatically improved (structural fix) but not byte-match.
  The residual is a SEPARATE, pre-existing root cause (edge-label rank vspace +
  x-NS tie-break) in the layout/ranking phase, orthogonal to the degenerate-label
  emission this mission targeted. Chasing it means flat-label-rank vertical
  spacing (input.c/position-ycoords EDGE_LABEL ranksep) and/or x-NS optimal-face
  selection — both corpus-wide-risky and out of the labeled-flat scope.

- **Confidence**: High (C-instrumented label vnode identical; topmost element
  identified; matches pre-existing baseline maxΔ 5).

## RESOLVED (mission plans/2368-byte-match): vspace was Issue-2 fallout; x = ED_dist; residual = Pshortestpath tie-break

The 5pt vspace was NOT an independent ranking/ht issue. It was a CONSEQUENCE of
the adjacent labeled-flat curve geometry being missing (Issue 2): the port drew
opposing legs (`to1`/`to2`) as straight cnt=1 stubs, so the down-arcs + their
below-rank labels were absent and the bbox never grew to include them. C
`flat_edges` stores only label WIDTH for adjacent flats (flat.c:251 `FIX:`
comment — height not accounted), confirming no ht reservation.

Fixes (all survey-gated, 0 regressions):
1. **Issue 2** — `collectAdjFlatGroup` now groups the UNORDERED {tail,head} set,
   gated on shared `getMainEdge` (C's dispatch discriminator: groups
   same-direction parallels + concentrate/both-labeled opposing pairs; NOT a
   mixed-label opposing pair in distinct flat classes, cf. 2476). `installFlatLeg`
   reverses points + ignoreSwap for a right-tail leg. Drawing the down-arcs grew
   the bbox → **the 5pt vspace resolved automatically**.
2. **x-positions (was assumed deep x-NS)** — actually a LOCALIZED missing
   `ED_dist` MAX-accumulation onto the flat class rep (flat.c:319-322): the port
   set dist per-edge, so a concentrate group whose rep is the unlabeled leg kept
   dist=0 → make_LR_constraints under-reserved (90 vs 92). Rewrote flat.ts
   flat_edges dist pass faithful to C. **bbox + every node x now byte-match.**

RESULT: 2368 diverged maxΔ65 → structural-match maxΔ10.22. The 1pt node-x delta
this note predicted was the ED_dist bug, not x-NS optimal-face.

REMAINING (deep, documented): ONE edge `376->76` (maxΔ10.22) — C's `Pshortestpath`
routes two TRANSLATIONALLY-IDENTICAL, perfectly-symmetric down-boxes as MIRROR
images (376->76 dips left, 256->436 dips right); the port routes both
translation-consistently. A core-pathplan symmetric-box funnel tie-break
(position-dependent in C), out of labeled-flat scope, high-risk (25/25 route
corpus). See [[2371-is-xcoord-ns-solution-selection]] for the separate (now-fixed)
multi-component x-NS class.

## DECISION (hypot investigation): port stands; residual is a C inconsistency

Deep-dived the lone residual `376->76` (maxΔ 10.22). It is a 1-ULP tie-break in
`Proutespline`'s `findMaxDev` (route.ts): on a geometrically SYMMETRIC down-arc
channel the two interior deviations are an exact tie, broken by ~1e-14
cancellation noise in the absolute-coordinate bezier eval whose sign depends on
absolute position.

KEY: **C is the inconsistent one.** It splits two translation-congruent arcs
toward OPPOSITE corners — `376->76` mirrors `256->436` (and `376->196`) — purely
from floating-point position dependence. The port is TRANSLATION-EQUIVARIANT
(same channel anywhere -> same spline), so it is self-consistent across all three
and matches C on two of the three; only `376->76` (where C's noise flips the
other way) diverges.

Root of the FP gap: C's `dist` is libm `hypot`, and Apple's macOS `hypot` (which
generated the oracle) bit-matches NO portable implementation — measured vs Apple
`hypot`, bit-identical rates: V8 `Math.hypot` 62.9% / correctly-rounded(≈Arm)
84.3% / fdlibm 89.7% / `sqrt(dx*dx+dy*dy)` 94.4% (full-FP-range, no-overflow
sample: Math.hypot 98.4%, sqrt 89.5% — the graphviz regime is similar-magnitude
dx≈dy, where sqrt wins). So reimplementing `hypot` from Arm would NOT help (84%).
Same Apple-libm boundary already accepted for `pow` (src/common/arm-pow.ts; sfdp
asserts 6-digit, not byte-match).

Experiment (sqrt ptDist + strict `d>maxd`, faithful to C's code): corpus survey
net-neutral (0 verdict/maxΔ/firstDiff changes across 790) BUT regressed 3
oracle-pinned unit tests — `splines-routespl` #241_0 translation-equivariance +
"knot on TAIL side", and `splines-flat-multi` cnt=3 byte-match-oracle. No
comparison rule (tolerant or strict) matches BOTH #241_0 and 2368, because the
port's FP != Apple's FP. So the tolerant (equivariant) tie-break is the correct
deliberate design and **stands**. Reverted the experiment; tree clean; suite green.

SURVEY VERDICT for 2368: **structural-match** (NOT diverged), maxΔ 10.22. Reason:
`diffVerdict` (survey.ts) marks `diverged` only on a STRUCTURAL diff (a diff with
no numeric delta — different element/point count, missing/extra element). Both
sides emit the SAME 7-point bezier for `376->76`; only the control-point
COORDINATES differ -> a numeric diff -> `structural-match` with maxΔ recorded. It
would flip to `diverged` only if the structures differed (e.g. a 4-pt straight
stub vs a 7-pt arc, as in the pre-fix Batch-0 state). The rules-gate counts it as
stable (font-independent), so it does NOT fail the gate.

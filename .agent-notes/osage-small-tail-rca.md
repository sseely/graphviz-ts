# Osage small-diff tail RCA (2026-07-11)

Closing the remaining osage `diverged` tail. Oracle =
`~/git/graphviz/build/cmd/dot/dot -Kosage -Txdot`, `GVBINDIR=/tmp/ghl`.
Comparator = `test/golden/compare-xdot.ts` @ 0.01.

## Summary

| id | nDiffs | mechanism | verdict |
| --- | --- | --- | --- |
| 1332 | 5→0 | printf-round non-finite regression (cluster `_draw_`) | FIXED |
| 2721 | 1→0 | same | FIXED |
| 1221 | 1→0 | same | FIXED |
| linux.x86-pack_neato2 | 453→0 | polyRects `genBox` CVAL/round misport | FIXED |
| nshare-pack_neato2 | 453→0 | same | FIXED |
| linux.i386-b29 | 2 | placeLabels knife-edge tie (A9) | ACCEPT A9 |
| share-b29 | 2 | mirror of linux.i386-b29 (A9) | ACCEPT A9 |
| 1652 | 2 | placeLabels knife-edge tie ×2 (A9) | ACCEPT A9 |

## FIXED — 1332 / 2721 / 1221 (printf-round non-finite regression)

**Observed discrepancy.** Fresh render vs oracle showed a NEW signature the
committed baseline parity (`generatedAt 2026-07-11T14:35:50Z`, i.e. before the
afternoon commits) did not have: `cluster:<name>/_draw_[opCount] N+1 vs N`.
2721/1221 were `pass` at baseline; 1332 had 19 pos diffs at baseline (the
b786-style tie) which 931b1b6 fixed, exposing the cluster diff.

**Bisect.** Rendered 2721's degenerate `cluster_uni` `_draw_` at 2fb8e79 /
3b0deab / 931b1b6 / HEAD. At/before 3b0deab the polygon coords were
`Infinity Infinity ... NaN` (the comparator canonicalizes `Infinity↔inf`,
`NaN↔nan`, so it PASSED). From **931b1b6** ("round exact decimal ties
half-even like C printf") onward the coords became a ~309-digit integer
(`17976931348623159...`), diverging.

**Mechanism.** `cluster_uni` is a degenerate/empty cluster: its bb is
`±inf/nan`, so the polygon draw-op coords are `Infinity`/`NaN`. The polygon
draw-op formatter `xdotNum` → `toFixed2HalfEven` → **`printfFixed`** (added in
931b1b6). `printfFixed`/`printfSig` decompose the IEEE-754 bit pattern into an
exact integer mantissa via `DataView`, but had **no guard for non-finite
input** — the Infinity/NaN exponent bits (all-ones) were read as a finite
mantissa, emitting a spurious ~309-digit integer. `Number.prototype.toFixed`
/`.toPrecision` (which these helpers claim to replace byte-for-byte) return
`"Infinity"`/`"NaN"` for non-finite; the helper broke that contract.

**Fix.** `src/util/printf-round.ts`: guard both helpers —
`if (!Number.isFinite(v)) return v.toFixed(decimals)` /
`return v.toPrecision(sig)`. Restores the exact pre-931b1b6 output. `gfmt5`
already short-circuited non-finite (`String(v)`), so only the `xdotNum`/`%.Nf`
path was affected. Regression test added to `printf-round.test.ts`.
**Ruled out:** layout/geometry — the finite-tie fix (b786/graphs-b786) is
unchanged; only non-finite inputs were mishandled.

## FIXED — pack_neato2 (linux.x86 / nshare) — polyRects genBox CVAL/round

**Observed discrepancy.** 453 diffs; whole components placed in different pack
cells (some node y off by ~258pt), canvas 35pt smaller than native (bb
334×306 vs 369×341). PRE-EXISTING (same at baseline) — not a regression.

**Setup.** `packmode="graph"`; the anon `{}` subgraphs are NOT clusters
(`is_a_cluster` false → `GD_n_cluster=0`), so osage packs all 24 nodes as
individual rectangles via `putRects` → **`polyRects`** (mode `l_graph`,
`pack.c:935`). All 24 boxes are identical (54×36 → C `W=13 H=9 perim=22
nc=165 cells`).

**Instrumentation.** Dumped C `pos[]`/coords (`dot -v2`, `-v3` for
`W/H/nc`) and the port's placement order (temporary `PACK_DUMP` in
`polyRects`). Both place box idx23 first at (-30,-20) (qsort tie-order and
`tryCenter` agree); the spiral (`spiral-search.ts`) and `tryCenter` are
faithful. But the position SETS differ (port max coord 145 vs C 165 — port
packs tighter). With identical boxes the packing set must be order-invariant,
so the divergence had to be the box FOOTPRINT.

**Mechanism.** C `genBox` maps each box corner to a grid cell with
`CELL` = `CVAL` applied to the **double** `pointf`, then a separate
`round()`. `CVAL(v,s) = v>=0 ? v/s : ((v+1)/s)-1` on a double is
floating-point division:
`CVAL(-4.0, 5) = ((-4+1)/5)-1 = -1.6 → round → -2`,
`CVAL(58.0, 5) = 11.6 → round → 12`.
The port's `poly-pack.ts` `cval` instead used truncating/integer semantics
and genBox applied NO round: `cval(-4,5) = trunc(-0.6)-1 = -1`,
`cval(58,5) = floor(11.6) = 11`. Result: 13×10 = 130 cells vs C's 15×11 =
165 — every box lost a cell on the negative side (and one on the far side),
so the greedy spiral packed them tighter → wrong cell assignment + smaller
canvas. (`poly-place.ts`, the `l_node`/`polyGraphs` path, already had the
faithful `cround(cell(...))` genBox — the two pack files each carry their own
genBox and only the `polyRects` copy was buggy.)

**Fix.** `src/layout/pack/poly-pack.ts`: `cval` now does the faithful double
CVAL; added `cround` (half-away, C `round()`); `genBox` rounds the box
corners, measures the cell region center-relative (`LL = -margin`,
`UR = width + margin`), and applies `cround(cval(...))` per corner — exactly
`pack.c:genBox`. Both pack_neato2 ids → 0 diffs. `cval`/`cround` unit tests
updated (the old `cval(-3,3)=-1` asserted the truncating bug; faithful is
`-1.667`, rounded by genBox).

## ACCEPT A9 — linux.i386-b29 / share-b29 / 1652 (placeLabels knife-edge)

Registry entries added under `accepted-divergences-engines.json` → `osage`.

**b29.** Edge `Node14663->Node14649`: spline `_draw_` (`B 4 1040.15 72 ...
679.18 72`) and arrowhead `_tdraw_` are **bit-identical**; only the label
`_ldraw_` text x-anchor differs — oracle 841.06, port 878.28 — placed
symmetrically about the bit-identical spline midpoint ~859.67 (±18.6 = half
the label width). `share-b29` is the mirror (841.06 vs 878.28). 2 diffs in a
136 KB graph; every other label bit-matches → a single label-side tie flip,
not a systematic placement bug. Same class as the already-accepted twopi
graphs-b29 (placeLabels tie on 1-ULP-drifted surrounding objects).

**1652.** Two edges each flip one label with bit-identical spline+arrowhead:
`Op_1091->Op_1092` x-anchor 2266.75 vs 2332.07 (symmetric about the identical
midpoint 2299.4, ±32.66 = half the 65.32 label width); `Op_2105->Op_2106`
y-anchor 247.54 vs 230.74 (above/below flip on a horizontal edge, x-anchor
identical). Oracle renders completely (not a native-timeout flake). 2 diffs
in a 240 KB graph. Same knife-edge class.

**Why irreducible.** The label geometry the port feeds `placeLabels` differs
by ≤1 ULP from C's (surrounding node/spline coordinates), which tips a
discrete label-side tie; the OUTPUT delta is large (one label-width) but the
CAUSE is a sub-ULP input drift JS cannot reproduce (Apple libm vs V8). The
single-edge, all-other-labels-match footprint is the signature of a tie, not
a placement defect.

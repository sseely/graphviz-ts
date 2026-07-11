# osage 1447 / 1447_1 / graphs-b106 RCA (2026-07-11)

Split off the prior osage-spline-family RCA. Three distinct mechanisms.
Oracle = `~/git/graphviz/build/cmd/dot/dot -Kosage -Txdot`, `GVBINDIR=/tmp/ghl`.

---

## 1447 — splines=ortho maze, htrack negative-half round() — **FIXED** (commit 5995bb7)

52 xdot diffs -> **0 (conformant)**. Node centers already bit-exact; 4 edges
(a70->b71, b06->b68, c5d->c6a, e37->eb4) each route the bottom gutter and showed
final Y = oracle **+1** (30/29, 3/2, 12/11, 21/20).

**First diverging quantity:** the pre-clip maze route's bottom-track Y. The
ortho maze routes in a frame whose bottom/left gutter cells sit at NEGATIVE
coordinates (cell `LL.y = -36`); an evenly-spaced horizontal track lands on an
exact NEGATIVE half-integer. Matched port+port-log instrumentation: for a70->b71
the bottom seg had `lo=-36 hi=0 f=0.875 trackNo=2 n=15 -> raw=-4.5`.

**Mechanism (both sides):** C `htrack` (ortho.c:1065) rounds with libm `round()`
= half-away-from-zero: `round(-4.5) = -5`. Port used `Math.round` = half toward
+inf: `Math.round(-4.5) = -4`. After the uniform origin translate (+34) this is
30 vs 29. The four gutter tracks are exactly -4.5/-13.5/-22.5/-31.5.

**Fix:** local `cround(v) = v>=0 ? floor(v+0.5) : ceil(v-0.5)` in
`src/ortho/ortho-route.ts` htrack. `vtrack` correctly has NO round() in C
(ortho.c:1050) and is unchanged.

**Ruled out:** track_no / seg_list size / cell bb (all bit-identical port vs C
via instrumentation), node centers (bit-exact), translate (uniform +34).

**Regression guard:** 16 splines=ortho ids re-swept (2361/14/2168_5/56/2082/1408/
1990/2643/2183/1880/144_ortho/1658/1856/2620 = 0 diffs; 2620 baseline was
structural-match, now 0). 2538 still 8 diffs but IDENTICAL with/without the fix
= pre-existing back-edge bezier-structure issue, NOT a regression. 15 osage
pass-ids unchanged. ortho unit tests 78/78.

---

## 1447_1 — splines=ortho + ratio=compress — SEPARATE mechanism, NOT the round fix

The htrack fix did NOT change 1447_1 (still 1246 diffs). bb (0,0,3452.1,962) and
all node centers bit-exact; only edges diverge. Delta distribution is broad
(Δ0..118, not a uniform +1), and includes X-coordinate divergences (e.g.
transc->complex bottom track X 3406.73 oracle vs 3405.03 port, Δ1.7) which come
from `vtrack` — which has **no rounding** — so the round fix cannot touch them.

This is the ratio=compress-amplified maze/track divergence: with node positions
identical, the maze cell partition and/or per-channel track assignment differs
under the compressed coordinate frame, amplified by the compress scaling into
Δ up to 118. Distinct from 1447; needs its own instrumented maze chase
(cell partition + assignTracks + channel seg_list ordering vs C for the
compressed input). NOT triaged further here.

---

## graphs-b106 — default EDGETYPE_LINE, edge-label placement — ROOT-CAUSED, reducible, NOT fixed

51 diffs, ALL `_ldraw_` edge-label T positions (and the missing `lp` attr). Edge
splines (`pos`) are **byte-identical** to the oracle. 5 labels diverge out of
214 placed: Node1315->Node1312 (Δ11), Node1336->Node1341 (Δ11/Δ36),
Node1336->Node1397 (Δ99), Node1368->Node1386 (Δ66), Node1374->Node1299 (Δ102).

### Placement path (faithful)
osage `spline_edges0(g, true)` -> center edge labels are UNSET, so
`dotneato_postprocess -> addXLabels` (postproc.ts:419) places them via
`placeLabels` (xlabels.c port). Anchor = `edgeMidpoint(g,e)` which for
EDGETYPE_LINE = `polylineMidpoint` (midpoint of the bezier's two endpoints).

### First diverging quantity + mechanism
- Anchor and label SIZE are **bit-identical** to C for the diverging labels
  (e.g. i=172 anchor=(719.02,128.51) size=(98.96,192) — the oracle's implied
  values match). So NOT the polylineMidpoint fmadd class, NOT a label-size bug.
- The candidate-position order in `xladjust` is **identical** to C (xL,yT first,
  then xL/xM/xR × yT/yM/yB) — verified against xlabels.c:368-424.
- **First diverging label is i=99** (Node1315->Node1312). All 99 prior labels
  place identically to the oracle -> occupancy is identical up to that point, so
  this is a LOCAL divergence, NOT an inherited cascade. Port places at
  (xL,yT)=700.76; oracle at (xM/xR)=711.88 — C detected an overlap at xL that the
  port missed.
- Brute-force scan at the xL candidate rect `[695,22,706,34]` finds `lbl#41
  a=48.0` (obj41's placed label overlaps), but the port's `rTreeSearch` returns
  **0 leaves** — it misses obj41.
- Tree walk: obj41's leaf rect is correct `[596,21,700,70]`, but its parent
  internal-node branch MBR is `[20,21,125,70]` — which does NOT enclose the leaf
  (x-max 125 < 700). The R-tree **cover invariant is violated**, so the query
  `[695,...]` fails `Overlap(query, parent)` and the whole subtree is pruned ->
  obj41 never reached -> port sees the xL candidate as clear.

### Why this is the port diverging, and why it is REDUCIBLE (not A9)
The under-coverage is a latent consequence of `CombineRect`'s high side using
`fmin` (rectangle.ts:overlap/combineRect) — which is **faithful to C**
(rectangle.c:95 also `fmin`). C's `RTreeInsert2` (index.c) and `RTreeSearch`
(index.c:130, prunes on `Overlap(r, branch.rect)`) are identical to the port. So
every per-op primitive is faithful: CombineRect, Overlap, RTreeSearch pruning,
RTreeInsert2 no-split `CombineRect` update + split `NodeCover`, `icompare`
(signed-int, = port's `a-b` on int32 keys), the Hilbert key `| 0` int32
reinterpret, the `Dtobag` splay-tree (cdt/bag.ts).

Therefore C's R-tree, built from the SAME objects with the SAME logic, must NOT
have the cover violation for obj41 (the oracle places its label correctly) — i.e.
the port's R-tree **topology diverges** from C's: obj41 lands under a different
(covering) parent in C. The divergence is emergent in the tree structure, driven
by either (a) the Hilbert-bag insertion ORDER (splay-tree in-order iteration for
the exact key sequence, incl. equal-key tie order) or (b) the node-split
partitioning (methodZero/pickSeeds tie-breaking, split-q.ts) — both of which use
the buggy-but-faithful `CombineRect` for area estimates, so a tie resolved
differently reshapes the tree.

**This is a fixable faithfulness gap, NOT an irreducible A9 tie** — so no
acceptance JSON is filed. Pinning the exact construction-order difference needs
NATIVE R-tree instrumentation: dump C's rtree insertion sequence (Hilbert order)
and every node MBR for b106 (lib/label/index.c RTreeInsert / node.c NodeCover /
split.q.c) and diff against the port's. Deferred here because (1) it requires a
native rebuild, which races the concurrent xlabels.c work the task flagged, and
(2) any fix touches shared xlabel R-tree infra used by ALL engines (dot node
xlabels, all edge labels) and needs a full multi-engine corpus sweep to land
safely.

**Ruled out:** anchor (edgeMidpoint/polylineMidpoint, bit-identical), label size
(bit-identical), candidate order (identical to C), placement ORDER / occupancy
cascade (first-diverging label i=99 has bit-identical prior occupancy),
CombineRect/Overlap/RTreeSearch/RTreeInsert/icompare/Hilbert-key primitives (each
individually faithful to C).

**Related known gap:** the port does not emit the `lp=` attribute for
xlabel-placed edge labels where native does (states-family journal 2026-07-11) —
a separate small emission fix, orthogonal to the placement divergence above.

### Handoff next step
Instrument C `lib/label/index.c` (RTreeInsert leaf/branch MBRs + insertion order)
for graphs-b106 under osage, diff the insertion sequence + node MBRs against the
port's (a temporary port-side dump of `xlspdxload` order + final tree is trivial
to add). The first object whose (parent MBR, or Hilbert rank) differs is the
concrete root. Likely suspects in order of probability: split partition
tie-breaking (split-q.ts pickAndClassifyBest / pickSeeds), then equal-Hilbert-key
iteration order in cdt/bag.ts.

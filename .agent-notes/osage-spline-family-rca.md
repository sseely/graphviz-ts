# osage edge-routing "family" RCA (2026-07-11)

Task framed 1855/1447/1447_1/graphs-b106 as a shared osage obstacle-spline
family. **Refuted.** The four ids use THREE unrelated routing paths; only 1855
is the visibility/obstacle-spline path. Per-id attribution below.

Oracle = `~/git/graphviz/build/cmd/dot/dot`, `GVBINDIR=/tmp/ghl`, `-Kosage`.
All C probes reverted; `git -C ~/git/graphviz status` clean for my three files
(neatosplines.c, pathplan/cvt.c, pathplan/visibility.c). The tracked
`lib/label/xlabels.c` edit + `.gitignore` are a **parallel agent's** work, not
mine (XL_PROBE2 xlabel debug), left untouched.

---

## 1855 — visibility obstacle-spline, IRREDUCIBLE A9 (controlled experiment done)

digraph, 32-node star X->1, `splines=true overlap=false ratio=fill`, default
ellipse nodes. Node centers already bit-exact to oracle (prior size-round fix,
.agent-notes/1855-rca.md #3). All 110 residual diffs are **3 edges**: 6->1
(B10), 16->1 (B7), 30->1 (B10). X-coords bit-exact; only Y differs, and 6->1's
port waypoints are the **exact mirror** of C's about the endpoint line
(429.120 vs 385.608, ±21.756).

**First diverging quantity:** the routed polyline from `Pobspath`/`obsPath`
(getPath), NOT the spline fit. Endpoints identical. For 6->1 C routes the gutter
ABOVE the node row (waypoints y=429.120), port routes BELOW (y=385.608).

**Mechanism (both sides):**
- Divergence is in the visibility matrix, not Dijkstra. `conf.P` (all 256
  obstacle vertices) matched C to 3 decimals; `shortestPath`/`makePath`
  (vispath.ts) is a faithful port. Dumping the vis matrix: port has ~20 EXTRA
  visibility edges vs C. Every differing pair is **vertically collinear** —
  segments up the gutters between node columns, grazing octagon corners.
- `compVis` sub-results (visibility.ts:59 / C visibility.c:171): `inCone`
  agrees; `clear()` diverges. C: a gutter column's corner-x are ALL the
  bit-identical double `156.62317307356111` → segment exactly collinear with
  the grazing corners → `intersect`'s `area_abc==0 && inBetween` fires →
  tangent-blocked → no cross-gutter edge. Port: the same column has TWO
  ULP-differing x (`...108`, `...110`) → not collinear → not blocked → extra
  visibility edges → Dijkstra resolves the up/down homotopy tie to the mirror
  side.
- **Origin of the ULP scatter:** octagon obstacle vertices,
  `circumscribed_polygon_corner_about_ellipse` (splines.ts:135 circumscribedCorner
  / neatosplines.c:301) + `ND_coord`. Node centers bit-exact and the +center add
  is exact IEEE, so the scatter is in the corner formula. Raw `polyp` (pre-center)
  differs 3-4 ULP: e.g. node1 j=1 polyp.x C=22.272175763648221 vs port
  ...217. cos/sin are NOT the cause (injecting C's exact libm cos/sin for the 8
  angles is a bit-for-bit no-op — the 1-ULP trig delta washes out under `×b`).
  The 3-4 ULP smear is **FMA/fp-contraction**: clang builds graphviz with the
  default `-ffp-contract=on`, fusing the `a*b±c` chains in
  `ellipse_tangent_slope` (`a*a - p.x*p.x`) and `line_intersection`
  (`m0*p0.x - p0.y - m1*p1.x + p1.y`, `p0.y + m0*(x-p0.x)`); V8 rounds each op
  separately. C's fused rounding happens to collapse a gutter column to one
  double; the port's separate rounding splits it into two — flipping the
  knife-edge exact-collinearity `clear()` test.

**Ruled out:** cos/sin ULP (injection no-op); Dijkstra tie-break (faithful, P
identical); obstacle polygon ORDER (position-identical CVPOLY dump); node
centers (bit-exact); the spline fitter / Proutespline (endpoints + homotopy
decided upstream in the route).

**Controlled experiment (A/B):** injecting C's exact obstacle-vertex
coordinates (`OSAGE_CINJECT`, buildObstacles override) into the otherwise
untouched port → **0 diverging edges**. Proves the entire osage routing
pipeline (legalArrangement, visibility, Dijkstra, Proutespline, spline fit) is
faithful; the sole divergence is the obstacle-vertex FP.

**Verdict:** IRREDUCIBLE A9 — sibling of the accepted circo/241_0 (CDT incircle
tie) and osage/*polypoly (pack-cell swap) entries. No deterministic JS rewrite
reproduces clang's fp-contracted-plus-libm coordinates for a knife-edge
collinearity test; even matching individual FMA sites is fragile and would break
on the next graph.

### Acceptance draft (test/corpus/accepted-divergences-engines.json → "osage")
```json
"1855": {
  "class": "A9",
  "bound": "110 xdot draw-op diffs = 3 obstacle-routed edges (6->1 B10, 16->1 B7, 30->1 B10) routed on the mirror side of the node row; X bit-exact, Y mirrored (6->1 429.120 vs 385.608). Node centers already bit-exact. Mechanism: octagon obstacle vertices (circumscribed_polygon_corner_about_ellipse) differ 3-4 ULP from C because clang -ffp-contract=on fuses the a*b+-c chains in ellipse_tangent_slope/line_intersection while V8 rounds each op; C's fused rounding collapses a gutter column of corner-x to one bit-exact double (exact collinearity), the port's splits it into two, flipping the visibility clear() tangency test so the gutter is no longer blocked -> ~20 extra visibility edges -> Dijkstra resolves the up/down homotopy tie to the mirror side. cos/sin injection is a no-op; C-obstacle injection A/B -> 0 diffs. Full RCA: .agent-notes/osage-spline-family-rca.md.",
  "ref": "known-divergences.md#a9-engine-track-twopi-circo"
}
```

---

## 1447 / 1447_1 — ortho maze (splines=ortho), NOT obstacle-spline. Own chase.

1447: `splines=ortho`, `shape=box`. 1447_1: `splines=ortho ratio=compress
size=16,16 shape=box3d`. These route through `orthoEdges`/maze
(`RoutingHelper.ortho`), which C gates off the visibility path
(`if (edgetype != EDGETYPE_ORTHO) vconfig = Pobsopen(...)`) — no `Pobsopen`, no
obstacle-spline. Distinct pre-existing mechanism.

- 1447: node centers **bit-exact** (0/36). 4 edges diverge with a **consistent
  port = oracle + 1pt in Y** (29->30, 2->3, 11->12) — deterministic, not random
  ULP. The `makeOrthoObstacle` boxes are geometrically identical between C and
  port (only the CW start-vertex rotation differs, which is irrelevant: the maze
  reads `coord`/`xsize`/`ysize`, not the obstacle polygon; the boxes are used
  only for `legalArrangement`). So the +1 is internal to the maze cell / track
  logic (ortho-route.ts midPt/sidePt cell bb, or assignTracks), NOT the input.
- 1447_1: same ortho family; 76 edges, deltas up to ~9pt (the ortho offset
  amplified by `ratio=compress` scaling).
- Likely the same class as the accepted 2620 ortho residual (A8: FP amplified by
  ortho truncation), but NOT yet pinned to a maze file:line — needs its own
  instrumented chase of C's ortho route (attachOrthoEdges/convertSPtoRoute) vs
  port. Do NOT fold into the 1855 acceptance.

## graphs-b106 — default LINE edges + labels, NOT obstacle-spline. Own chase.

`shape=box`, NO `splines` attr → osage default `EDGETYPE_LINE` (straight B4
edges). Bezier structure matches oracle exactly (229 B4 + 1 B7 both sides). The
48 diffs are in label `_ldraw_` T positions (first at ldraw#129: T x 711.88 vs
700.76; others Δy 36, Δx up to 99) — a label-placement / xlabel mechanism, not
edge geometry. Node box P4 coords for the sampled node match. Needs its own
label-placement chase (likely related to the parallel xlabels.c work).

---

## Summary
| id | path | first diverging quantity | verdict |
|----|------|--------------------------|---------|
| 1855 | visibility obstacle-spline | Pobspath route homotopy (mirror) | **IRREDUCIBLE A9**, C-obstacle injection A/B = 0 |
| 1447 | ortho maze | routed Y, consistent +1pt | ortho chase (node-exact; likely A8) |
| 1447_1 | ortho maze + compress | routed X/Y, +compress amplification | ortho chase (same as 1447) |
| graphs-b106 | LINE edges | edge/node label `_ldraw_` T pos | label-placement chase |

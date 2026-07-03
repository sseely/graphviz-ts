<!-- SPDX-License-Identifier: EPL-2.0 -->
# structural-match bucket: polygon-points

14 ids, per parity.json (`test/corpus/parity.json`, `generatedAt`
2026-07-03T15:35). All comparisons re-derived directly with `compareSvg`
(`test/golden/compare.ts`) against the cached native oracle
(`/var/folders/.../dot-corpus-oracle/3a26f7da8c36/`, GVBINDIR=/tmp/ghl,
i.e. C's own headless `estimate_text_width_1pt` fallback — not FreeType).
**Instrumentation caveat**: `@points[N]` in `parity.json`/`compareSvg` is a
FLATTENED numeric index across the whole `points` string (x0,y0,x1,y1,...),
and `gN` sibling counters are per-tag position among a parent's children
(pairwise by document position, not by id/title) — a naive raw-regex read of
"the Nth `<g>` in the file" silently misindexes by one element and points at
the wrong node/edge. All findings below were re-verified via the project's
own `normalizeSvg`/`compareSvg` (test/golden/normalize.ts, compare.ts), not
manual regex extraction.

```
| sub-cluster | ids | count | family | tractability | ref |
|---|---|---:|---|---|---|
| self-loop label bbox omission | graphs-sb_box, graphs-sb_box_dbl, graphs-sb_circle, graphs-sb_circle_dbl, graphs-sl_box_dbl, graphs-decorate | 6 | other-named (self-loop-label-bbox) | known-mechanism | src/layout/dot/splines-groups.ts:90-95 |
| box vertex order ignores orientation | 1658 | 1 | node-shape-vertex | known-mechanism | src/common/poly-vertices.ts:48-55,154-157 |
| star shape unported (decagon, not star) | regression_tests-shapes-reference-star | 1 | polygon-sides | known-mechanism | src/common/shapeData.ts:353 (P_STAR); lib/common/shapes.c:4039-4085 |
| nested HTML table extra-space distribution unported | 1622_3 | 1 | other-named (html-table-cell-sizing) | known-mechanism | .agent-notes/html-nested-table-and-port-gap.md; lib/common/htmltable.c:1600 |
| rotated 4-gon (diamond) ellipse-fit sizing is float-sensitive | share-polypoly, windows-polypoly, graphs-polypoly | 3 | node-shape-vertex | needs-C-instrumentation | src/common/poly-sizing.ts:164-185 |
| constraint=false edge under concentrate+curved routes very differently | 1453 | 1 | arrowhead-vertex | needs-C-instrumentation | .agent-notes/1213-constraint-false-spline-divergence.md; plans/fix-1213-splines/decisions.md |
| setlinewidth-styled edge arrowhead, small residual | graphs-style | 1 | arrowhead-vertex | needs-C-instrumentation | — |
```

`6 + 1 + 1 + 1 + 3 + 1 + 1 = 14`. ✓

---

## 1. self-loop label bbox omission (6 ids)

**ids**: `graphs-sb_box`, `graphs-sb_box_dbl`, `graphs-sb_circle`,
`graphs-sb_circle_dbl`, `graphs-sl_box_dbl`, `graphs-decorate`.

**Mechanism**: after routing a self-loop group, C calls
`updateBB(g, ED_label(e))` for every labeled self-loop edge in the group
(`lib/dotgen/dotsplines.c:404-408`), expanding the graph's bounding box to
include the self-loop label's extent (the label is placed to the side of the
node the loop bulges toward — right/left/top/bottom depending on port sides).
The port's `dispatchEdgeGroup` (`src/layout/dot/splines-groups.ts:90-95`)
calls `routeSelfEdgeGroup(...)` and returns — with **no corresponding
`updateBB` call** — even though `updateBB` exists and is used correctly at
every *other* label-placement site (`src/layout/dot/splines-label.ts:112,330,373,387`,
`src/layout/dot/splines-flat.ts:250`, `src/layout/dot/straight-edges.ts:221,224`).
Net effect: the graph's final bbox/canvas is too small on whichever side the
self-loop label extends toward, so the SVG `translate()`/viewBox is wrong and
every absolute coordinate in that region (not just the self-loop) shifts by a
near-constant offset.

**Evidence per id**:
- `graphs-sb_box`/`_dbl` (self-loop `tailport=se headport=se`, routes via
  `selfBottom`) and `graphs-sb_circle`/`_dbl`: worst vertex is
  `svg/g[1]/polygon[1]` — the **background/graph polygon** — off by
  51.47pt in width (measured label width `tailport=se headport=se` ==
  132.03pt on *both* sides, confirmed byte-identical via a standalone C
  driver linked against the built `libgvc.dylib`'s
  `estimate_text_width_1pt`, ruling out any font-metric divergence).
- `graphs-sl_box_dbl` (self-loops route via `selfLeft`, extending labels
  **left** of the node): worst vertex `g[1]/g[18]/polygon[1]` (an
  arrowhead), off by 268.12pt, purely on X with Y matching to 0.03pt — a
  pure horizontal canvas-shift signature, consistent with the missing left
  bbox expansion.
- `graphs-decorate`: worst vertex `g[1]/g[38]/polyline[1]` is the
  `decorate=true` connector line for edge **`edge22`, title
  `Se3ffa81011d69e3db000538bf02fa1d0->Se3ffa81011d69e3db000538bf02fa1d0`** —
  a self-loop with a 2-line label and no compass ports (routes via
  `selfRight`). Its whole `<g>` (path + polyline + all 6 text lines) shifts
  by a constant ~104.55pt in X — the decorate polyline itself is computed
  correctly; it is just sitting at the wrong absolute position because the
  self-loop label never grew the graph bbox.

**Ruled out**: font/text-measurement divergence (label widths verified
byte-identical between the port's `EstimateTextMeasurer` and C's own
`estimate_text_width_1pt` via a standalone C test linking `libgvc.dylib`);
`selfRightSpace`/`SELF_EDGE_SIZE` porting (`src/common/splines-selfedge.ts`
matches `lib/common/splines.c:1139-1152` exactly, including the
`SELF_EDGE_SIZE=18` constant); the `ND_rw`/`ND_mval` swap-restore dance
(`collectOtherEdges` in `src/layout/dot/self-loop.ts:56-70` correctly mirrors
`lib/dotgen/dotsplines.c:305-313`'s inline `SWAP`).

---

## 2. box vertex order ignores orientation (1658)

**Mechanism**: `computeVertices` (`src/common/poly-vertices.ts:140-159`)
takes an `isBox` fast path whenever `sides===4 && orientation % 90 < 0.5 &&
distortion===0 && skew===0` (any right-angle orientation: 0, 90, 180, 270 — not
just 0), then calls `boxVertices(w, h)` (`poly-vertices.ts:48-55`), which
**unconditionally returns the 4 corners in a fixed
`[top-right, top-left, bottom-left, bottom-right]` order, ignoring
`orientation` entirely**. C's `isBox` branch (`lib/common/shapes.c:2077-2079`)
is reached from *inside* the general vertex loop: `vertices[0]` is still
computed via the full rotation formula (`alpha = RADIANS(orientation) +
atan2(...)`, `shapes.c:2244-2251`) before the remaining 3 corners are forced
symmetric relative to that (possibly-rotated) first vertex. For
`orientation` ∈ {90, 180, 270} this makes C start the point list from a
*different* corner than the port always does — same 4 points, same
rectangle (hence `structural-match`, not `diverged`), but the SVG
`points="..."` string lists them in a different cyclic order, producing a
large numeric `@points[N]` delta at the divergence point.

**Trigger in 1658.dot**: `node[shape="triangle",orientation=270]` (line 24)
sets a *lingering* node-attribute default; the following
`node[shape="box"]` (line 30) only overrides `shape`, so `orientation=270`
persists for any node **first declared afterward** — `Temp1`/`Temp2`/`Temp3`
(lines 55-57), but not `V1`/`V2`/`V3`/`GND` (declared at line 21, before the
`orientation=270` default existed). Confirmed directly: instrumented
`n.nodeDefaultsSnapshot.get('orientation')` returns `"270"` for
`Temp1`/`Temp2`/`Temp3` and `undefined` for `V1`-`V3`/`GND`; instrumented
`commonInitNode(n,g)` shows `Temp3`'s `shape_info.orientation === 270`
correctly, yet `shape_info.vertices` for `Temp3` is
`[(27.83,18),(-27.83,18),(-27.83,-18),(27.83,-18)]` — bit-for-bit the same
*corner order* as `GND` (`orientation:0`) at
`[(27,18),(-27,18),(-27,-18),(27,-18)]` — proving the rotation is dropped
between the correctly-stored `orientation` field and the emitted vertex
order.

**Origin**: `src/common/poly-vertices.ts:48-55` (`boxVertices`), dispatched
from `poly-vertices.ts:154-157`. Contrast: `lib/common/shapes.c:2077-2079`
(isBox branch inside the rotation-aware vertex loop, not a separate
axis-aligned shortcut).

**Ruled out**: attribute-default persistence (parser correctly threads the
lingering default — verified above); `orientation` not reaching the shape
descriptor (verified `shape_info.orientation === 270`); a rotation-formula
bug in the *general* (non-box) vertex path — `polygonVertices`/
`transformUnitVertex` (`src/common/poly-sizing.ts:215-256`) matches
`shapes.c:2220-2251` term-for-term (independently confirmed while
diagnosing sub-cluster 5 below); `splines=ortho` affecting node shape
emission — ruled out, `splines=` is an edge-routing-only attribute in both
C and the port, unrelated to `poly_init`/`computeVertices`.

---

## 3. star shape unported — decagon instead of a star (reference-star)

**Mechanism**: C's `shape=star` uses a **bespoke** vertex generator,
`star_vertices`/`star_size` (`lib/common/shapes.c:4039-4085`), registered via
its own `poly_desc_t star_gen` (`shapes.c:80-81,158-159`) — alternating
outer-radius (`r`) and inner-radius (`r0`) vertices to produce the classic
5-point star (10 vertices: 5 outer tips, 5 inner notches). The port's
`P_STAR` descriptor (`src/common/shapeData.ts:353-359`) sets
`vertices: null` with a comment claiming "star rendering is handled by
star_inside and poly_gencode" — but neither `poly-gencode.ts` nor
`poly-shapes.ts` contains any `star`-specific vertex logic (`grep -n star`
returns nothing in either file). With no dedicated generator, `sides=10,
regular=false` falls through to the generic regular-polygon path
(`polygonVertices`), which places all 10 vertices at the **same** radius —
a plain regular decagon.

**Evidence**: oracle polygon alternates far/near vertices around the
center — e.g. `(54,-31.74)` (far) then `(33.37,-31.74)` (near) then
`(27,-51.36)` (far) — the classic star silhouette. The port's polygon for
the same node is a near-perfectly-spaced 10-gon (`(48.84,-9.81)
(54,-25.68) (48.84,-41.55) ...`), all roughly equidistant from center.
maxDelta 25.68 at `@points[13]` (y of the 7th vertex, where the two shapes'
vertex angles diverge most).

**Origin**: missing port of `lib/common/shapes.c:4039-4085`
(`star_size`/`star_vertices`); `src/common/shapeData.ts:353` (`P_STAR`) is
the point where the port should dispatch to a bespoke generator instead of
falling through to the generic polygon path.

---

## 4. nested HTML table extra-space distribution unported (1622_3)

**Mechanism**: `1622_3.dot`'s node `green` is an HTML-label table with a
`FIXEDSIZE="TRUE" WIDTH="40" HEIGHT="32"` outer `<TD>` containing a nested,
unconstrained `<TABLE>` whose only cell has `WIDTH="8" HEIGHT="16"`. C
stretches the nested table to fill the fixed parent cell's available space
(`pos_html_tbl`, `lib/common/htmltable.c:1550`, "change sizes to start
positions and **distribute extra space**" at `htmltable.c:1600`) — oracle's
inner-table cell polygon spans x=17→45 (28pt, filling most of the 34pt
inner-border box). The port's nested-table placement sizes the inner table
to its own minimum requested content (17→30, 13pt) and never distributes the
FIXEDSIZE parent's spare width into it.

**Evidence**: `svg/g[1]/g[1]/polygon[2]` (innermost cell rectangle) —
oracle right edge x=45, port right edge x=30, delta 15 exactly at
`@points[4]`; the containing `polygon[1]` (outer 40×32 fixed cell) matches
exactly, confirming the divergence is isolated to the nested table's
internal distribution, not the outer cell sizing.

**Origin**: `lib/common/htmltable.c:1550-1600` (`pos_html_tbl`, extra-space
distribution step) — unported. This was already flagged as a predicted,
not-yet-triggered residual in
`.agent-notes/html-nested-table-and-port-gap.md`: *"Nested-table extra-space
distribution (C pos_html_tbl) not ported — corpus cases have delx≈0
(single-cell columns) so it's a no-op; add if a stretched nested table
appears."* `1622_3` is exactly that predicted stretched-nested-table case.

---

## 5. rotated 4-gon (diamond) ellipse-fit sizing is float-sensitive (polypoly ×3)

**ids**: `share-polypoly`, `windows-polypoly` (byte-identical mirrors, same
maxDelta 10.36), `graphs-polypoly` (maxDelta 6.55, smaller because this copy
has no `ratio=fill`/`page=` scaling — see below).

**Mechanism**: all three ids' worst vertex is on the **same node**, `9011`
(`sides=4, orientation=45.`, label `"M"` — i.e. C's `p_diamond`-shaped
config, NOT the `isBox` fast path since `45 mod 90 = 45`, well outside the
`<0.5` tolerance). Both the rotation math
(`polygonVertices`/`transformUnitVertex`, `src/common/poly-sizing.ts:215-256`)
and the non-box ellipse-fit sizing formula (`expandForShape`,
`poly-sizing.ts:164-185`) were checked term-for-term against
`shapes.c:2085-2101` (ellipse-containing-bb expansion) and
`shapes.c:2220-2251` (rotate/scale loop) and match exactly. The rendered
diamond is an internally-consistent, correctly-alternating square (not
distorted), but its **overall size differs**: half-diagonal 46.52pt
(oracle) vs 37.64pt (port), a ratio of ~1.24×. Because node 9011 has no
explicit `width=`/`height=` override, its `bb` input to `expandForShape` is
driven entirely by the "M" label's measured `dimen` versus the *default*
node height (36pt) — and `expandForShape`'s spare-height branch,
`bb.x *= sqrt(1/(1-(bb.y/height)^2))`, is **numerically sensitive**: small
upstream differences in `dimen.y` are non-linearly amplified as
`bb.y/height` approaches 1. A tiny (sub-point) upstream rounding difference
in label `dimen` therefore surfaces as a 10-18pt vertex delta only on this
specific unconstrained-diamond node, while nearby box/circle nodes in the
same 150-node graph show only 0.01-0.03in (≈1-2pt) drift (visible directly
in the `share/` vs `graphs/` `.gv` fixture `width=`/`height=` deltas).

**share/windows vs graphs delta difference**: `share-polypoly.gv`/
`windows-polypoly.gv` are a re-fed, prior-run snapshot carrying
`ratio=fill; size="7,9.5"; page="8.5,11"` plus baked per-node
`width=`/`height=`/`pos=` hints (a different input shape from
`graphs-polypoly.gv`, which is the clean, un-laid-out source with those
attrs commented out). Despite this, **node 9011 is the worst-diverging
node in all three** — ruling out `ratio=fill`/page-tiling scale-factor
divergence as the primary cause (initially suspected, since 10.36 vs 6.55
looked like a plausible global-scale artifact); the `ratio=fill` config
only mildly amplifies the same underlying per-node sizing sensitivity.

**Origin**: `src/common/poly-sizing.ts:164-185` (`expandForShape`) is the
amplification site; exact upstream numeric source of the small
pre-amplification `dimen`/height delta is **not yet pinned** (candidates:
label `dimen.y` rounding, or a `DEFAULT_NODEHEIGHT`/quantization difference)
— tractability is `needs-C-instrumentation`, not `known-mechanism`.

**Ruled out**: rotation-formula error (verified exact match against
`shapes.c:2220-2251`); ellipse-fit formula itself wrong (verified exact
match against `shapes.c:2085-2101`); `ratio=fill`/page-scale divergence as
the *primary* driver (same node 9011 dominates with and without
`ratio=fill`, so a global scale-factor bug would not explain the
graphs-polypoly-without-ratio=fill case).

---

## 6. constraint=false edge under concentrate+curved routes very differently (1453)

**Mechanism**: `1453.dot` uses `concentrate=true` + `splines=curved` with
several `constraint=false` back-edges. The worst vertex,
`svg/g[1]/g[38]/polygon[1]`, is the **arrowhead** of edge **`edge24`**
(`CMD_POST_WRAP_COPY -> CMD_BEGIN`, declared with `constraint="false"` in
the DOT source). C's oracle path for this edge is a near-straight
horizontal curve (`M140.45,-143C293.44,-143 295.43,-143 645.48,-143` — y
essentially constant at -143), while the port routes it as a long diagonal
arc through 3 different y-levels
(`M199.1,-123.84C303.39,-92.18 346.26,-93.71 565.12,-128.41`). This is the
*same class* of divergence already root-caused (but only partially fixed)
for `1213`/`1213-2` in `.agent-notes/1213-constraint-false-spline-divergence.md`
and the active `plans/fix-1213-splines/` mission: nodes/ranks match
byte-for-byte between port and oracle; the entire divergence is confined to
`constraint=false` edges' spline control points. `plans/fix-1213-splines/decisions.md`
(AD-2) already scopes the fix to "how `constraint=false` edges are
classified, how their routing boxes/corridors are built, or [...] the spline
fitter" — the exact stage is still open per that mission's own diagnosis
batch.

**Ruled out**: this is not a new/independent arrowhead-geometry bug — the
arrowhead itself (`arrowhead-geometry-done` per memory) is a full,
previously-verified port; the divergence traces entirely to the upstream
edge *path*, and the arrowhead is simply attached to that wrong path.
`concentrate` merge/trunk routing (separately verified DONE per memory
`concentrate-trunk-2559-done`) is not implicated — `edge24` is not part of a
merged trunk in this graph.

**Tractability**: `needs-C-instrumentation` (mechanism narrowed to the same
subsystem as 1213, but the exact routing stage — classification vs.
corridor-construction vs. fitter — is an open question in the active
`fix-1213-splines` mission, not yet resolved there either).

---

## 7. setlinewidth-styled edge arrowhead, small residual (graphs-style)

**ids**: `graphs-style` (maxDelta 2.70 — the smallest in this bucket).

**Worst vertex**: `svg/g[1]/g[11]/polygon[1]` — the arrowhead of edge
`a->e`, styled `style="setlinewidth(3)"` (an old-style PostScript-emulation
pen-width keyword, distinct from the modern `penwidth` attribute). Both
endpoint node `e` and the edge itself carry `setlinewidth(3)` with no
explicit `penwidth=` attribute.

**Hypotheses tested and ruled out**:
1. *Arrow-clip formula reads the wrong penwidth.* C's arrow clip
   (`lib/common/arrows.c:257`, `late_double(e, E_penwidth, 1.0, 0.0)`) and
   node-boundary clip (`shapes.c` `poly_init`, same `late_double` pattern)
   read the **`penwidth` attribute only** — `style=setlinewidth(N)` is
   resolved into an effective pen width solely inside `stylenode`
   (`shapes.c:531`), which is called only from `poly_gencode` (render/emit
   time, `shapes.c:2953`), never from layout. The port mirrors this split
   exactly: `resolvePenWidth` (which *does* fold in `setlinewidth`,
   `src/common/style-resolve.ts:261-272`) is used only from render-side
   call sites (`src/gvc/device.ts:205`, `src/gvc/device-cluster.ts:77`,
   `src/common/poly-gencode.ts:320`); layout-time node penwidth
   (`src/common/nodeinit.ts:153`, `lateDouble(nodeAttr(n,g,'penwidth'), 1.0,
   0.0)`) is attribute-only, exactly like C. No conflation found.
2. *Arrow length/shortening formula itself.* Not investigated further given
   (1) already rules out the most likely divergence path and the residual
   is the smallest in the bucket.

**Tractability**: `needs-C-instrumentation` — mechanism not yet pinned;
the two most likely hypotheses (arrow-clip penwidth source, and
setlinewidth/penwidth conflation) are both ruled out by direct code
inspection, so the residual is either a genuine small edge-routing/rank-
spacing rounding difference from mixed pen widths on sibling nodes in the
same rank, or something not yet considered. No `ref` — this is the first
observation of this specific residual (not previously noted in
`.agent-notes/`).

---

## Summary

`polygon-points: 14 cases → 7 sub-clusters; 12 attributed (known- or
needs-C-instrumentation with a named mechanism), 2 with an open exact-locus
question (polypoly's upstream rounding source; 1453/style's precise routing
stage) but 0 fully NOVEL/unattributed; top candidate = self-loop-label-bbox
(6)`.

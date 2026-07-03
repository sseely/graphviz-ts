# structural-match bucket: canvas-extent

| sub-cluster | ids | count | family | tractability | ref |
|---|---|---:|---|---|---|
| accepted-A4-oracle | 1435, 2796 | 2 | A4-oracle | accepted-portability | test/corpus/accepted-divergences.json (id 1435, id 2796); docs/known-divergences.md#a4-oracle-in-an-acknowledged-broken-state-the-init_rank--pathplan-family |
| **1314-numeric-overflow** | **1314** | **1** | **numeric-overflow** | **accepted-portability** | gvcjob.h:327-328 (`unsigned int width/height`) + emit.c:1249-1250 (`ROUND(...)`) + gvrender_core_svg.c:258-259 (`%d`) |
| self-loop-label-bbox | graphs-sl_circle, graphs-sl_circle_dbl, graphs-st_circle, graphs-st_circle_dbl | 4 | bbox-margin | known-mechanism | lib/dotgen/dotsplines.c:401-408 vs src/layout/dot/splines-groups.ts:90-95 |
| node-size-zero-clobber | regression_tests-shapes-reference-plain | 1 | shape-extent | known-mechanism | src/layout/dot/init.ts:238-240 vs lib/dotgen/dotinit.c:45-56 |
| html-fixedsize-table-zero-dimen | 1622_2 | 1 | shape-extent | known-mechanism | src/common/htmltable.ts:426-430 vs lib/common/htmltable.c:1676-1690 |
| b57-cross-axis-margin-shift | graphs-b57 | 1 | NOVEL | needs-C-instrumentation | — |
| 2613-point-rankgap | 2613 | 1 | NOVEL | needs-C-instrumentation | — |
| 2734-fp-rounding-residual | 2734 | 1 | NOVEL | needs-C-instrumentation | — |

canvas-extent: 12 cases → 8 sub-clusters; 9 attributed, 3 novel;
top candidate = bbox-margin (self-loop-label-bbox, 4)

---

## 1314 — numeric-overflow (own row, flagged prominently)

**This is a real, confirmed C-oracle bug, not a port defect — and the port's
divergence from it is a deliberate, documented non-goal, not an accidental
miss.**

`1314.dot` is a fuzzer-derived regression input (`fontsize="991836031967s8"` on
node `s`) that upstream C fixed *only* in the Pango plugin
(`4ba76b984` "fix: cast overflow with large font sizes in Pango plugin", closes
graphviz#1314). The headless/estimate build path (no Pango) still hits a
**separate, still-present** integer-overflow bug in the *emission* layer:

- `lib/common/emit.c:1249-1250` computes
  `job->width = ROUND((pageSize.x + 2*margin.x) * job->dpi.x / POINTS_PER_INCH)`
  from `double` pageSize (here ~2.75e11pt, driven by the fuzzed fontsize
  cascading through ellipse/edge-length sizing — C itself prints
  `Error: Edge length 272931242864.483337 larger than maximum 2147483647
  allowed` to stderr but continues rendering).
- `lib/gvc/gvcjob.h:327-328` declares `job->width`/`job->height` as
  `unsigned int` (32-bit) — the `ROUND()` result silently wraps mod 2^32 on
  assignment (implementation-defined truncation, not part of the graphviz
  algorithm).
- `plugin/core/gvrender_core_svg.c:258-259` emits `<svg width="%d" height=
  "%d">` — the signed `%d` format re-interprets the wrapped unsigned bit
  pattern, so a value ≥ 2^31 prints negative.

Verified numerically: the port's mathematically-consistent (unwrapped) width/
height are `275078726501` / `1683201561689`. `275078726501 mod 2^32 =
200819557` (matches C's emitted width exactly) and `1683201561689 mod 2^32 =
3869348953`, which as a signed 32-bit int is `-425618343` (matches C's emitted
`height="-425618343"` exactly, sign and all). **Every other value in the two
SVGs — node ellipse cx/cy/rx/ry, the internal `translate(...)`, the polygon,
the text `font-size` — is byte-identical between the port and C.** Only the
top-level `<svg width= height= viewBox>` triple diverges, and it diverges by
exactly the 32-bit-wraparound amount.

**Mechanism:** C's `unsigned int` `job->width/height` fields overflow (mod
2^32) when a node's pixel bbox exceeds ~2^31 points; the TS port stores
width/height as IEEE-754 `number` (no 32-bit truncation) and therefore does
not reproduce the wraparound.
**Origin:** `lib/gvc/gvcjob.h:327-328` (field type) + `lib/common/emit.c:1249-
1250` (unguarded cast) + `plugin/core/gvrender_core_svg.c:258-259` (`%d`
format reads the wrapped bits as signed).
**Causal chain:** garbage fontsize → node ellipse rx/ry balloon to ~2.7e11pt →
`pageSize` balloons → `ROUND()` produces a double far outside `[0, 2^32)` →
C's `unsigned int` assignment wraps mod 2^32 → `%d` print of the wrapped value
reads negative when the wrapped bit pattern's high bit is set.
**Ruled out:** font-size *parsing* mismatch (both sides read
`991836031967.00` identically, confirmed byte-for-byte in the SVG `font-size`
attribute) — ruled out by direct string comparison of the two `<text>`
elements. Layout/geometry divergence — ruled out; every node/edge/label
coordinate matches to the last decimal.
**Tractability:** `accepted-portability`. Reproducing this C bug faithfully
would require reintroducing 32-bit integer truncation into the port's
canvas-size arithmetic, which is a language-level UB/platform artifact below
the specified algorithm, not part of the graphviz layout spec — not yet
present in `accepted-divergences.json`; recommend adding an entry once this
mission's fix window closes.

---

## accepted-A4-oracle (1435, 2796)

Both ids are already present in `test/corpus/accepted-divergences.json` with
`class: "A4"` and cross-referenced in `docs/known-divergences.md`. `1435` is
an acknowledged-broken pathplan/triangulation-fallback input (upstream xfail
#1435; debris from `warn-and-continue` differs numerically, 11/11 edges
present both sides). `2796` is oracle-recovery-state noise from a known-broken
`init_rank` cycle (upstream xfail #2796; the port's own stale-cluster-window
bug was already fixed, so both sides now agree on which edge gets dropped
during recovery — remaining Δ49 is recovery-state numeric noise). Per the
mission brief instruction, not chased further; verified by reading the
`accepted-divergences.json` entries directly (not re-derived).

## self-loop-label-bbox (graphs-sl_circle, graphs-sl_circle_dbl,
   graphs-st_circle, graphs-st_circle_dbl)

**Dimension:** width for `sl_*` (self-loops exiting left of the node: ports
`nw/w/sw`), height for `st_*` (self-loops exiting the top: ports `ne/n/nw`).

**Mechanism:** `lib/dotgen/dotsplines.c:401-408` — immediately after
`makeSelfEdge(...)` routes a self-loop group, C loops the group and calls
`updateBB(g, ED_label(e))` for every labeled self-edge, growing the graph's
bounding box to include the label. The TS port's `dispatchEdgeGroup` (`src/
layout/dot/splines-groups.ts:90-95`) calls `routeSelfEdgeGroup(...)` and
`return`s immediately — it never calls the TS `updateBB` equivalent
(`src/layout/dot/splines-label.ts:298`) for self-loop labels. The existing
port function `placeRegularEdgeLabels` (`splines-label.ts:324-332`, ported
from the *different* C loop at `dotsplines.c:422-430`) only walks *virtual*
nodes — self-loops have no virtual node, so this gap is not covered by any
other call site (confirmed by grepping every `updateBB` call site in `src/`).

**Why this shows up as canvas-extent, not spline-position:** C's
`position.c` ranking pass only reserves extra node width via `selfRightSpace`/
`ND_rw` for self-loops that render on the **right** (see the `position.c:236`
"FIX: dot assumes all self-edges go to the right" comment; confirmed —
`selfRightSpace`/`goesRight` returns 0 for left/top-going loops). So for
left/top self-loops the *only* mechanism that ever grows the canvas is this
post-routing `updateBB` call — there is no ranking-time compensation to fall
back on. Missing it means the graph's `bb.LL`/`bb.UR` under-counts by the
label's half-height (top) or full label extent (left), which either shortens
the reported height (`st_*`, Δ17 in both variants — confirmed by diffing
`translate()`/polygon values: C polygon top edge sits exactly `label.pos.y +
dimen.y/2` beyond the label's already-identical SVG `<text y>` value, the port
stops at the label's `y` baseline) or shifts **every single node's absolute
x-coordinate** by a constant amount (`sl_*`, confirmed: all 21/22 nodes in
`sl_circle`/`sl_circle_dbl` shift by exactly `142.92`/`267.9x`pt — a uniform
translation, not a layout difference, because the coordinate-normalizing
`translate` step shifts everything by `-bb.LL.x`, and `bb.LL.x` is less
negative in the port).

**Verification:** every node ellipse cx/cy, every self-loop bezier control
point, and every label `<text>` x/y position are byte-identical between C and
the port for `st_circle` (confirmed via full-file coordinate diff) — the ONLY
divergence is the top-level canvas size and the resulting uniform coordinate
shift. This rules out a routing/geometry bug in `selfLeft`/`selfTop`/`topDx`
(independently cross-checked term-by-term against `lib/common/splines.c` —
all match).
**Ruled out:** `selfRightSpace` GD_flip dimension bug (already fixed per
`.agent-notes/selfedge-space-flip-dimension.md` — that fix was about
rankdir=LR self-loop *width* growth during ranking; these 4 ids are default
TB, so `flip=false`, that code path is inert here). `t5-post-routing-label-
gap` fix (`placeRegularEdgeLabels`) — ruled out by construction: that loop
walks `VIRTUAL` nodes only; self-loop labels attach directly to the edge, no
virtual node exists.
**Tractability:** `known-mechanism` — a single missing call in
`dispatchEdgeGroup`'s self-loop branch (mirroring the C loop at
`dotsplines.c:404-408`), not a broader systemic gap.

## node-size-zero-clobber (regression_tests-shapes-reference-plain)

**Dimension:** both (canvas 62×44pt vs C's 8×8pt — the port renders as if the
node used the *default* 0.75in×0.5in box).

**Mechanism:** `src/layout/dot/init.ts:238-240`:
```
if (!n.info.lw) n.info.lw = 27;
if (!n.info.rw) n.info.rw = 27;
if (!n.info.ht) n.info.ht = 36;
```
`dotInitNodeEdge` (`init.ts:363-364`) calls `commonInitNode(n, g)` **first**
(which, per `src/common/poly-sizing.ts:108` `initialSizePts`, correctly
computes `lw=rw=ht=0` for `shape=plain` — `IS_PLAIN` in C, `p.isPlain` in the
port), then calls `dotInitNode(n)`, whose falsy-zero guards misfire: JS
`!0 === true`, so a **legitimately-computed zero** (a real, intentional
0-size node) is treated the same as "field never set" and clobbered back to
the DOT default box size. C's actual `dot_init_node` (`lib/dotgen/dotinit.c:
45-56`) has **no such fallback at all** — it calls `common_init_node(n)` +
`gv_nodesize(n, GD_flip(...))` and nothing else; there is no C code path that
re-defaults a node's size after `common_init_node` has set it.

**Verification:** isolated the DOT attribute set to bare minimum
(`shape=plain; width=0; height=0; label=""`, no `graph[bb=...]`, no
`pos=`) — reproduces identically (62×44 vs 8×8), ruling out the `pos=`/`bb=`
attrs (round-tripped `-Tplain` artifacts in the original file) as a factor.
**Ruled out:** shape lookup/registration — `bindShape('plain')` correctly
resolves to the `P_PLAIN` descriptor (`isPlain = shape.name === 'plain'` is
true); confirmed by reading `src/common/shapes.ts:88` and `bindShape`.
Label-content fallback (`label="" ?? n.name`) — ruled out; both C and port
render the node body with **zero visible marks** (no `<ellipse>`, no
`<text>`), confirming `label=""` was honored on both sides and the node
itself renders identically — the divergence is purely in the *unrendered*
sizing fields that drive canvas/bbox math.
**Tractability:** `known-mechanism` — the fix is to replace the three
`if (!n.info.X)` falsy guards with explicit `n.info.X === undefined` checks
(the exact `calloc-zero-vs-undefined-port-hazard` pattern already recorded in
project memory, applied in the opposite direction here).

## html-fixedsize-table-zero-dimen (1622_2)

**Dimension:** both (canvas 62×44pt vs C's 236×176pt — again exactly the
default 0.75in×0.5in node box + margin, same symptom shape as the plain-node
case but a different origin).

**Mechanism:** `src/common/htmltable.ts:415-431` (`sizeTableInner`, ported
from `lib/common/htmltable.c:size_html_tbl`):
```
const fw = isTblFixed(tbl) ? 0 : Math.max(wd, baseWd);
const fh = isTblFixed(tbl) ? 0 : Math.max(ht, baseHt);
tbl.dimen = { w: fw, h: fh };
```
`1622_2`'s outer `<TABLE ... WIDTH="212" HEIGHT="160" FIXEDSIZE="TRUE">`
sets `isTblFixed(tbl) = true`, so the port sets `tbl.dimen = {w:0, h:0}` —
literally zero — for a table that is explicitly 212×160. C's actual
`size_html_tbl` (`lib/common/htmltable.c:1676-1690`) only zeroes the
**content-derived** `wd`/`ht` locals inside the `FIXED_FLAG` branch (after
optionally warning if the fixed size is too small for the content); it then
unconditionally computes `tbl->data.box.UR.x = fmax(wd, tbl->data.width)`
**outside** that branch — with `wd` zeroed, this evaluates to
`fmax(0, tbl->data.width) = tbl->data.width` (212), not 0. The port's version
short-circuits the whole `Math.max(...)` expression to the literal `0`,
dropping the `baseWd`/`baseHt` (`tbl.width`/`tbl.height`) term entirely in the
fixed-size branch.

Because `label.dimen = label.table.dimen` (`htmltable.ts:449`) feeds directly
into `polySizeParamsFromNode`'s `labelDimen` param, a zero table dimen sizes
the node down to the shared default-box fallback (54×36 + 8pt margin = the
observed 62×44) even though the **separate** cell-placement pass
(`layoutHtmlTable`/`posHtmlLabel`, which does not consult `tbl.dimen`) still
lays out every cell/text correctly — confirmed: the port's `<text>` elements
are positioned up to `y=163.6` (i.e. the full 160pt table height, just
translated relative to a wrongly-small node/canvas origin), while the
declared canvas is only 44pt tall. This is why the render is *structurally*
identical (no missing/extra elements) but the canvas undercounts.

**Ruled out:** cell-recursion/nested-table placement bug from
`.agent-notes`/memory `html-nested-table-ports-done` — ruled out; that fix
already landed and covers *nested* `<TABLE>`-in-`<TD>` placement, not the
outer table's own `FIXEDSIZE` dimen computation, and 1622_2's cell content
here is plain text/nested tables that size correctly (their relative
positions match C exactly). HTML port-resolution stub
(`html_port`/`htmlPortStub`) — ruled out, not exercised (no port-addressed
edges in this file).
**Tractability:** `known-mechanism` — `sizeTableInner` needs the C sequence
restored: zero the content-derived `wd`/`ht` under `FIXED_FLAG`, *then* take
`Math.max(0, tbl.width)`/`Math.max(0, tbl.height)`, instead of discarding
`baseWd`/`baseHt` outright.

## b57-cross-axis-margin-shift (graphs-b57) — NOVEL

`rankdir=LR`, mixed `shape=ellipse`/`shape=record` nodes, no self-loops, no
xlabels, no graph-level `margin`/`pad` attrs. Height (cross-rank axis) is
short by a uniform 20.78pt for **every** node (confirmed: all 28 sampled node
`cy` values differ from C by exactly `20.78`/`20.779999999999973`pt — a
whole-graph translation, same *signature* as the self-loop family but with no
self-loop present to explain it). The record-shaped node's own box height is
byte-identical between C and the port (`node2`: 49.6pt both sides), ruling out
a record-sizing bug as the direct cause. No `pad`/`margin` graph attrs are set
in this file, ruling out the `pad-size` family (`path-structure-bucket-done`
mechanism). No self-loops exist, ruling out the `self-loop-label-bbox`
mechanism just diagnosed above.
**Ruled out:** self-loop-label-bbox (no self-edges in this graph — grepped
the `.gv` source); record-box own height (identical 49.60pt span both sides);
graph `pad`/`margin`/`size`/`ratio` attrs (none set in this file).
**Tractability:** `needs-C-instrumentation` — the uniform-shift signature
strongly suggests another `GD_bb`-growth call is missing for *some* single
extremal node/element under `rankdir=LR` with mixed record/ellipse shapes,
analogous in shape to the self-loop bug but not yet isolated to a specific
call site; would need a C-side `GD_bb` trace (env-var breakpoint dump per
`.agent-notes` "recover_slack + C oracle harness" recipe) to pin the exact
contributing element.

## 2613-point-rankgap (2613) — NOVEL

`rankdir=LR`, `shape=point` nodes with `height="0.025"` (tiny), tiny
`fontsize="4"`/`fontsize="5"` labels/xlabels, edge label `label="edge01"`.
Isolated by removing `xlabel` attrs (still diverges: 277 vs 417 unscaled) and
by removing `ratio=compress`/`size=16,9!` entirely (still diverges even in
the plainest form: raw unscaled height 15pt (C) vs 22pt (port), translate y
10.9 vs 18.44). Node ellipse radius is byte-identical (`rx=ry=0.9` both
sides, confirmed — `shape=point` sizing itself is not the bug). The
divergence is a uniform vertical **rank-gap** difference: every node's `cy`
and the edge label's relative offset shift by the same ~3.3–7.5pt depending
on which reduction is tested, always *above* the point nodes.
**Ruled out:** xlabel bbox growth (removed the attr entirely, divergence
persists unchanged in kind); `ratio=compress`/`size=` scaling math (removed
entirely, raw pre-scale layout still diverges, so the bug is upstream of any
scaling step); point-node radius/size (`rx`/`ry` identical both sides).
**Tractability:** `needs-C-instrumentation` — mechanism looks like a rank-
separation/margin computation difference specific to very small
(`height<MIN_NODEHEIGHT`-adjacent) point nodes combined with an edge label,
but pinning the exact contributing term (nodesep vs ranksep vs label-vnode
height) needs a C-side rank-height trace, which is out of scope for this
diagnosis-only pass.

## 2734-fp-rounding-residual (2734) — NOVEL

maxDelta = 1pt (the smallest in the bucket). Every node's y-coordinate is
offset from C by a small constant `≈0.27`pt (confirmed: 15+ sampled nodes all
show `0.27`/`0.270000000000001`pt, not scattered noise). The DOT source
contains float-repr artifacts baked into node `height` attrs (e.g.
`height=1.7999999999999998`), consistent with a rounding/accumulation
difference across several ranks rather than a single misapplied constant.
**Ruled out:** self-loop-label-bbox / node-size-clobber / html-table-dimen
families (this graph has no self-loops, no zero-size nodes, no HTML labels —
grepped the `.gv` source; all node heights are non-zero box shapes).
**Tractability:** `needs-C-instrumentation` — magnitude (≤1pt) and uniform-
but-non-constant-looking (`0.27` vs `0.270000000000001`, suggesting FP
accumulation, not a single missed term) point toward a `Math.round`/rank-
height rounding-mode difference in the vein of the already-fixed
`root_twopi maximal_bbox round MODE` and `long-edge undersegment` families,
but for the **dot** ranksep/interrank height accumulation path specifically —
not yet isolated to a specific call site in this diagnosis-only pass.

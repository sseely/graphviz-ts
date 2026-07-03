# T2 — 1879 bbox + translate-x divergence — diagnosis

## Mechanism
The graph attribute `pad=2` (2in -> 144pt) is never read anywhere in the
port. `SVG_PAD` is a hardcoded module constant (`= 4`, the C
`DEFAULT_GRAPH_PAD`/no-`pad`-set fallback) used unconditionally for every
bbox/viewport/translate computation, so a graph that sets `pad=` gets the
un-set default instead. C computes `gvc->pad.x = gvc->pad.y = 144` from
`agget(g,"pad")` and applies that; the port always applies 4. This inflates
C's padded content box by `144-4=140pt` on every side (280pt on each axis
total), which propagates through the `size="150,150"` scale-fit computation
into a different zoom factor, and from there into every reported width /
height / translate value.

## Origin
- C: `lib/common/emit.c:3241-3251` (`init_job_pad` graph-attr read,
  `pad="x,y"` or single float via `sscanf("%lf,%lf")`, `xf*POINTS_PER_INCH`)
  and `lib/common/emit.c:3290-3304` (`init_job_pad` — applies
  `gvc->pad` when `graph_sets_pad`, else `DEFAULT_GRAPH_PAD` = 4,
  `lib/common/const.h:96`).
- Port: `src/render/svg-helpers.ts:52` — `export const SVG_PAD = 4;`
  (hardcoded, no attribute read anywhere: `grep -rn '"pad"' src/` = 0 hits).
  Consumed as a fixed constant in `src/gvc/viewport.ts:108-117`
  (`initJobViewportZoom`, the direct port of `emit.c:3356` `init_job_viewport`
  — uses `SVG_PAD` where C would use the graph-attribute-derived
  `job->pad`) and in `src/render/svg-graph.ts:70-71,165-168,188-191,
  206-209,331-332` (bbox/viewBox/polygon/translate emission).

## Causal chain
1879.dot sets `pad=2` at the graph level. In C, `init_job_pad` resolves this
to 144pt and every downstream computation (`init_job_viewport`'s zoom-fit
`sz = bb + 2*pad`, and `emit.c`'s viewBox/polygon/translate emission) uses
144. The port's `initJobViewportZoom` and `svg-graph.ts` unconditionally use
the constant `SVG_PAD=4` regardless of what `pad=` says, so the port's
padded content box is 280pt smaller (140pt/side x 2 axes) than C's in both x
and y before the `size=150,150` scale-fit is applied. Because the scale
factor is `min(sizeX/szx, sizeY/szy)`, a smaller `szx`/`szy` produces a
*larger* scale factor for the port (0.432456) than for C (0.427661) — this
non-uniform effect on the fitted scale is why the final reported width delta
(115pt) and height delta (220pt) are NOT equal even though the *raw*
pre-scale content+pad box differs by exactly 280pt on both axes. Verified
precisely: raw background `<polygon>` extents (pre-`scale()` transform,
straight from the two SVGs) are `C: -144..25109.63 (w=25253.63), y -3242..144
(h=3386)` vs `port: -4..24969.63 (w=24973.63), y -3102..4 (h=3106)` — width
delta 280.00 and height delta 280.00, both exact to the hundredth, matching
`2*(144-4)=280` on the nose. This is what produces the reported top-level
`translate(278.69,3376.69)` (C) vs `translate(4,3102)` (port) discrepancy —
the port's translate is close to its own (wrong) `SVG_PAD=4` baseline, C's
reflects its actual 144pt pad.

## Ruled out
- **Node/cluster mis-placement (ranking or x-coord NS).** All node and
  cluster `<polygon>`/`<ellipse>` raw coordinates are byte-identical between
  C and port (`flat-geom-diff.mjs` reports `0.00` delta for every node and
  cluster title in this corpus; independently confirmed cluster boxes
  `cluster_74x75`, `cluster_52x51` etc. match exactly). Ranking/NS are not
  implicated for the bbox delta.
- **Graph label / margin attribute.** The `label=` text element position
  (`x="12482.82" y="-3081.4"`) is identical between C and port; `margin=0.8`
  is a *separate* graph attribute (already read elsewhere; not implicated in
  the raw-content-box delta since content-box coordinates outside pad match
  exactly. The residual 115/220 *final* (post-scale) width/height deltas
  attributable to `margin` were not separately decomposed — this note only
  needed to isolate the *raw* pad-driven 280/280 to pin the mechanism, which
  it does unambiguously).
- **Compound-edge clip algorithm bug (`src/layout/dot/compound.ts`).** A
  *separate, real* residual exists: 36 `ltail=`-tagged edges in this corpus
  (`couple_X -> node_Y [ltail=cluster_X]`) diverge with either large
  per-point coordinate deltas (worst: 875.68, `couple_74x75->node_20x21_21`)
  or a differing retained-segment count (`COORD-COUNT` signature, e.g.
  C=20/port=14 raw numbers = 10/7 points = 3/2 bezier segments). Traced
  `compound.ts`'s `boxIntersectf`/`splineIntersectf`/`clipHeadNormal`/
  `clipTailNormal`/`clipHeadDegenerate`/`clipTailDegenerate` line-by-line
  against `lib/dotgen/compound.c:29-72` and `:280-420` — side-check order
  (left, right, bottom, top), `Math.round`/`round` usage, degenerate-vs-
  normal branch selection (`inBoxf(bez->list[endi], bb)` — confirmed this
  correctly checks the *far* end of the spline, not a naming-confused near
  end, matching C exactly), and loop/index arithmetic (`starti -=3`,
  `endi -= 3`, `arrowStartClip`/`arrowEndClip` call sites) all match C
  verbatim. Because every affected edge has `ltail=` and every *unaffected*
  ltail edge (same-cluster short edges) matches exactly, and because the
  algorithm doing the clip is byte-faithful, the divergence must be in the
  **raw, pre-clip spline** fed to `makeCompoundEdge` for long/multi-rank
  chain edges (evidenced further: the un-clipped end of every diverged edge
  matches C exactly, e.g. `couple_74x75->node_20x21_21`'s head point
  `8347.94,-851.57` is byte-identical; only the clipped/tail end differs).
  This traces into edge-chain/spline-fitting code
  (`src/layout/dot/edge-route-chain.ts`, `edge-route-faithful.ts`,
  `splines-route.ts` — none of which are T2's or another Batch-1 task's
  declared ownership) and was **not pursued further** — out of scope for
  T2 (owns `src/render/*`/`src/common/emit*` only) and not the primary
  driver of the reported bbox/translate-x symptom (confirmed above: pad is).
  This is flagged as a distinct, tracked-deep follow-up, NOT folded into the
  pad fix.

## Fix target
```
{ fixTarget: "src/render/svg-helpers.ts :: SVG_PAD (hardcoded const) ->
    src/gvc/viewport.ts :: initJobViewportZoom + src/render/svg-graph.ts
    (bbox/viewBox/polygon/translate emission)",
  writeSet: [
    "src/render/svg-helpers.ts",
    "src/gvc/viewport.ts",
    "src/render/svg-graph.ts",
    "src/gvc/job.ts (or wherever RenderJob is constructed from a Graph,
      to add a per-job pad value read from g.attrs.get('pad'))"
  ],
  sharedMechanismWith: [],
  expectedVerdictDelta: "1879: diverged -> improved (bbox/translate should
    match; the separate ltail-clip raw-spline residual will likely keep
    1879 short of conformant -- re-triage after the pad fix lands)",
  classification: "shallow-fixable" }
```

Fix shape: port C's `init_job_pad` (`emit.c:3241-3251`) — read `g.attrs.get
('pad')`, parse as `"x[,y]"` (POINTS_PER_INCH=72 per unit, y defaults to x
when only one value given), else fall back to the existing default (4pt,
matching `DEFAULT_GRAPH_PAD`/SVG plugin `default_pad`). Thread the resolved
`{x,y}` pad value through `initJobViewportZoom` and `svg-graph.ts` in place
of the `SVG_PAD` constant (constant stays as the *default*, but must become
overridable per-job/per-graph, not a hardcoded global).

## Secondary tracked-deep finding (not this task's fix target)
`ltail=`/`lhead=`-clipped long-chain edges (36 of 348 in 1879) have a
raw-spline (pre-`makeCompoundEdge`) discrepancy vs C, isolated to edge-chain/
spline-fitting code outside T2's ownership. `compound.ts`'s clip algorithm
itself is verified byte-faithful (see Ruled-out). Needs a dedicated
diagnosis task instrumenting `edge-route-chain.ts`/`edge-route-faithful.ts`/
`splines-route.ts` (dump pre-clip `bez.list` vs a C oracle trace) — not
owned by T1 (rank), T3 (1447/ortho), or T4 (NS) in this batch.

## Fix record (F2)

Fixed: ported `init_job_pad`/`init_gvc`'s `pad=` attribute parse
(`parseGraphPad`, `src/gvc/viewport.ts`), threaded the resolved `{x,y}`
through `RenderJob.pad` (set in `src/gvc/device.ts:render()` before the
`size=` zoom-fit computation, matching C's call order `init_job_pad` →
`init_job_viewport`) and replaced every hardcoded `SVG_PAD` use in
`src/render/svg-graph.ts` (bbox/viewBox/background-polygon/gradient-polygon/
group-translate emission) with `job.pad.x`/`job.pad.y`. `SVG_PAD` remains the
default-value constant (still consumed by `parseGraphPad`'s fallback branch
and by tests that construct `RenderJob` directly, bypassing `render()`).

**Verified (native dot 15.1.0 oracle, `GVBINDIR=/tmp/ghl`):**
- `digraph G { pad="2"; a -> b }` — port now byte-matches C exactly:
  `<svg width="342pt" height="396pt">`, `translate(144 252)`, and the
  background `<polygon>` extents.
- No-`pad=` baseline (`digraph G { a -> b }`) unchanged byte-for-byte
  (`width="62pt" height="116pt" translate(4 112)`) — confirms D5 (non-pad
  graphs stay byte-identical).
- 1879.dot: raw background `<polygon points="-144,144 ... 25109.63,-3242">`
  now **byte-identical** to C (was 280pt off on each axis pre-fix); the
  `size=150,150` zoom factor now matches C exactly (`0.427661` both sides,
  was `0.432456` in the port pre-fix).
- Corpus sweep (`grep -l pad ~/git/graphviz/tests/*.dot` → 1879, 2082,
  2592 dot; 2239/2470/2471/2242 were `cellpadding`/`proxypad` substring
  false positives, no real `pad=` attr):
  - `2082.dot` (`pad=2.0`): `685x552` → **`965x832`, EXACT MATCH** to C.
  - `2592.dot` (`pad=0.209,` — trailing comma is the DOT attr-list
    separator, not part of the value; single-float form): `1772x563` →
    **`1794x585`, EXACT MATCH** to C.
  - `1879.dot` (`pad=2`): `10800x1343` → `10800x1448` (residual delta now
    a **uniform** 115pt on both axes, down from the pre-fix 115/220
    non-uniform delta). All node/cluster coords `0.00` delta
    (`flat-geom-diff.mjs`); only the pre-existing `ltail=`-edge
    COORD-COUNT residual (documented above, out of scope) remains.

**New finding — residual 1879 delta is a *different*, unported attribute:**
The remaining 115pt/115pt/viewBox-58,58-offset delta on 1879 is **not**
pad-related. `1879.dot:7` sets graph-level `margin="0.8"`
(0.8in·72=57.6pt ≈ the observed 58pt viewBox offset; 2·57.6=115.2pt ≈ the
observed 115pt width/height delta). This is C's `init_job_margin`
(`emit.c:3308-3330`, distinct from the already-ported per-node/per-cluster
`margin=` attribute) — a graph-level *pagination* margin added around the
padded content in `job->width`/`job->height`/viewBox computation. It is
**not ported** anywhere in this codebase (confirmed: `grep -rn "'margin'"
src/gvc src/render` = 0 hits outside node/cluster margin sites). This is a
same-shape gap as F2 (an unread graph attribute silently defaulting) but a
separate mechanism/attribute/call site — flagged as a new follow-up, not
folded into this fix (out of F2's declared write-set).

Commit: `fix(render): read graph pad attribute for viewport (F2)`.

## Fix record (F6)

Ported `init_job_margin` (`emit.c:3229-3239` attr read in `init_gvc`;
`:3309-3331` the `GVRENDER_PLUGIN` fallback branch) — `parseGraphMargin`
(`src/gvc/viewport.ts`), same `sscanf("%lf,%lf")` shape as `parseGraphPad`
but a distinct 0pt default (`SVG_MARGIN`, matching SVG's
`device_features_svg.default_margin={0,0}`, not `DEFAULT_EMBED_MARGIN`
though both happen to be 0). `device.ts render()` resolves `job.margin`
right after `job.pad` (C's `init_job_margin` call immediately follows
`init_job_pad`, `emit.c:4290-4291`) but — unlike pad — margin does NOT
feed the `size=` zoom fit; it is consumed later by `emitSvgTag`/
`svgBeginPage` (`svg-graph.ts`), after Z is known.

Traced the actual mechanism through `init_job_pagination` (`emit.c:1191-1300`,
job->width/height + canvasBox->pageBoundingBox/viewBox) and `setup_page`
(`emit.c:1532-1583`, translation), since C's pagination/canvasBox machinery
isn't otherwise ported in this simplified single-page SVG-only port.
Empirically reverse-engineered (native `dot -Tsvg`, portrait/landscape ×
symmetric/asymmetric margin × with/without `size=`) and confirmed
algebraically against the C source:
- `job.width/height = round(pageComponent + 2*margin.{x,y})` where
  `pageComponent` is the **already rotation-swapped**, UNROUNDED Z-scaled
  padded-bb extent (single `Math.round` on the sum — rounding the extent
  first would double-round and diverge from C at half-integer boundaries).
- viewBox LL = `round(margin.x)`, `round(margin.y)`; viewBox UR =
  `round(margin.x + pageComponent.x)`, `round(margin.y + pageComponent.y)`
  — C's rotation-branch double `exch_xyf`/`exch_xy` swap (canvasBox
  construction, then the final device-units swap-back) cancels for LL
  (plain margin, always unswapped) but not for UR, which pairs with the
  *page-oriented* (rotation-swapped) view extent — the same swap used for
  width/height.
- `svgBeginPage`'s translate gets `± margin.{x,y} / Z` added (Z = `job.scale.x`,
  since this port carries the size= zoom factor in `job.scale` rather than
  `job.zoom`, D4/ADR-2) — `+` for both axes in portrait, `+` for y and `-`
  for x in landscape (mirrors C's `setup_page` `canvasBox.LL/job->zoom` term
  and its Y_GOES_DOWN/rotation branch structure).
- Confirmed margin does NOT touch the background polygon (`job->clip`, not
  `canvasBox` — a separate C code path); no change to `emitGraphBackground`
  et al.

**Verified (native dot 15.1.0 oracle, `GVBINDIR=/tmp/ghl`):**
- `margin="0.8"` on `digraph G { a -> b }`: byte-matches C exactly —
  `width="177pt" height="231pt"`, `viewBox="58.00 58.00 120.00 174.00"`,
  `translate(61.6 169.6)`.
- `margin="1,0.5"` (asymmetric): `width="206pt" height="188pt"`,
  `viewBox="72.00 36.00 134.00 152.00"`, `translate(76 148)` — exact match.
- `margin="1,0.5"` + `rotate=90` (landscape): `width="260pt" height="134pt"`,
  `viewBox="72.00 36.00 188.00 98.00"`, `translate(-130 148)` — exact match
  (confirms margin.x/y stay unswapped in the translate term even though
  width/height's base component does swap).
- `margin="0.8"` + `size="1,1"` (Z != 1, exercises the `/Z` division):
  `translate(442.4 982.4)` — exact match.
- No-margin baseline (`digraph G { a -> b }`) unchanged byte-for-byte
  (`width="62pt" height="116pt"`, `viewBox="0.00 0.00 62.00 116.00"`,
  `translate(4 112)`).
- Background polygon coordinates identical with/without `margin=` (job->clip
  independent of canvasBox/margin) — confirmed not perturbed.
- **1879.dot**: the residual 115pt/115pt/58pt-offset delta flagged at the
  end of F2 is now **fully resolved** — `width="10915pt" height="1563pt"`,
  `viewBox="58.00 58.00 10858.00 1506.00"`, `translate(278.69 3376.69)` all
  byte-match C exactly (`flat-geom-diff.mjs`: bbox Δ=0 on width/height/ty).
  Only the separately-tracked `ltail=`-clip raw-spline residual (36 edges,
  COORD-COUNT signature, out of scope — see F2's "Secondary tracked-deep
  finding") remains for this corpus id.
- Corpus sweep (`grep -lP '^\s*margin\s*=' tests/*.dot` → 9 files): only
  **1879** (`margin=0.8`, real effect, now byte-match) and **1332**
  (`margin=0` at root scope, a no-op — confirmed byte-identical
  width/height/translate before and after) are genuine *root-graph-level*
  `margin=` users. The other 7 (2470, 2471, 2538, 2592, 2239, 2619_2, 2835)
  are cluster-level `graph [margin=...]` inside a `subgraph cluster*` block
  or per-node `margin=` in a node's attribute list — both distinct,
  already-ported mechanisms, correctly out of scope for this fix.

Commit: `fix(render): read graph margin attribute for viewport (F6)`.

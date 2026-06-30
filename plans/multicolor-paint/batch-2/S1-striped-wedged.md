# S1 — striped + wedged node fills (AD4)

## Context

graphviz-ts port; C at ~/git/graphviz/lib (15.0.0). Baseline: post-Batch-1
count, 0 failed; 97 goldens. Hook rule: smallest fix, ≤2 attempts/file,
then move on.

Batch 1 (G1) built `src/common/multicolor.ts` with `parseSegs` (the
shared color-list-with-weights parser). This task ports the multicolor
REGION fills and wires them into the node shape codefn. `style=striped`
fills a polygon (box) with vertical color bands; `style=wedged` fills an
ellipse with pie wedges. Neither is a gradient.

## C ground truth (oracle-verify each)

- `a [shape=box, style=striped, fillcolor="red:green:blue"]` → three
  side-by-side `<polygon fill="red"…/> <polygon fill="green"…/> <polygon
  fill="blue"…/>` filling the box, each 1/3 width, thin pen, plus the
  node boundary. Capture `dot -Tsvg` and match conformant.
- `a [style=wedged, fillcolor="red:green:blue"]` (default ellipse) →
  three pie wedges as `<path fill="…" …/>` bezier curves. Match the
  oracle.
- Weighted: `fillcolor="red;0.25:green;0.25:blue"` → bands/wedges sized by
  the fractions (last segment takes the remainder).

## Task (TDD — failing tests first)

### 1. src/render/svg-multicolor.ts (NEW)

@see lib/common/emit.c:595 (stripedBox), :549 (wedgedEllipse), and
`ellipticWedge` (grep its definition — likely lib/common/ or
lib/pathplan; it builds the wedge bezier path from center+semi-axes +
angle0/angle1).
- `stripedBox(job, corners: Point[], clrs: string, rotate: boolean,
  renderer): void` — port stripedBox: parseSegs(clrs); for each segment
  with t>0, set fill to the segment color, draw a 4-point polygon band
  whose x-extent is the segment's fraction of the box width (last segment
  → remaining width). Thin pen (THIN_LINE). `rotate` swaps the corner
  order (horizontal vs vertical bands). Use the obj-state paint path
  (set obj.fillColor + draw filled) so emitStyle renders each band, OR
  emit directly — match the C byte output either way (the bands are
  `fill="color" stroke=...` thin-pen polygons; verify the exact stroke/
  penwidth the oracle shows).
- `wedgedEllipse(job, pf: Point[], clrs: string, renderer): void` — port
  wedgedEllipse: parseSegs; ctr = mid(pf[0],pf[1]); semi = pf[1]-ctr;
  thin pen; for each segment t>0, angle1 = (last ? 2π : angle0 + 2π*t);
  build the wedge bezier via the ported `ellipticWedge(ctr, semi.x,
  semi.y, angle0, angle1)` and draw it filled with the segment color.
  Port `ellipticWedge` too if not already in the port (it returns a
  Bezier path approximating the elliptic sector).

### 2. src/common/poly-gencode.ts — wire the striped/wedged branches

In the node peripheries draw (poly_gencode), where the parity mission
left a first-solid fallback for `style.striped`/`style.wedged`:
- `style.wedged` + ellipse (sides ≤ 2), first periphery, multicolor
  fillcolor → call `wedgedEllipse(...)` then draw the boundary with
  filled=0 (C: `gvrender_ellipse(job, AF, filled)` with filled reset to
  0 after the wedge). @see shapes.c:poly_gencode (:3026-3032 wedged).
- `style.striped` (polygon), first periphery → call `stripedBox(...)`
  then `gvrender_polygon(job, AF, sides, 0)` (boundary, unfilled). @see
  shapes.c:poly_gencode (:3037-3045 striped).
- Single-color (non-multicolor) striped/wedged keeps the existing solid
  behavior. Use the multicolor() test `multicolor(fillcolor)` (more than
  one color) to gate — reuse parseSegs / a `isMulticolor` helper.

## Write-set (STRICT)

- src/render/svg-multicolor.ts (new) + its test
- src/common/poly-gencode.ts (striped/wedged branches) + its test

If ellipticWedge needs a new geometry module, you MAY add
src/common/elliptic-wedge.ts to the write-set (journal it) — but prefer
co-locating in svg-multicolor.ts if small.

## Wedge geometry risk (read before starting)

`ellipticWedge` is defined at ~/git/graphviz/lib/common/ellipse.c:274
(`Ppolyline_t *ellipticWedge(ctr, xsemi, ysemi, angle0, angle1)`); it
builds a Bézier path approximating an elliptic sector and depends on the
arc-to-bezier machinery in that file. The C SVG output for a wedge is a
dense `<path d="M.. C.. ..">` with ~40 control points at 2dp. STRIPED is
pure rectangles (low risk, will conformant). WEDGED depends on sin/cos in
the arc approximation — if the port's libm trig diverges from C's at 2dp,
the wedge control points will differ. That is the mission's FMA/libm
stop-condition class: if the wedge path diverges and the cause is libm
trig (not a port bug), DO NOT chase a code fix — journal it and let
T-gold pin-or-exclude the wedged golden. STRIPED must still pass. Build
striped first (verify conformant), then wedged.

## Read-set

- ~/git/graphviz/lib/common/emit.c:549-650 (wedgedEllipse, stripedBox),
  lib/common/ellipse.c:274 (ellipticWedge) + the arc helpers it calls,
  and `multicolor`/`mid_pointf`/`sub_pointf` helpers
- ~/git/graphviz/lib/common/shapes.c:poly_gencode (:3015-3055 striped/
  wedged branches)
- src/common/multicolor.ts (G1 parseSegs), src/common/poly-gencode.ts
  (the node draw + the parity striped/wedged fallback), src/gvc/job.ts
  (ObjState), src/render/svg-helpers.ts (paintStr/emitStyle, svgPolygon,
  svgBezier — how filled polygons/beziers emit)

## Architecture decisions (locked)

AD4 (reuse G1's parseSegs — no second parser). THIN_LINE pen for the
bands/wedges (match C). The boundary is drawn unfilled after the regions.

## Acceptance criteria (oracle-verify each)

- striped box 3-color → 3 bands + boundary, conformant vs C.
- wedged ellipse 3-color → 3 wedge paths + boundary, vs C.
- weighted fractions sized correctly.
- single-color striped/wedged → unchanged (solid). 97 goldens stable.

## Byte-stability gate

```
OUTDIR=/tmp/s1-after npx tsx .probes/render-all.ts
diff -rq /tmp/mc-baseline /tmp/s1-after
```
no differences. tsc 0; vitest 0 failed.

## Return (brief, structured)

- stripedBox/wedgedEllipse signatures; whether ellipticWedge was new or
  reused; the THIN_LINE/stroke values you matched.
- Oracle table: striped-3, wedged-3, weighted, single-color-unchanged —
  PORT vs C Y/N.
- tsc; vitest; byte-diff result.

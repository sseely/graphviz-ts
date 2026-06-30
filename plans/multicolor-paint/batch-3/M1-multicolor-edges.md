# M1 — multi-color parallel-spline edges (AD4)

## Context

graphviz-ts port; C at ~/git/graphviz/lib (15.0.0). Baseline: post-Batch-2
count (1657/0); 97 goldens. Hook rule: smallest fix, ≤2 attempts/file,
then move on.

The parity mission (T4) renders an edge's FIRST color only for a
`color="c1:c2"` colorList. C draws it as PARALLEL offset Béziers — one
curve per color, each offset perpendicular to the routed spline by
`SEP=2.0`. (This is the `else if (numc)` branch of `emit_edge_graphics`,
emit.c:2442 — NOT the `multicolor()`/split-along-length path; that one is
only for the SEMICOLON syntax `color="c1;f1:c2;f2"` when `numsemi && numc`.)

## C ground truth (oracle-verify conformant)

`a -> b [color="red:blue"]` (digraph: head arrow only) →
```
<path fill="none" stroke="red"  d="M26,-71.7C26,-64.41 26,-55.73 26,-47.54"/>
<path fill="none" stroke="blue" d="M28,-71.7C28,-64.41 28,-55.73 28,-47.54"/>
<polygon fill="red" stroke="red" points="30.5,-47.62 27,-37.62 23.5,-47.62 30.5,-47.62"/>
```
Two parallel curves SEP=2 apart (red x≈26, blue x≈28); head arrow =
headcolor = FIRST color (red). Capture each case with `dot -Tsvg`.

## Algorithm (port emit.c:2442-2528 exactly)

`numc` = count of ':' in color; multicolor when numc>0. `numc2 =
(2.0 + numc) / 2.0` (numc=1 → 1.5).
1. Build an OFFSET spline parallel to ED_spl: for each bezier segment,
   `computeoffset_p(p0,p1,SEP)` for the first point (or `computeoffset_p
   (pf2_prev,p1,SEP)` for later segments) and `computeoffset_qr(p0,p1,p2,
   p3,SEP)` for the middle two; last point via computeoffset_p(pf2,pf3,
   SEP). @see emit.c:1836 computeoffset_p, :1849 computeoffset_qr,
   :2364 #define SEP 2.0, EPSILON.
2. Init a working spline `tmpspl` to the OUTERMOST position: `tmp =
   pf - numc2 * offset` per control point.
3. For each color (strtok on ':', cnum=0,1,…): add `offset` to every
   `tmp` control point, then draw that bezier curve in the color. So
   successive colors are SEP apart. Empty color → DEFAULT_COLOR.
4. Arrow colors: `headcolor = first color` (cnum 0); `tailcolor = second
   color` (cnum 1, else first). Tail arrow filled tailcolor, head arrow
   filled headcolor. (Single arrow in a digraph = head = first color.)

## Task (TDD — failing tests first)

### 1. Offset geometry

Port `computeoffset_p(p, q, d)` and `computeoffset_qr(p, q, r, s, d)`
(perpendicular offset vectors; res = {y*d/len, -x*d/len}; SEP=2.0;
EPSILON guard). Place in the edge geometry area (src/render/svg-helpers.ts
edge section) or a small src/common/edge-offset.ts (journal if new). Unit-
test against the C formulas.

### 2. src/gvc/device.ts (renderEdge) + src/render/svg-helpers.ts

Detect a multicolor edge color (numc>0 via parseSegs / count ':'). When
multicolor:
- Build the offset spline + the parallel curves per the algorithm and emit
  each via the existing bezier-path writer (`emitBezierPath`/`svgBezier`
  path style) with the SEGMENT color as the stroke. Preserve dash/penwidth
  from the edge style on each curve.
- Tail arrow filled with tailcolor, head arrow with headcolor — reuse the
  T4 arrow emitter with the per-end color.
- Single-color edges keep the T4 path unchanged (conformant).
Set per-curve pen on `job.obj` (AD1/AD3 obj-state path), reuse the T4
emit path; keep the T2 obj-state lifecycle intact. Do NOT make structural
device.ts changes beyond the renderEdge multicolor branch.

### 3. (Optional, journal) semicolon split-along-length

The `color="c1;f1:c2;f2"` (numsemi && numc) case → `multicolor()` /
`splitBSpline` (emit.c:1921 splitBSpline, :1975 multicolor) splits the
spline ALONG ITS LENGTH (one color per length-segment). This is a
SEPARATE, less-common syntax. Implement it ONLY if it fits cleanly in the
write-set; otherwise leave the first-color fallback for the semicolon case
and journal it as a follow-up (the parallel `:` case is the mission
target). Do NOT let it expand the write-set.

## Write-set (STRICT)

- src/gvc/device.ts (renderEdge multicolor branch) (+ test)
- src/render/svg-helpers.ts (parallel-offset edge emission + per-end arrow
  color; offset geometry if co-located) (+ test)
- src/common/edge-offset.ts (ONLY if you place the geometry there; journal)

If you need changes beyond renderEdge + the edge emitters, STOP and report.

## Read-set

- ~/git/graphviz/lib/common/emit.c:1836-1862 (computeoffset_p/qr),
  :2364 (SEP), :2442-2528 (parallel-bezier branch), :1921 (splitBSpline),
  :1975-2050 (multicolor — only if doing the optional semicolon case)
- src/gvc/device.ts (renderEdge from T4), src/render/svg-helpers.ts
  (svgEdgePath, emitArrowPolygon, svgArrowPolygons, emitBezierPath from
  T4), src/common/multicolor.ts (G1 parseSegs), src/gvc/job.ts (ObjState)

## Architecture decisions (locked)

AD4 (reuse G1 parseSegs to detect/count colors). AD1/AD3 (per-curve pen on
obj-state; reuse the T4 emit path — don't re-implement path/arrow
emission).

## Acceptance criteria (oracle-verify each)

- `color="red:blue"` → two parallel curves (red + blue, SEP apart) + head
  arrow red, conformant vs C.
- `color="red:green:blue"` → three parallel curves.
- single-color edge → unchanged (T4). 97 goldens conformant.
- offset geometry unit test passes.
- If you did the semicolon case: `color="red;0.5:blue"` → split along
  length; else journal the fallback.

## Byte-stability gate

```
OUTDIR=/tmp/m1-after npx tsx .probes/render-all.ts
diff -rq /tmp/mc-baseline /tmp/m1-after
```
no differences (single-color goldens unchanged). tsc 0; vitest 0 failed.

## Return (brief, structured)

- offset geometry location + signatures; the parallel-bezier loop
  structure; head/tail arrow color rule.
- Oracle table: 2-color parallel, 3-color, single-color-unchanged, arrows
  — PORT vs C Y/N.
- whether you did the semicolon split-along-length case or journaled it.
- tsc; vitest; byte-diff result.

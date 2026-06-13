# M1 — multi-color edges (split-along-length) (AD4)

## Context

graphviz-ts port; C at ~/git/graphviz/lib (15.0.0). Baseline: post-Batch-2
count, 0 failed; 97 goldens. Hook rule: smallest fix, ≤2 attempts/file,
then move on.

The parity mission (T4) renders an edge's FIRST color only for a
`color="c1:c2"` colorList. C's `multicolor()` (emit.c:1975) instead
SPLITS each routed spline ALONG ITS LENGTH into one sub-curve per color
(via `splitBSpline` at the cumulative segment fractions) and draws each
sub-curve in its segment color. Tail arrow = first color; head arrow =
last color. This is NOT parallel/offset curves — it is a length split.

## C ground truth (multicolor, emit.c:1991-2050; oracle-verify)

- `a -> b [color="red:blue"]` → the spline drawn red for the first half
  (default t when no fraction), blue for the rest, as two `<path
  fill="none" stroke="red" …/>` / `stroke="blue"` sub-curves; tail arrow
  (if any) red, head arrow blue. `printf 'digraph{a->b[color="red:blue"]}'
  | dot -Tsvg` — match byte-for-byte.
- `color="red;0.3:blue"` → split at t=0.3.
- `color="red:green:blue"` → three sub-curves.
- Single color `color=red` → unchanged (parity T4 path).
- Empty segments (`s.t` ~0) skipped; `endcolor` = last drawn color.

Algorithm (port exactly): for each spline bz in ED_spl(e): left=1,
first=1; for each segment s (parseSegs of the color): skip if s.t≈0; set
pen=s.color; left-=s.t; if first: splitBSpline(bz, s.t) → draw bz_l, keep
bz_r (if left≈0 done); elif left≈0: draw bz_r (done); else: split bz_r at
s.t/(left+s.t) → draw bz_l, keep bz_r. Then tail arrow with segs front
color, head arrow with endcolor.

## Task (TDD — failing tests first)

### 1. splitBSpline geometry

Port `splitBSpline(bz, t) → {left, right}` (grep its C definition —
lib/common/splines.c or utils; it splits a piecewise-Bézier/B-spline at
parameter fraction t into two sub-curves). Place it where edge geometry
lives (src/render/svg-helpers.ts edge section, or a small new
src/common/split-bspline.ts — journal if new). Pure geometry; unit-test
it (a known spline split at t=0.5 produces the expected control points).

### 2. src/gvc/device.ts (renderEdge) + src/render/svg-helpers.ts

In the edge emission, detect a multicolor edge color (parseSegs / more
than one color). When multicolor:
- For each spline, walk the segments, splitBSpline per the algorithm, and
  emit each sub-curve via the existing bezier-path writer but with the
  SEGMENT's pen color (set job.obj.penColor per segment, reuse the T4
  emit path). Preserve dash/penwidth from the edge style on each segment.
- Tail arrow filled with the first segment color, head arrow with the
  last (endcolor) — reuse the T4 arrow emitter with the per-end color.
- Single-color edges keep the T4 path unchanged (byte-identical).
Set the per-segment pen on `job.obj` (AD1/AD3 obj-state path) — do not
side-channel. Keep the obj-state lifecycle (T2) intact; only set fields
and loop the emission.

## Write-set (STRICT)

- src/gvc/device.ts (renderEdge multicolor branch) (+ test)
- src/render/svg-helpers.ts (per-segment edge path + arrow color; the
  splitBSpline geometry if co-located here) (+ test)
- src/common/split-bspline.ts (ONLY if you place the geometry there;
  journal it)

If you need structural changes beyond renderEdge + the edge emitters,
STOP and report.

## Read-set

- ~/git/graphviz/lib/common/emit.c:1975-2052 (multicolor), the
  `splitBSpline` definition (grep), `AEQ0` macro
- src/gvc/device.ts (renderEdge from T4), src/render/svg-helpers.ts
  (svgEdgePath, emitArrowPolygon, svgArrowPolygons, emitBezierPath from
  T4), src/common/multicolor.ts (G1 parseSegs), src/gvc/job.ts (ObjState)

## Architecture decisions (locked)

AD4 (reuse G1 parseSegs). AD1/AD3 (per-segment pen on the obj-state;
reuse the T4 emit path — don't re-implement path/arrow emission).

## Acceptance criteria (oracle-verify each)

- `color="red:blue"` edge → two stroked sub-curves (red then blue) + tail
  red / head blue arrows, byte-for-byte vs C.
- `color="red;0.3:blue"` → split at 0.3.
- `color="red:green:blue"` → three sub-curves.
- single-color edge → unchanged (T4). 97 goldens byte-identical.
- splitBSpline unit test passes (t=0.5 control points).

## Byte-stability gate

```
OUTDIR=/tmp/m1-after npx tsx .probes/render-all.ts
diff -rq /tmp/mc-baseline /tmp/m1-after
```
no differences. tsc 0; vitest 0 failed.

## Return (brief, structured)

- splitBSpline location + signature; the multicolor loop structure.
- Oracle table: 2-color, weighted, 3-color, single-color-unchanged,
  arrows — PORT vs C Y/N.
- tsc; vitest; byte-diff result.

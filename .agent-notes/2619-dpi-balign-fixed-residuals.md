# 2619_1 / 2619_2 — dpi + BALIGN fixed; two residuals remain

Real-world genealogy family-tree cards (HTML `<TABLE>` nodes, `rankdir=LR`,
`dpi="96"`, `<IMG>` cells). Both were `diverged` with maxΔ 421 on `svg/@viewBox`.

## Fixed (2026-07-06)

1. **dpi/resolution SVG scaling** (`src/gvc/device.ts`). The whole layout was
   byte-identical internally, but the port emitted `scale(1 1)` + a 3/4-size
   viewBox while the oracle emitted `scale(1.33333)` = 96/72. Root cause: the
   port set `job.scale = size-zoom` only, assuming dpi=72. C: `job->scale =
   zoom * dpi / POINTS_PER_INCH` (emit.c:3680), dpi from `GD_drawing->dpi`
   (input.c:713 `dpi` then `resolution` then 0), SVG default_dpi=72
   (gvrender_core_svg.c:814). Fix reads the attr and multiplies job.scale by
   dpi/72. No-op for dpi=72 / absent (all other corpus bytes unchanged).
   Also improved **1435** (dpi=150): structural-match Δ503 → Δ0.39.

2. **BALIGN per-line justification** (`src/common/htmltable-pos.ts`
   `placeCellRuns`). A `<BR>` with no ALIGN left its line's `just` UNSET; the
   port then centered it. C `pos_html_txt` (htmltable.c:1541) fills unset
   spans with the cell's BALIGN default (BALIGN_MASK → l/r/n, htmllex.c:350).
   `BALIGN="LEFT"` cards centered each line instead of flushing left. Fix
   applies `cell.balign` (left/right only) to runs whose `just` is undefined.

Both TDD'd: `src/render/svg-graph.test.ts` (dpi), `src/common/htmltable-align.test.ts` (BALIGN).

## Residual 1 — style="tapered" edge → polygon — FIXED (2026-07-06)

Edge `I63->F23` has `style="tapered"`; the oracle draws a tapered wedge as a
filled `<polygon>` (varying penwidth), the port drew a plain `<path>`. Ported
the `if (tapered)` branch of emit_edge_graphics (emit.c:2422): new
`src/common/taper.ts` (faithful port of lib/common/taper.c — pathtolines,
taper, radfuncs, taperfun; preserves the drawbevel `x`-for-y quirk) +
`src/render/svg-tapered-edge.ts` (polygon with pencolor transparent /
fillcolor = edge color, then arrowheads), dispatched in svg.ts endEdge before
the colon-multicolor branch (matching C's `if (tapered) else if (numc)`).
Byte-exact vs oracle: minimal `a->b[style=tapered]` 0 DIFFs; 2619_1/2 taper
polygon 0 DIFFs. Only style=tapered edges in the whole corpus are 2619_1/2, so
the branch is a no-op everywhere else. TDD: taper.test.ts + svg-tapered-edge.test.ts.

## Residual 2 — HTML cell text @y off by 1.5pt — FIXED (2026-07-06)

Misattributed at first to the F7/F23 oval nodes; the real locus is the I63/I64
genealogy CARDS (HTML `<TABLE>` node labels). Their "dat" cell has a 2-line
block whose 2nd line carries a trailing `  ` that renders at the default 14pt
(invalid `font_size` attr ignored), making that line multi-item → the block is
"non-simple". C's size_html_txt (htmltable.c) centers a non-simple block by the
sum of raw max font sizes (mxfsize), not measured line heights (mxysize):
`lsize = simple ? mxysize : mxfsize`. The port's placeComplexRuns already
advanced baselines by fontSize, but placeCellRuns computed the centering height
from measured `run.height`, so `dely = cellH − blockH` was ~3pt short and the
VALIGN=middle block sat dely/2 = 1.5pt too high. The node box matched throughout
because the 40px FIXEDSIZE picture cells dominate SIZING — the text height only
drives centering. Fix (htmltable-pos.ts placeCellRuns): height =
`simple ? Σrun.height : Σrun.fontSize`, with a single line always measured
(C's nspans==1 → mxysize). 2619_1/2 now byte-exact (0 diffs) → conformant.
TDD: htmltable-align.test.ts non-simple-centering case.

## 2619_1 / 2619_2 — now CONFORMANT (all four residuals closed)

dpi scaling + BALIGN + tapered polygon + non-simple centering. No residuals left.

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

## Remaining residuals (NOT the dpi/BALIGN class)

Both cases still `diverged` after the two fixes, on two independent mechanisms:

1. **`style="tapered"` edge → `<polygon>`.** Edge `I63->F23` has
   `style="tapered"`. The oracle draws a tapered wedge as a filled `<polygon>`
   (varying penwidth); the port draws a plain `<path>`. First diff:
   `svg/g[1]/g[8]/path[1]: actual=path expected=polygon`. This is a distinct
   unported edge-rendering feature (taper geometry), not a small tweak.
   @see lib/common/emit.c / splines drawing for tapered style.

2. **HTML text @y off by 1.5pt in the oval family nodes (F7/F23).** These are
   `shape=oval` nodes whose HTML label has an empty first line
   (`<FONT POINT-SIZE="10"> <BR /> (F7)</FONT>`). The whole text block sits
   1.5pt higher in the port (constant Δ1.5 across all spans) — a vertical
   centering / valign residual of an HTML label inside an oval's larger box.

To reach conformant, 2619_1/2 need BOTH residuals fixed. The dpi + BALIGN
fixes are correct and land independently (they also fix 1435's viewBox class).

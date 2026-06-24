<!-- SPDX-License-Identifier: EPL-2.0 -->

# Decision journal

Append one row per non-trivial judgment call made during execution.

| Date | Task | Decision | Rationale |
|------|------|----------|-----------|
| 2026-06-22 | T1 | Ported the `doBorder` rounded arm too (gap A2), not just the fill | Oracle dump showed the rounded table's **border** is also a Bézier `<path>` (`<path fill="none" stroke="black" .../>`), not only the fill. C `doBorder` (htmltable.c:271) has its own `if(style.rounded) round_corners(...,0)`. `doBorder` is in T1's write-set (`htmltable-emit-fill.ts`), so in-scope. Without it the 5 targets diverge at the table border. |
| 2026-06-22 | T1 | gap B modeled as a module-level penwidth-leak global (`htmlFillPen`) reset per top-level table | C never resets gvrender penwidth before a bgcolor fill: a cell fill draws at the prior `doBorder`'s pen width. Oracle confirms cell[0] fill has no stroke-width (leaked 1.0 from the node ellipse), cell[1..] carry `stroke-width="3"` (prior cell border). Mirrors existing `paintObj`/`anchorSeq` module-global pattern; reset at `emitHtmlLabel` entry mirrors the node/cluster shape drawing at pw 1.0 just before. |
| 2026-06-22 | T1 | Registered `htmlFillPen` in `test/architecture/module-globals.fitness.test.ts` (outside declared write-set) | The multi-diagram-safety fitness function fails on any unlisted module global. The 2-line allowlist registration is mandatory and not owned by another task; logged as a push-forward deviation rather than a stop. |
| 2026-06-22 | T1 | SVG renderer untouched (D1 honored) | `emitStyle` already emits `stroke-width` from `obj.penWidth` independent of `stroke="none"`, and `emitRoundedBezier`→bezier renderer already produces the gradient path (proven by grdcluster). Threading penwidth + calling the existing helper sufficed; no renderer/poly-shapes change. |
| 2026-06-22 | T2 | One golden (`dot-htmltable-rounded-grad`), not two (D4) | The rounded gradient table golden (rounded fill+border `<path>`, border=3 cells with leaked stroke-width) covers gap A + gap B + gradient bbox in one ref. The rounded-solid case is already byte-locked by the new unit tests + the corpus survey, so a 2nd solid golden adds no coverage. Manifest 156→157, suite count bumped. |
| 2026-06-22 | T2 | Survey flipped 6 cases (+6 byte-match), not the projected 5 | The 5 declared targets (grdfillcolor, grdlinear, grdlinear_angle, grdradial, grdradial_angle) flipped diverged→byte-match, **plus** a bonus `graphs-rd_rules` (a rounded HTML-table case the same change fixes — confirmed rounded + 0 content-diff vs oracle). **Zero regressions**; all 6 grd* controls stayed byte-match. Parity totals byte-match 266→272, structural 232→232, diverged 270→264. |

<!-- SPDX-License-Identifier: EPL-2.0 -->

# Architecture decisions

## D1 — Gradient resolution lives in `withHtmlPaint`

**Context:** A table/cell `bgcolor="c0:c1"` must produce a gradient fill. The
spec parse (`parseGradientSpec`) and paint-state setup can live either in the
caller (`emitBgFill`) or in `withHtmlPaint`.

**Decision:** `withHtmlPaint` owns the gradient decision. Callers pass the raw
`bgcolor` plus `gradientangle` and `style`; `withHtmlPaint` runs
`parseGradientSpec` and, on a hit, sets `FillType.Linear`/`FillType.Radial`,
`fillColor = clrs[0]`, `stopColor = clrs[1] ?? DEFAULT_COLOR`, `gradientAngle`,
`gradientFrac` on the scoped paint obj.

**Consequences:** Mirrors C `setFill` (htmltable.c:347), which itself calls
`findStopColor` + `gvrender_set_gradient_vals` — the function boundary is
preserved per CLAUDE.md. `emitBgFill` stays thin. `HtmlPaint` gains optional
gradient fields; existing solid callers (border rules) are unaffected because
the fields are absent → solid path unchanged.

**Rollback:** Reversible — pure render emission, revert the deploy/commit.

## D2 — Radial detection via `style` substring (port-faithful)

**Context:** C `setFill` chooses `RGRADIENT` vs `GRADIENT` from `style.radial`
(a parsed bit). The port carries `style` as a string on table/cell data.

**Decision:** Treat the fill as radial when the style string includes
`"radial"`, matching how `penTypeOf` already inspects the style string for
`"dashed"`/`"dotted"` in the same file. Default linear.

**Consequences:** Consistent with existing in-file style handling. If a future
port introduces a parsed style bitfield, swap the check then — not now (YAGNI).

## D3 — `DEFAULT_COLOR` for the missing second stop

**Context:** C uses `DEFAULT_COLOR` when `clrs[1]` is absent (`bgcolor="c0:"`).

**Decision:** Reuse the same default the node/cluster gradient path resolves to.
`parseGradientSpec` already returns `'black'` for an empty second color, which
matches Graphviz `DEFAULT_COLOR`. Keep that behavior; do not special-case.

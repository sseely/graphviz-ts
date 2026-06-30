<!-- SPDX-License-Identifier: EPL-2.0 -->

# Comparison pages — HTML-table gradient-fill holdouts

The mission objective (emit gradient `bgcolor` fills for HTML-like tables and
cells) is **complete and verified**: after the fix the port emits exactly the
same number of `<linearGradient>`/`<radialGradient>` defs and `fill="url(#…)"`
references as the native oracle for all five `grd*` corpus graphs, and two new
goldens (`dot-htmltable-grad-linear`, `dot-htmltable-grad-radial`) conformant
the oracle.

These five corpus graphs nevertheless remain `diverged` because each one also
exercises a **separate, pre-existing gap** that this mission did not target.
The gradient is now emitted and applied correctly; the residual divergence is
not in the gradient.

| Case | maxDelta | firstDiffPath | Residual gap |
|------|---------|---------------|--------------|
| [graphs-grdfillcolor](grdfillcolor.md) | 3.54 | `svg/g[1]/g[2]/polygon[1]` | A |
| [graphs-grdlinear](grdlinear.md) | 3.54 | `svg/g[1]/g[2]/polygon[1]` | A |
| [graphs-grdlinear_angle](grdlinear_angle.md) | 3.54 | `svg/g[1]/g[2]/polygon[1]` | A |
| [graphs-grdradial](grdradial.md) | 3.54 | `svg/g[1]/g[2]/polygon[1]` | A |
| [graphs-grdradial_angle](grdradial_angle.md) | 3.54 | `svg/g[1]/g[2]/polygon[1]` | A |

## Residual gaps (both out of scope for this mission)

**A — rounded HTML-table fill emits `<polygon>` instead of `<path>`.**
All five `grd*` tables carry `style="rounded"`. The oracle emits the table
background as a rounded-rectangle Bézier `<path>` and computes the gradient
bounding box from that rounded shape; the port emits a square `<polygon>` over
the full inset box. This shifts the table-fill coordinates (and the gradient
`x1/x2/y1/y2`) by ~3.54pt — the firstDiff for every case. Follow-on: port the
rounded-table arm of `emit_html_tbl` to `emitRoundedBezier` (the same machinery
already used for rounded clusters / Mrecord; see memory
`rounded-clusters-mrecord-done`).

**B — bordered-cell fill polygons omit `stroke-width`.**
Cells with `border="N"` (N>1) have the oracle carry the cell pen width onto the
fill polygon as `stroke-width="N"` (even though `stroke="none"`); the port
emits the fill at the default width. A secondary diff (later in the tree than
gap A). Follow-on: thread the cell pen width into the bgcolor fill paint state.

Neither gap is a gradient defect. Fixing either is a distinct localized change
and belongs to a separate mission; this mission is scoped to gradient emission
only (and the brief's stop condition forbids broadening the renderer path).

<!-- SPDX-License-Identifier: EPL-2.0 -->

# Holdout case: graphs-grdradial_angle

- **Corpus path:** `graphs/grdradial_angle.gv` · **engine:** `dot`
- **Verdict:** `diverged` · **maxDelta:** 3.54 · **firstDiffPath:** `svg/g[1]/g[2]/polygon[1]`
- **Port:** `<polygon fill="url(#l_2)" stroke="none" points="139.25,-150.23 139.25,-652.73 614.75,-652.73 614.75,-150.23 139.25,-150.23"/>`
- **Oracle:** `<path fill="url(#l_2)" stroke="none" d="M156.25,-155.23C156.25,-155.23 … 150.25,-155.23 156.25,-155.23"/>`

## Root cause — residual gap A (NOT the gradient)

The TABLE carries `style="rounded"`. The oracle emits the table background as a
rounded-rectangle Bézier `<path>` and derives the gradient bounding box from
that rounded shape; the port emits a square `<polygon>` over the full inset
box. The gradient itself (`fill="url(#l_2)"`) is applied **identically**
on both sides — the divergence is the fill *shape* (and the ~3.54pt gradient
bbox shift that follows from it), not the gradient.

A later secondary diff (gap B) is the missing `stroke-width` on bordered-cell
fill polygons.

## Status

**Gradient emission: FIXED** in this mission. Gradient def count + `url()`
references now match the oracle exactly; goldens `dot-htmltable-grad-linear` /
`dot-htmltable-grad-radial` conformant.

**Residual divergence: EXCLUDED** — rounded HTML-table `<path>` emission is a
separate follow-on (reuse `emitRoundedBezier`, as for rounded clusters/Mrecord).
Out of scope per the mission's renderer stop condition.

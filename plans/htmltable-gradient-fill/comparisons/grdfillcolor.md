<!-- SPDX-License-Identifier: EPL-2.0 -->

# Holdout case: graphs-grdfillcolor

- **Corpus path:** `graphs/grdfillcolor.gv` · **engine:** `dot`
- **Verdict:** `diverged` · **maxDelta:** 3.54 · **firstDiffPath:** `svg/g[1]/g[2]/polygon[1]`
- **Port:** `<polygon fill="url(#l_3)" stroke="none" points="139.25,-125.73 139.25,-628.23 614.75,-628.23 614.75,-125.73 139.25,-125.73"/>`
- **Oracle:** `<path fill="url(#l_3)" stroke="none" d="M156.25,-130.73C156.25,-130.73 … 150.25,-130.73 156.25,-130.73"/>`

## Root cause — residual gap A (NOT the gradient)

The TABLE carries `style="rounded"`. The oracle emits the table background as a
rounded-rectangle Bézier `<path>` and derives the gradient bounding box from
that rounded shape; the port emits a square `<polygon>` over the full inset
box. The gradient itself (`fill="url(#l_3)"`) is applied **identically**
on both sides — the divergence is the fill *shape* (and the ~3.54pt gradient
bbox shift that follows from it), not the gradient.

A later secondary diff (gap B) is the missing `stroke-width` on bordered-cell
fill polygons.

## Status

**Gradient emission: FIXED** in this mission. Gradient def count + `url()`
references now match the oracle exactly; goldens `dot-htmltable-grad-linear` /
`dot-htmltable-grad-radial` byte-match.

**Residual divergence: EXCLUDED** — rounded HTML-table `<path>` emission is a
separate follow-on (reuse `emitRoundedBezier`, as for rounded clusters/Mrecord).
Out of scope per the mission's renderer stop condition.

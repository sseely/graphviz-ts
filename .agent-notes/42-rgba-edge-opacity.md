<!-- SPDX-License-Identifier: EPL-2.0 -->

## Observation: 42 — RGBA edge colors dropped fill/stroke-opacity

- **Context**: 42 diverged (firstDiff `@stroke-opacity`). Input uses RGBA hex edge
  colors, e.g. `0 -> 1 [color="#0000ff7d"]` — the `7d` alpha = 0.490196.
- **Finding**: native emits `stroke-opacity`/`fill-opacity` from the alpha channel;
  the port emitted `stroke="#0000ff"` with NO opacity on EDGE paths and arrowhead
  polygons. The color parser (color.ts) and the node/cluster emit (emitStyle →
  emitOpacity) already handled alpha — but the edge path emitters and arrow-op
  emitters never called the opacity path.
- **Fix**: emit `stroke-opacity` (after stroke-width/dasharray, C svg_grstyle
  order) on the regular edge path (svg-helpers.ts emitOneBezierPath) and the
  parallel/offset edge path (svg-parallel-edge.ts emitOffsetBezier); thread an
  `opacity` arg through emitArrowOps (svg-arrow-ops.ts) to emit `fill-opacity`
  (filled shapes) + `stroke-opacity` on arrowhead polygons/ellipses/polylines.
  Callers pass colorOpacity(obj.penColor) (single color) or
  colorOpacity(resolveRenderColor(headColor/tailColor)) (multicolor).
- **Result**: 42 diverged → structural-match, 0 regressions (only corpus graph
  with RGBA edge colors). Inert for opaque/string colors (colorOpacity→null).
  Residual 18.43 = a SEPARATE spline-geometry divergence (pos=/splines=true).
- **Confidence**: High — conformant opacity attrs vs oracle; gate 0 regr.

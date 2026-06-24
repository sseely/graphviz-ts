<!-- SPDX-License-Identifier: EPL-2.0 -->

# graphs/p3 `sleep--runmem` — RESOLVED

## Before

- Port emitted **3 cubic bezier pieces**; oracle emitted **4**. maxDelta 0.48
  (geometry near-perfect — only the piece count differed). Canonical reproducer
  for the long-edge under-segmentation class.

## Root cause (S1 spike)

The faithful fitter `routeSpline` is correct; the divergence was in its
`Pshortestpath` input `pl`, which bent on box right-walls rounded in a
non-integer-shifted coordinate frame. `normalizeXcoords` (position.ts) shifted
all node x by `minNormalLeftX = coord.x − lw` (lw non-integer), injecting a
fractional offset (port frame = C frame + 138.36728) that made `maximal_bbox`'s
`round(b)` straddle rounding boundaries differently from C. See
[decisions.md#d-fixsite](../decisions.md#d-fixsite) for the instrumented diff.

## Fix

`src/layout/dot/position.ts` `normalizeXcoords`: shift by `Math.round(minX)`
instead of `minX`. Keeps the routing frame integer (matching C); the fraction
washes out in the postprocess translate, so final node positions are unchanged.

## After

- Port emits **4 pieces** (`final pts=13 pieces=4`).
- Full p3 SVG **geometry byte-identical** to the oracle
  (`diff` over `<ellipse|path|polygon|text|polyline>` = 0 differing lines; only
  the generator-comment header differs, which the survey normalizes).

Verification: `npx tsx test/corpus/render-one.ts ~/git/graphviz/tests/graphs/p3.gv dot`
vs `GVBINDIR=/tmp/gvplugins ~/git/graphviz/build/cmd/dot/dot -Tsvg …/p3.gv`.

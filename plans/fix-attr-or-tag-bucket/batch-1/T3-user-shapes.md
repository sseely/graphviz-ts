<!-- SPDX-License-Identifier: EPL-2.0 -->
# T3 — user_shapes: C shapefile fallback semantics

## Context
Nodes with shapefile="graphs/jcr.gif": headless C emits a BOX polygon at
node dims; port emits default ellipse. Node dims already match (maxΔ 0).

## Task
Read C's handling (lib/common/shapes.c user-shape/epsf path; how
shapefile sets the shape when the image can't load headless — which
shape record, which outline). Pin where the port should resolve
shapefile (nodeAttr consumers / shape selection in common) and what the
faithful fallback is (box polygon? poly with peripheries?). Exact C
behavior, not a guess — the oracle output (plain 5-point polygon,
fill=none) is the reference.

## Acceptance criteria
- Given the C read, then the exact fallback shape + dims rule is quoted
  (file:line) and matches the oracle SVG's polygons.
- Given the port, then the resolution gap is pinned to file:line.

## Rollback / Observability
N/A. Reversible.

## Commit
`docs(T3): user_shapes shapefile semantics — <one-liner>` (may fold into gate commit)

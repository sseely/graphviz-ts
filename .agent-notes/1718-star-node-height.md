# 1718 — star node ND_ht undercounted → every rank gap too short

## Mechanism (FIXED)
1718 is a 16×16 `shape=star` grid. Width matched the oracle (3252 vs 3239) but
height was 21% short (17476 vs 21192, maxΔ 3716 on the group transform ty).
Cause: **every rank gap was 72pt in the port vs 87.35pt native** — a uniform
rank-pitch shortfall, not a per-node scale (star polygons were byte-identical).

Rank pitch = node_ht + ranksep. ranksep=36 (default 0.5in). So port ND_ht=36
(the un-inflated default), native ND_ht=51.35. A star's outer points reach
BEYOND its label box; C's poly_init (shapes.c:2214-2277) folds the actual
generated-vertex extent into ND_ht: for a `poly_desc` shape it calls
`pd->vertex_gen(vertices, &bb)` — `star_vertices` mutates `bb` to the
aspect-adjusted box (`a < aspect → sz.y = sz.x*aspect`, i.e. 54×36 → 54×51.35)
and reports `xmax=bb.x/2, ymax=bb.y/2`; then `bb = max(minsize, 2*xmax/2*ymax)`
= max(36, 51.35) = 51.35. The port's `polygonBB` instead used the generic
`polygonVertices` (a regular 10-gon inscribed in the box, extent ≈ 36),
undercounting the star → ND_ht stayed at the 0.5in minimum.

star_size(label) returns (0,0) for an empty label so the growth happens
entirely at the vertex stage, not the size_gen stage — the node box (54×36)
matched, masking the bug in SIZING while it silently broke ranking.

## Fix (commit pending)
`src/common/poly-sizing.ts` polygonBB: dispatch STAR to a new `starVertexGen`
that returns the port's `starVertices` plus C's aspect-adjusted extent
(xmax=sz.x/2, ymax=sz.y/2). Only STAR is affected; CYLINDER stays on the
generic path (its cylinder_vertices does not mutate bb — cylinderSize already
grew it). Only 1718 uses shape=star in the whole corpus.

Result: 1718 dims now byte-match (21192, translate 21188.41); maxΔ 3716 → 47.96.
Minimal `a->b [shape=star]` SVG height 116 → 147 (oracle). TDD: poly-vertices.test.ts.

## Residual 2 — spline-to-star edge clip — FIXED (2026-07-06)
Root cause: the port registered `shape=star` with the generic `poly_inside`
(a concave-decagon point-in-polygon walk), so edges clipped to the star's
inner boundary and stopped ~8pt short of the tip. C gives the star its OWN
insidefn — `star_inside` (shapes.c:4089) — testing the point against the
OUTER-tip pentagram: step the outline vertices by 2 (the five tips), connect
tip i to tip (i+4)%sides, count how many of those edges the point is on the far
side of from the centre; ≥2 → outside. Fix: ported `starInside`
(poly-inside.ts) + a STAR_FNS table (insidefn=starInside) registered via
`mkStar('star', P_STAR)` (shapes.ts). Star vertices are already at final node
scale (poly_inside scalex/scaley = 1) so P is tested directly. **1718 now
byte-exact → CONFORMANT** (both this + the node-height fix). star2 repro 0
diffs. TDD: poly-vertices.test.ts (edge reaches native 27,-64.06).

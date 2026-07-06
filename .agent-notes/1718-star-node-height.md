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

## Remaining residual (OPEN) — spline-to-star edge clip
1718's sole remaining divergence (10 diffs, maxΔ 47.96) is ONE edge's spline +
arrowhead (g[3]). The edge endpoints where they meet a star node differ by
5–48pt. Same residual on the minimal `a->b` repro (7 diffs on the edge). Likely
the edge clips to the node's box/ellipse boundary rather than the star's actual
concave shape (star_inside), or the clip uses a stale pre-fix node size. This is
a distinct mechanism from the node-sizing fix; 1718 stays `diverged` until it's
resolved. Next: compare the port's edge clip-to-star against C's shape_clip /
star_inside for a node whose ND_ht just changed.

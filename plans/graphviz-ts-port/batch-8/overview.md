# Batch 8 — dot Layout Engine

## Summary

Batch 8 ports the full Sugiyama hierarchical layout pipeline in `lib/dotgen/`.
This is the largest and most algorithmically complex batch in the mission. The
pipeline is strictly sequential: each phase consumes data written by the
previous phase and produces data required by the next. No tasks in this batch
run in parallel.

The five logical phases map to eight tasks:

1. **T32** — Cycle breaking (`acyclic.c`) and connected components (`decomp.c`)
2. **T33** — Rank assignment via network simplex (`rank.c` + `lib/common/ns.c`)
3. **T34** — Crossing minimization (`mincross.c`)
4. **T35** — X-coordinate assignment and cluster expansion (`position.c` + `cluster.c`)
5. **T36** — Flat edges and edge classification (`flat.c` + `class1.c` + `class2.c`)
6. **T37** — Edge splines, same-port, concentrated edges (`dotsplines.c` + `sameport.c` + `conc.c`)
7. **T38** — Compound edge routing and aspect ratio (`compound.c` + `aspect.c`)
8. **T39** — dot init and pipeline entry point (`dotinit.c`)

Two critical cross-cutting hazards apply to the entire batch:

**CDT iteration order (T33):** `collapse_sets()` in `rank.c` and related
functions iterate subgraphs via cgraph's CDT dictionary in key-comparison
order. UF_union calls happen in that order; the first union's representative
determines the final rank for ambiguous nodes. The TypeScript port must
replicate this traversal order using insertion-ordered Maps. Divergence here
produces silently incorrect layouts for graphs with ambiguous `rank=same`
constraints. This is the highest-risk behavioral dependency in the batch.

**ND_rank aliasing (T35):** During the position phase, `NodeInfo.rank` is
overwritten by the network simplex solver with the x-coordinate, then restored
by `set_xcoords`. Code that reads `rank` during the position phase receives the
x-position, not the layer index. The field carries a JSDoc hazard notice per
AD-8.

## Dependencies

Batch 8 requires Batches 1–7 to be complete. Specifically:

- `src/model/` (Batches 1, 3) — Graph, Node, Edge, GraphInfo, NodeInfo, EdgeInfo
- `src/common/` (Batches 5a, 5b, 5c) — TextLabel, shapes, port types, spline
  routing infrastructure (`routesplines`, `routepolylines`, `clip_and_install`,
  `beginpath`, `endpath`, `routesplinesinit`, `routesplinesterm`,
  `makeStraightEdges`, `makeSelfEdge`)
- `src/gvc/context.ts` (Batch 6) — `GvcContext`, `LayoutEngine` interface
- `src/layout/` (this batch creates it) — `src/layout/dot/` is new

Network simplex (`ns.ts`) lives inside `src/layout/dot/` — it is not a
separate module shared with other engines. The `lib/common/ns.c` implementation
is used exclusively by `lib/dotgen` in the C codebase.

## Task Table

| ID | Description | ‖/→ | Writes | Depends On |
|----|-------------|-----|--------|------------|
| T32 | Cycle breaking and decomposition | → | src/layout/dot/acyclic.ts, src/layout/dot/decomp.ts, src/layout/dot/acyclic.test.ts | Batches 1–7 |
| T33 | Rank assignment via network simplex | → | src/layout/dot/rank.ts, src/layout/dot/ns.ts, src/layout/dot/rank.test.ts | T32 |
| T34 | Crossing minimization | → | src/layout/dot/mincross.ts, src/layout/dot/mincross.test.ts | T33 |
| T35 | X-coordinate assignment and cluster expansion | → | src/layout/dot/position.ts, src/layout/dot/cluster.ts, src/layout/dot/position.test.ts | T34 |
| T36 | Flat edges and edge classification | → | src/layout/dot/flat.ts, src/layout/dot/classify.ts, src/layout/dot/flat.test.ts | T35 |
| T37 | Edge splines, same-port, concentrated edges | → | src/layout/dot/splines.ts, src/layout/dot/sameport.ts, src/layout/dot/conc.ts, src/layout/dot/splines.test.ts | T36 |
| T38 | Compound edge routing and aspect ratio | → | src/layout/dot/compound.ts, src/layout/dot/aspect.ts, src/layout/dot/compound.test.ts | T37 |
| T39 | dot init and entry point | → | src/layout/dot/init.ts, src/layout/dot/index.ts, src/layout/dot/dot.test.ts | T38 |

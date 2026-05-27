# T44 — neato Spline Routing

## Context

Edge routing for neato (and fdp) is implemented in `lib/neatogen/neatosplines.c`
and `lib/neatogen/multispline.c`. These files route all edges after node
positions are determined. The spline routing uses `lib/pathplan` (T14) for
obstacle-avoiding shortest paths and Bezier fitting.

**lib/ortho integration:**

`neatosplines.c` conditionally calls `orthoEdges(g, false)` from `lib/ortho`
when all three conditions hold:
1. `edgetype == EDGETYPE_ORTHO` (graph attribute `splines=ortho`)
2. `Plegal_arrangement` returns true (node obstacles do not overlap)
3. ORTHO build flag is defined (always true in the TypeScript port)

When `splines=ortho` and obstacles are legal, the call is per-graph (not
per-edge) — ortho handles all edges at once. The TypeScript port routes via
`src/ortho/index.ts` (T17) in this case.

**Obstacle construction (`makeObstacle`):**

Node shapes become CW polygon obstacles for pathplan. Key details:
- Polygon vertices must be in CW order (pathplan requires CW; graphviz
  polygon info is CCW, so reverse the index sequence)
- Ellipse nodes (fewer than 3 vertices in the shape info) get an 8-sided
  circumscribed polygon
- `expand_t.doAdd == true`: margin is additive in points
- `expand_t.doAdd == false`: margin is multiplicative scale factor

**Equivalent edge handling:**

Multiple edges between the same node pair (parallel edges) share a spline.
The first-inserted edge is the "leader" (`ED_count > 0`); subsequent
parallel edges chain via `ED_to_virt`. Only leader edges are routed; the
spline is then copied to the chain. TypeScript uses `EdgeInfo.count` and
`EdgeInfo.toVirt` for this.

**Fallback hierarchy:**

```
splines=ortho && obstacles_legal → orthoEdges (lib/ortho)
splines=spline || splines=curved  → makeSpline via pathplan
splines=polyline                  → makePolyline via pathplan
self-loop                         → makeSelfArcs
routing failure                   → makeStraightEdge (fallback)
```

**`multispline.c`:**

Routes multi-edges (parallel edges with `ED_count > 1` or boundary ports)
using a routing graph built from the Delaunay triangulation of obstacle
vertices. The TypeScript port implements this using the constrained Delaunay
functions from T14 (pathplan) when GTS was used in C. If the constrained
triangulation is unavailable, fall back to single-spline routing.

**`spline_edges` entry point:**

`spline_edges(g)` calls `spline_edges0(g, true)` which determines edge type,
then calls `spline_edges1(g, edgetype)` which routes all edges. The
TypeScript equivalent is `splineEdges(g, ctx)`.

## Task

Port `lib/neatogen/neatosplines.c` and `lib/neatogen/multispline.c` to
TypeScript.

1. **`makeObstacle`**: Convert a node to a CW `Ppoly_t` obstacle polygon,
   expanded by the `sep` margin.

2. **`makeSpline`**: Route one edge through the obstacle visibility graph
   via `Proutespline` from pathplan.

3. **`makeSelfArcs`**: Build self-loop arc geometry for edges where
   tail == head.

4. **`getPath`**: Compute the obstacle-avoiding shortest path for an edge
   using `Pobspath` from pathplan.

5. **`splineEdges`**: Main edge routing entry point. Dispatches to ortho,
   pathplan spline, polyline, self-arc, or straight-line based on edge
   type and obstacle legality.

6. **`makeMultiSpline`** (from `multispline.c`): Route parallel edges through
   a shared router built from obstacle Delaunay triangulation.

## Write-Set

- `src/layout/neato/splines.ts`
- `src/layout/neato/splines.test.ts`

## Read-Set

- `~/git/graphviz/lib/neatogen/neatosplines.c` — full file: obstacle
  construction, edge routing dispatch tree, equivalent edge handling,
  self-arcs, aspect ratio, translation
- `~/git/graphviz/lib/neatogen/multispline.c` — full 1209-line file:
  `mkRouter`, `makeMultiSpline`, `freeRouter`
- `~/git/graphviz/docs/architecture/lib/neatogen.md` — `neatosplines.c`
  section including the routing dispatch decision tree and lib/ortho
  invocation conditions

## Architecture Decisions

- **AD-3**: `Proutespline` in pathplan returns an owned array in the
  TypeScript port (not a module-global buffer). The "caller must consume
  before next call" contract is eliminated.
- **AD-1**: `ED_count` → `e.info.count`; `ED_to_virt` → `e.info.toVirt`.

## Interface Contracts

```typescript
// src/layout/neato/splines.ts

export function makeObstacle(
  n: import('../../model/Node').Node,
  sep: import('../../model/types').ExpandT,
  isOrtho: boolean,
): import('../../pathplan').Ppoly;

export function splineEdges(
  g: import('../../model/Graph').Graph,
  ctx: import('../../gvc/context').GvcContext,
): void;

export function makeSelfArcs(
  e: import('../../model/Edge').Edge,
  stepx: number,
): void;
```

## Acceptance Criteria

1. When `splines=ortho` is set and node obstacles do not overlap, routing
   dispatches to the ortho module (`src/ortho/index.ts`) rather than
   pathplan.

2. When `splines=curved` or `splines=spline`, routing uses pathplan's
   `Proutespline` to fit Bezier curves.

3. When routing fails (obstacles overlap or path not found), edges fall
   back to straight-line geometry (`makeStraightEdge`).

## Observability

N/A — produces `EdgeInfo.spl` data; no external I/O.

## Rollback

Reversible. Writes only new files under `src/layout/neato/`. Revert by
removing the files.

## Quality Bar

- `tsc --noEmit` exits 0
- `vitest run src/layout/neato/splines.test.ts` exits 0
- One commit: `feat(neato): port neatosplines and multispline routing`
- Tests cover: ortho dispatch condition (splines=ortho + legal obstacles);
  spline routing produces non-null `EdgeInfo.spl` on a 2-node graph;
  self-loop produces arc geometry; straight-line fallback when obstacles
  overlap.

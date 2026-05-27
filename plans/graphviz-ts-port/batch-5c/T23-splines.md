# T23 — Spline Routing

## Context

The project is a faithful TypeScript 5.x port of Graphviz `lib/`, targeting
SVG output. TypeScript strict mode, Vitest, esbuild, EPL-2.0, no Node.js in
core.

`lib/common/splines.c` (1375 lines) is the high-level spline attachment layer
that sits above pathplan (T14). It implements:

- `clip_and_install` — the main entry point that routes an edge's spline
  through the box sequence, clips at node shapes, and writes results to
  `EdgeInfo.spl`.
- `new_spline` / `new_splinesv` — allocate Bezier/Spline structures.
- Self-edge routing (edges where tail == head).
- `routespl.c` — low-level spline routing through a box sequence using
  pathplan.

`lib/common/routespl.c` is a companion file (lower-level) that calls pathplan
directly. Both must be ported and tested together under `src/common/splines.ts`.

### Dependency on pathplan (T14)

`splines.c` calls into `lib/pathplan` at multiple points:
- `Pshortestpath` — for routing within a cluster boundary polygon
- `Proutespline` — for spline fitting after pathfinding
- `Ppolybarriers` — to convert node shapes to barrier edges
- `make_polyline` — to duplicate interior points for spline representation
- `Pobsopen` / `Pobsclose` / `Pobspath` — for full obstacle-aware routing

Import all of these from `src/pathplan/index.ts`.

### Obstacle avoidance

Node shapes are treated as opaque obstacles. The routing:
1. Converts all relevant node bounding boxes/shapes to `Ppoly_t` obstacles
2. Calls `Pobsopen` to build the visibility graph
3. Calls `Pobspath` to find the shortest path around obstacles
4. Calls `Proutespline` to fit a cubic Bezier spline to that path
5. Writes the result to `EdgeInfo.spl`

### Straight-line edges

For edges with no obstacles in the routing channel, `splines.c` produces a
degenerate two-point spline:
```
[P0, P0, P3, P3]
```
This is a degenerate cubic Bezier where both control points coincide with the
endpoints — a straight line in Bezier form.

### EdgeInfo.spl population

After successful routing, `EdgeInfo.spl` is a `Splines` object (an array of
`Bezier` structs). Each `Bezier` has:
- `list: Point[]` — control points in groups of 4 (P0, C1, C2, P1)
- `sflag`: start arrow flag
- `eflag`: end arrow flag
- `sp`: start arrow point
- `ep`: end arrow point

## Task

Port `lib/common/splines.c` and `lib/common/routespl.c` to
`src/common/splines.ts`.

Export the primary entry points:

```typescript
export function clipAndInstall(
  e: Edge,
  head: Node,
  ps: Point[],
  pn: number,
  si: SplineInfo,
): void;

export function newSpline(e: Edge, sz: number): Splines;
export function newSplinesv(e: Edge, sz: number): Splines;
```

Also port all supporting functions (obstacle routing, self-edge routing, box
routing, polyline routing). These are internal but must be present and correct
since they are called by `clipAndInstall`.

### Import requirements

```typescript
import { shortestPath, routeSpline, polyBarriers, makePolyline,
         obsOpen, obsClose, obsPath } from '../pathplan/index.js';
import { TextMeasurer } from './textmeasure.js';
import { ShapeDesc } from './shapes.js';
import { GraphInfo, NodeInfo, EdgeInfo, Bezier, Splines, SplineInfo } from './types.js';
```

## Write-Set

- `src/common/splines.ts`
- `src/common/splines.test.ts`

## Read-Set

- `~/git/graphviz/lib/common/splines.c` — full implementation (read in full;
  1375 lines; note all special cases for self-edges, straight-line fallback,
  obstacle routing)
- `~/git/graphviz/lib/common/splines.h` — declarations
- `~/git/graphviz/lib/common/routespl.c` — low-level routing through box
  sequence (calls pathplan)
- `~/git/graphviz/docs/architecture/lib/common.md` — splines.c description

## Architecture Decisions

- **AD-3**: pathplan returns owned arrays (already handled in T14); no
  module-global output state in this module either.

## Interface Contracts

```typescript
import { Point, Poly, Edge as PathEdge } from '../pathplan/index.js';
import { Bezier, Splines, SplineInfo } from './types.js';
import { Edge, Node } from '../graph/index.js';

/**
 * Routes edge `e` through the box sequence `ps[0..pn-1]`, clips at node
 * shapes, fits a cubic Bezier spline, and installs the result in
 * `e.info.spl`.
 *
 * Coordinate space: `ps` points are in PostScript points (same as the rest
 * of the layout coordinate system).
 */
export function clipAndInstall(
  e: Edge,
  head: Node,
  ps: Point[],
  pn: number,
  si: SplineInfo,
): void;

/** Allocates a new Splines struct with `sz` Bezier slots on edge `e`. */
export function newSpline(e: Edge, sz: number): Splines;
```

## Acceptance Criteria

1. Straight-line edges produce two-point splines: for an edge with no
   obstacles, `e.info.spl.list[0].list` has length 4 and the four points are
   `[P0, P0, P3, P3]` (degenerate straight-line Bezier).
2. Obstacle avoidance routes around node bounding boxes: given a graph with a
   node obstacle between tail and head, the routed spline's control points do
   not lie inside the obstacle node's bounding box.
3. `EdgeInfo.spl` is populated after routing: `clipAndInstall` sets
   `e.info.spl` to a non-null `Splines` object with at least one `Bezier`.
4. Self-edge routing produces a closed spline: for an edge with tail === head,
   the spline starts and ends at the same node boundary.

## Observability

N/A — pure algorithm module. No I/O or external calls.

## Rollback

Reversible. Only T24 (emit) and the layout engine modules (Batch 8+) import
from `src/common/splines.ts`.

## Quality Bar

- `tsc --noEmit` exits 0
- `vitest run src/common/splines.test.ts` exits 0
- All four acceptance criteria pass as explicit test cases
- 90% line coverage, 90% branch coverage (vitest `--coverage`)

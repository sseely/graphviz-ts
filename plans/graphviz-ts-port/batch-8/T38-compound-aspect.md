# T38 — Compound Edge Routing and Aspect Ratio

## Context

This is a faithful TypeScript port of the Graphviz `lib/` layer targeting SVG
output (`dot -Tsvg`). The C source is THE SPEC. T38 ports two files:
`lib/dotgen/compound.c` and `lib/dotgen/aspect.c`.

**compound.c:**

`dot_compoundEdges(g)` runs as the final step in the dot pipeline, after all
splines have been routed. It is only active when `compound=true` is set on the
graph. The function builds a cluster name→cluster map via `mkClustMap`, then
for each edge with `lhead` or `ltail` attributes calls
`makeCompoundEdge(e, clustMap)`.

`makeCompoundEdge` clips the already-computed Bézier spline at the cluster
bounding box boundary:

- **Head clip:** Forward scan through spline segments to find the first segment
  that crosses the head cluster's bounding box boundary.
- **Tail clip:** Backward scan through segments to find where the spline exits
  the tail cluster's bounding box.
- Each clip may produce a new spline segment. Order matters: head clip first,
  tail clip second, matching C behavior.
- `arrowEndClip`/`arrowStartClip` adjust arrowheads to the clipped endpoint.
- The result is a new Bézier point list with the trimmed segments.

**Degenerate case:**

When the actual node is inside the cluster (e.g., the node IS in the cluster),
the spline start or end may already be inside the cluster bounding box. In
this case `boxIntersectf` is used instead of `splineIntersectf` to find the
box boundary intersection from inside.

`splineIntersectf(pts, bb)` finds the first `t ∈ [0,1]` where the Bézier
crosses a box boundary using binary subdivision. The subdivision terminates
when the interval width falls below `1e-5` (epsilon in C source). Implement
the same termination condition.

`boxIntersectf(pp, cp, bb)` finds the intersection of line segment [pp, cp]
with box `bb`. Tries each of the four sides in order (left, right, bottom,
top) and returns the first valid intersection. The `round()` calls in the C
source must be replicated — they snap intersection coordinates to integer
points.

**Clipping order — must match C:**

The C implementation processes head clip before tail clip within
`makeCompoundEdge`. Each clip produces a new Bézier segment at the boundary.
If both `lhead` and `ltail` are set, both clips happen in sequence. The final
`bezier` struct has a reduced point list and updated `sp`/`ep` (start/end
points for arrow drawing).

**aspect.c:**

`setAspect(g)` reads the `aspect` attribute and immediately emits a warning
that the feature is disabled. Per the architecture doc: "This function exists
as a placeholder for a feature that was never completed. A TypeScript port
should implement it as a no-op." Implement it as a one-liner that does nothing
but is present in the module so the pipeline call in `dotinit.c` compiles.

## Task

Port `lib/dotgen/compound.c` to `src/layout/dot/compound.ts` and
`lib/dotgen/aspect.c` to `src/layout/dot/aspect.ts`. Write tests in
`src/layout/dot/compound.test.ts`. Tests must cover the compound edge clipping
paths including the degenerate (spline start inside cluster bbox) case.

## Write-Set

```
src/layout/dot/compound.ts
src/layout/dot/aspect.ts
src/layout/dot/compound.test.ts
```

## Read-Set

- `~/git/graphviz/lib/dotgen/compound.c` — full source
- `~/git/graphviz/lib/dotgen/aspect.c` — full source (stub implementation)
- `~/git/graphviz/docs/architecture/lib/dotgen.md` — compound.c section
  (dot_compoundEdges, makeCompoundEdge, splineIntersectf, boxIntersectf)

## Architecture Decisions

- AD-1: `ED_spl` (the `Spline` struct on `EdgeInfo`) is the data structure
  mutated by `makeCompoundEdge`. `EdgeInfo.spl.list` (array of `Bezier`) is
  replaced with a new trimmed array.
- **aspect.c is a no-op (locked per architecture doc):** Do not implement any
  aspect ratio logic. The function exists solely to satisfy the pipeline call.
  No test is required for aspect functionality beyond verifying the call
  doesn't throw.

## Interface Contracts

```typescript
/**
 * Clip already-computed splines to cluster bounding boxes for edges with
 * lhead or ltail attributes. Runs after dot_splines as the final pipeline
 * step.
 *
 * Only active when compound=true on the graph. Builds cluster name→Graph map
 * via mkClustMap (name is the subgraph name, e.g., "cluster_A").
 *
 * Clipping order per edge: head clip (forward scan) then tail clip (backward
 * scan). This order matches lib/dotgen/compound.c makeCompoundEdge() and must
 * not be reversed.
 */
export function dotCompoundEdges(g: Graph): void;

/**
 * Find first t in [0,1] where Bézier curve defined by pts crosses box bb.
 * Uses binary subdivision terminating when interval width < 1e-5.
 * Returns t value, or -1 if no crossing found.
 */
export function splineIntersectf(pts: Point[], bb: Box): number;

/**
 * Find intersection of line segment [pp, cp] with box bb.
 * Assumes cp is outside bb and pp is on or inside bb.
 * Tries sides in order: left, right, bottom, top.
 * Uses round() on intersection coordinates — matches C lib/dotgen/compound.c.
 */
export function boxIntersectf(pp: Point, cp: Point, bb: Box): Point;

/**
 * Aspect ratio control. This feature was never completed in Graphviz.
 * Per lib/dotgen/aspect.c: reads the 'aspect' attribute and emits a warning.
 * Implemented as a no-op in this port.
 */
export function setAspect(g: Graph): void;
```

## Acceptance Criteria

- Given an edge from a node inside cluster A to a node outside cluster A (with
  `lhead="cluster_A"` on the edge), when `dotCompoundEdges(g)` runs, then
  `EdgeInfo.spl.list[0]` has fewer control points than before clipping (the
  spline is trimmed at the cluster bbox boundary).
- Given an edge where the tail node is physically inside the `ltail` cluster
  (degenerate case: spline start inside bbox), when `dotCompoundEdges(g)`
  runs, then `boxIntersectf` is used (not `splineIntersectf`) and the
  returned intersection point lies on the cluster bbox boundary.
- Given an edge with both `lhead` and `ltail` set to different clusters, when
  `dotCompoundEdges(g)` runs, then two clip operations occur (both endpoints
  are trimmed) and the resulting spline's `sp` and `ep` fields are at the
  respective cluster bbox boundaries.
- Given `setAspect(g)` called on any graph, then it returns without throwing
  and does not modify any node coordinates (confirmed no-op).

## Observability

N/A — pure library.

## Rollback

Reversible — source-only addition.

## Quality Bar

- `tsc --noEmit` exits 0
- `vitest run` exits 0 for `src/layout/dot/compound.test.ts`
- One commit: `feat(dot): add compound edge clipping and aspect stub`

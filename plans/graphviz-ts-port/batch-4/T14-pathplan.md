# T14 — lib/pathplan Port

## Context

The project is a faithful TypeScript 5.x port of the Graphviz `lib/` layer,
targeting SVG output (`dot -Tsvg`). The stack is TypeScript strict mode,
Vitest for tests, esbuild for bundling, EPL-2.0, no Node.js APIs in core
modules. Source of truth is the C source; the architecture docs explain design
decisions that must be preserved verbatim.

`lib/pathplan` provides two independent facilities:

1. **`Pshortestpath`** — shortest Euclidean path inside a simple polygon via
   triangulation (ear-clipping) plus the funnel/sleeve algorithm.
2. **`Proutespline`** / `Pobspath` family — obstacle-avoiding spline routing
   via a visibility graph (Dijkstra) followed by cubic Bezier fitting.

The public API surface is declared in `pathplan.h`. The module is consumed by
`lib/common/splines.c` (T23), `lib/neatogen`, and `lib/fdpgen`.

**AD-3 (locked):** The C implementation returns pointers into module-global
static buffers (`ops`, `ispline`). The caller must consume the output before
the next call. In the TypeScript port, every function returns **owned arrays**
— fresh allocations every call. The "caller must consume before next call"
contract is eliminated. Two calls with identical inputs must produce equal but
distinct arrays (not the same reference).

## Task

Port the full public API of `lib/pathplan` to TypeScript:

- `shortestPath(boundary: Poly, endpoints: [Point, Point]): Point[]`
  — implements `Pshortestpath`. Returns an owned array.
- `routeSpline(barriers: Edge[], inputRoute: Point[], endpointSlopes: [Point, Point]): Point[]`
  — implements `Proutespline`. Returns an owned array of cubic Bezier control
  points (every 3 points define one cubic segment in standard Graphviz form:
  P0 C1 C2 P1 C3 C4 P2 ...).
- `polyBarriers(polys: Poly[]): Edge[]`
  — implements `Ppolybarriers`. Converts polygon obstacles to flat edge array.
- `makePolyline(line: Point[]): Point[]`
  — implements `make_polyline`. Duplicates interior points for spline
  representation. Returns owned array.
- `obsOpen(obstacles: Poly[]): VConfig`
  — implements `Pobsopen`. Builds visibility graph.
- `obsClose(config: VConfig): void`
  — implements `Pobsclose`.
- `obsPath(config: VConfig, p0: Point, poly0: number, p1: Point, poly1: number): Point[]`
  — implements `Pobspath`. Returns owned array.

### Algorithm faithfulness requirements

Port all algorithms exactly as described in
`~/git/graphviz/docs/architecture/lib/pathplan.md`:

**Ear-clipping triangulation** (`triang.c`): O(n²) per level. Orientation
test uses exact cross product (no epsilon) for triangulation. The `ISCCW=1`,
`ISCW=2`, `ISON=3` encoding is an internal detail; expose only the public
boolean results.

**Funnel/sleeve algorithm** (`shortest.c`): three-phase: orientation
normalization (detect and reverse CW polygon), constrained triangulation,
funnel walk with double-ended deque. The module-global `tris` and `ops` state
from C becomes local state per call — do not share state across calls.

**Degenerate cases in `shortestPath`**:
- Both endpoints in same triangle → return `[endpoints[0], endpoints[1]]`
- `marktripath` failure → return `[endpoints[0], endpoints[1]]` (silent degradation, not error)
- Endpoint not in any triangle → return -1 equivalent (throw or return null as
  documented in the interface)
- Consecutive duplicate polygon vertices → skip silently

**Visibility graph** (`visibility.c`): polygon edges always visible to their
own endpoints (unconditional). Cone test + clear test apply only to
non-adjacent vertex pairs. `wind` uses epsilon 0.0001 for collinearity (not
the exact `ccw` from triang.c). Lower-triangular adjacency matrix: entry
`vis[i][j]` (i≥j) only; upper triangle is not populated.

**Dijkstra** (`shortestpth.c`): uses negated-value trick (val stored negative
while unvisited, flipped positive when finalized). O(V²) linear scan for
minimum each iteration. Lower-triangular `wadj` access only.

**Bezier fitting** (`route.c`): `reallyroutespline` recursively fits a cubic
Bezier. The `a` schedule: start at 4, halve each iteration until `a ≤ 0.01`,
then set `a = 0`. Least-squares tangent scale via Cramer's rule; fallback to
`dist(p0, pn)/3` when `|det| < 1e-6` or scale ≤ 0. Arc-length shortcut
rejection on first iteration. The Bernstein basis functions B0–B3 plus the
compound forms B01 and B23 must match the exact formulas in the architecture
doc.

**`Ptriangulate`** is also exported for use by `lib/common/splines.c`:
`triangulate(polygon: Poly, callback: (tri: [Point, Point, Point]) => void): void`

**Orientation requirements** (preserve these exactly):
- `obsOpen`/`obsPath`/visibility: obstacles must be in CW order
- `shortestPath` boundary: auto-detected and reversed if CW
- `triangulate` (Ptriangulate): polygon must be in CCW order
- `inPoly`: polygon must be convex and CW

### `solve3` polynomial root-solver

Port `lib/pathplan/solvers.c` as an internal helper. The special return value
`4` means "infinitely many roots" (degenerate case). This propagates through
`splineIntersectsLine` in the Bezier fitting code.

## Write-Set

- `src/pathplan/index.ts`
- `src/pathplan/pathplan.test.ts`

All supporting types and internal helpers live in `src/pathplan/index.ts` or
as private functions within it. Do not create additional files.

## Read-Set

- `~/git/graphviz/lib/pathplan/pathplan.h` — public API
- `~/git/graphviz/lib/pathplan/route.c` — Proutespline, Bezier fitting
- `~/git/graphviz/lib/pathplan/shortest.c` — Pshortestpath, funnel algorithm
- `~/git/graphviz/lib/pathplan/shortestpth.c` — Dijkstra, makePath
- `~/git/graphviz/lib/pathplan/visibility.c` — visibility graph construction
- `~/git/graphviz/lib/pathplan/cvt.c` — Pobsopen, Pobsclose, Pobspath
- `~/git/graphviz/lib/pathplan/triang.c` — Ptriangulate, ear-clipping
- `~/git/graphviz/lib/pathplan/solvers.c` — solve3
- `~/git/graphviz/docs/architecture/lib/pathplan.md` — algorithm detail

## Architecture Decisions

- **AD-3**: Module-global C buffers → owned allocations. Every function
  returns a fresh array. Do not use module-level mutable state for output.
- **AD-9**: `isExactlyZero` uses DataView bit comparison when needed for
  `-0.0` correctness.

## Interface Contracts

```typescript
/** 2D point in layout coordinates (points). */
export interface Point { x: number; y: number }

/** Simple polygon or polyline. Points in order. */
export interface Poly { ps: Point[] }

/** A line-segment barrier edge. */
export interface Edge { a: Point; b: Point }

/** Opaque visibility graph handle. */
export interface VConfig { /* opaque */ }

/** Sentinel: point is definitely not inside any obstacle polygon. */
export const POLYID_NONE = -1111;
/** Sentinel: polygon containing the point is not yet known. */
export const POLYID_UNKNOWN = -2222;

/**
 * Finds the shortest Euclidean path from endpoints[0] to endpoints[1]
 * inside `boundary`.
 *
 * Returns an owned Point[] on success, or null if an endpoint is outside
 * the polygon (corresponds to C return value -1).
 *
 * Degenerate cases (same triangle, marktripath failure) return a two-point
 * direct line rather than null.
 */
export function shortestPath(
  boundary: Poly,
  endpoints: [Point, Point],
): Point[] | null;

/**
 * Fits a cubic Bezier spline to `inputRoute` without crossing any `barrier`.
 * `endpointSlopes` are pre-normalized tangent vectors at each end.
 *
 * Returns an owned Point[] of cubic Bezier control points:
 *   [P0, C1, C2, P1, C3, C4, P2, ...]
 * where P0 is inputRoute[0] and the last point is inputRoute[pn-1].
 *
 * Throws on malformed input (e.g. zero-length path with pn < 2).
 */
export function routeSpline(
  barriers: Edge[],
  inputRoute: Point[],
  endpointSlopes: [Point, Point],
): Point[];

/**
 * Converts polygon obstacles to a flat array of barrier edges.
 * Each polygon edge (ps[j], ps[(j+1)%pn]) becomes one Edge.
 */
export function polyBarriers(polys: Poly[]): Edge[];

/**
 * Converts a polyline into the duplicated-interior-point representation
 * required for spline fitting. Returns an owned array.
 *
 * Output layout:
 *   [P0, P0, P1, P1, P1, P2, P2, P2, ..., Pn-1, Pn-1]
 */
export function makePolyline(line: Point[]): Point[];

/** Builds a visibility graph from obstacle polygons (CW vertex order). */
export function obsOpen(obstacles: Poly[]): VConfig;

/** Frees all resources owned by a VConfig. */
export function obsClose(config: VConfig): void;

/**
 * Routes a polyline from p0 to p1 via Dijkstra on the visibility graph.
 * poly0 / poly1 are polygon IDs (POLYID_NONE or POLYID_UNKNOWN or 0-based
 * index into the obstacles array passed to obsOpen).
 * Returns an owned Point[].
 */
export function obsPath(
  config: VConfig,
  p0: Point,
  poly0: number,
  p1: Point,
  poly1: number,
): Point[];

/**
 * Triangulates a CCW simple polygon. Calls `callback` once per triangle.
 * Returns 0 on success, non-zero if no valid ear found (degenerate input).
 */
export function triangulate(
  polygon: Poly,
  callback: (tri: [Point, Point, Point]) => void,
): number;
```

## Acceptance Criteria

1. `routeSpline` returns a new array each call; two calls with identical
   inputs produce arrays that are equal in value but not the same reference
   (`result1 !== result2`, `result1[0] !== result2[0]`).
2. Two calls to `shortestPath` with the same inputs produce equal but distinct
   arrays (owned allocation, no shared state).
3. The visibility graph correctly handles convex polygons: `obsOpen` on a
   single convex polygon, `obsPath` routes between two exterior points and
   the path does not pass through the polygon interior.
4. `makePolyline([P0, P1, P2])` produces
   `[P0, P0, P1, P1, P1, P2, P2]` (length 7) — the exact duplication
   pattern from `cvt.c`.

## Observability

N/A — pure algorithm module, no I/O or external dependencies.

## Rollback

Reversible. The module has no side effects on global state. Removing or
replacing `src/pathplan/` has no impact on any other module until T23
(splines) imports from it.

## Quality Bar

- `tsc --noEmit` exits 0
- `vitest run src/pathplan/pathplan.test.ts` exits 0
- All four acceptance criteria pass as explicit test cases
- No module-level mutable state used for output (only for internal caches
  that are reset at the start of each public function call)
- 90% line coverage, 90% branch coverage (vitest `--coverage`)

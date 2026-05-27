# T24 — Emit Infrastructure

## Context

The project is a faithful TypeScript 5.x port of Graphviz `lib/`, targeting
SVG output. TypeScript strict mode, Vitest, esbuild, EPL-2.0, no Node.js in
core.

`lib/common/emit.c` (4365 lines) is the central rendering dispatch — the
code generator that iterates the graph, applies coordinate conversions, and
calls renderer callbacks in the correct order for every graph element.
It is the bridge between the layout algorithms (which populate `GraphInfo`,
`NodeInfo`, `EdgeInfo`) and the renderers (SVG, DOT/xdot, JSON, plain).

`emit.c` also contains `emit_xdot` — the dispatch loop that processes parsed
`xdot_op` arrays (from T15) and maps each op to the appropriate renderer
callback.

### Coordinate spaces — critical

Two coordinate spaces coexist in the graph data. **Never mix them without
explicit conversion.** Document every conversion site with a comment.

| Field | Unit | Notes |
|-------|------|-------|
| `NodeInfo.pos` | **inches** | `ND_pos` in C — used by neato/fdp/sfdp |
| `NodeInfo.coord` | **PostScript points** | `ND_coord` in C — used by dot; 1 pt = 1/72 inch |
| `NodeInfo.bb` | **PostScript points** | bounding box |
| `EdgeInfo.spl` | **PostScript points** | spline control points |
| Graph bounding box `GraphInfo.bb` | **PostScript points** | |
| SVG output | **SVG user units (points)** | 1 SVG unit = 1 pt in Graphviz output |

The conversion constant:

```typescript
/** PostScript to inches. 1 inch = 72 points. */
const PS2INCH = 1.0 / 72.0;
/** Inches to PostScript points. */
const INCH2PS = 72.0;
```

Every site in `emit.c` that converts `ND_pos` (inches) to screen coordinates
must be ported with an explicit comment:
```typescript
// ND_pos is in inches; convert to points for SVG
const x = node.info.pos[0] * INCH2PS;
```

### Callback order

`emit_graph` must invoke renderer callbacks in this order:

1. `beginGraph`
2. For each cluster (depth-first): `beginCluster` then cluster contents then `endCluster`
3. For each node: `beginNode`, node drawing ops, `endNode`
4. For each edge: `beginEdge`, edge drawing ops, `endEdge`
5. `endGraph`

**Cluster boxes are emitted before their contents.** This matches the C
traversal order in `emit.c`. The cluster nesting is depth-first; a cluster's
`beginCluster` call precedes all nested cluster and node begin calls.

### xdot dispatch

`emit_xdot(job, xdots)` iterates an array of `XdotOp` objects (from T15) and
calls the renderer's corresponding drawing function for each op. The op order
is preserved (no sorting or reordering).

### Label rendering

`emit_label(job, lp, obj)` handles both plain text labels and HTML labels:
- Plain text: calls `textspan` renderer callback for each text span.
- HTML labels: recursively renders table/cell/text structure.
- Label position is `lp.pos` in PostScript points.

### Per-object rendering

Each node, edge, and cluster is rendered by:
1. Calling the shape's `codefn` (which emits shape geometry as polygon/ellipse
   drawing calls)
2. Calling `emit_label` for node labels
3. Calling arrow drawing for edge arrowheads/tails (T22)
4. Calling xdot attribute dispatch for `_draw_`/`_ldraw_`/etc. attributes

## Task

Port `lib/common/emit.c` in full to `src/common/emit.ts`. The primary entry
point is:

```typescript
export function emitGraph(g: Graph, job: RenderJob): void;
```

Port all supporting functions: `emitLabel`, `emitXdot`, `emitNode`,
`emitEdge`, `emitCluster`, and all coordinate conversion helpers.

### RenderJob type

`RenderJob` is the context object passed to all renderer callbacks. It carries
the current graph, output state, and the renderer interface. Define it in
`src/common/emit.ts` (or in a shared types file if T18 has not already defined
it):

```typescript
export interface RenderJob {
  g: Graph;
  renderer: Renderer;
  // ... additional fields from GVJ_t as needed
}
```

### Renderer interface

The `Renderer` interface (from `typescript-port.md` Layer 4) is defined by
this task if not already defined elsewhere. See Interface Contracts below.

## Write-Set

- `src/common/emit.ts`
- `src/common/emit.test.ts`

## Read-Set

- `~/git/graphviz/lib/common/emit.c` — full implementation (read in full —
  all 4365 lines; note all special cases, coordinate conversions, cluster
  handling, xdot dispatch, and per-shape rendering)
- `~/git/graphviz/lib/common/emit.h` — public API declarations
- `~/git/graphviz/docs/architecture/lib/common.md` — emit.c description

## Architecture Decisions

- **AD-2**: Plugin system → direct dispatch. The `Renderer` interface replaces
  the C plugin vtable. `emitGraph` calls renderer methods directly.
- **AD-1**: No `GD_*`/`ND_*`/`ED_*` macro dereferencing — use typed fields.

## Interface Contracts

```typescript
export interface Renderer {
  beginGraph(g: Graph, job: RenderJob): void;
  endGraph(g: Graph, job: RenderJob): void;
  beginCluster(g: Graph, job: RenderJob): void;
  endCluster(g: Graph, job: RenderJob): void;
  beginNode(n: Node, job: RenderJob): void;
  endNode(n: Node, job: RenderJob): void;
  beginEdge(e: Edge, job: RenderJob): void;
  endEdge(e: Edge, job: RenderJob): void;
  textspan(pos: Point, span: TextSpan, job: RenderJob): void;
  ellipse(pos: Point, rx: number, ry: number, filled: boolean, job: RenderJob): void;
  polygon(pts: Point[], filled: boolean, job: RenderJob): void;
  bezier(pts: Point[], filled: boolean, job: RenderJob): void;
  polyline(pts: Point[], job: RenderJob): void;
  image(pos: Point, w: number, h: number, name: string, job: RenderJob): void;
  fillColor(color: string, job: RenderJob): void;
  penColor(color: string, job: RenderJob): void;
  font(size: number, name: string, job: RenderJob): void;
  style(s: string, job: RenderJob): void;
  fontchar(flags: number, job: RenderJob): void;
}

export interface RenderJob {
  g: Graph;
  renderer: Renderer;
  graphHeight: number;  // graph bounding box height in points (for Y-flip in SVG renderer)
}

/**
 * Renders the fully-laid-out graph `g` by calling `job.renderer` callbacks
 * in the correct order.
 *
 * Coordinate spaces:
 * - ND_pos is in inches; ND_coord/bounding boxes/splines are in points.
 *   PS2INCH = 1/72. Never mix without conversion.
 * - Every conversion site is documented with a comment.
 *
 * Call order:
 * 1. beginGraph
 * 2. Clusters depth-first (beginCluster → contents → endCluster)
 * 3. Nodes (beginNode → drawing ops → label → endNode)
 * 4. Edges (beginEdge → drawing ops → endEdge)
 * 5. endGraph
 */
export function emitGraph(g: Graph, job: RenderJob): void;
```

## Acceptance Criteria

1. `emitGraph` calls `beginGraph`/`endGraph` exactly once each, in the
   correct order: `beginGraph` before any node/edge callbacks,
   `endGraph` after all. Test with a mock `Renderer` that records call order.
2. Coordinate conversion from points to SVG units is applied correctly:
   a node with `NodeInfo.coord = { x: 72, y: 144 }` (= 1 inch, 2 inches)
   results in `beginNode` being called with coordinates that correspond to
   1pt = 1 SVG unit (i.e., the coordinates are passed through as points for
   the SVG renderer to handle).
3. Cluster boxes are emitted before their contents: for a graph with one
   cluster containing one node, `beginCluster` is called before `beginNode`
   in the callback sequence.
4. `emitXdot` passes xdot ops to the renderer in input order: parse a string
   with two ops (`E` then `T`), call `emitXdot`, verify `ellipse` is called
   before `textspan` in the renderer callback sequence.

## Observability

N/A — pure dispatch module. No I/O.

## Rollback

Reversible. Only the renderer modules (Batch 7) and integration tests import
from `src/common/emit.ts`.

## Quality Bar

- `tsc --noEmit` exits 0
- `vitest run src/common/emit.test.ts` exits 0
- All four acceptance criteria pass as explicit test cases
- 90% line coverage, 90% branch coverage (vitest `--coverage`)

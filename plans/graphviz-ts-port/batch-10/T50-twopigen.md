# T50 — twopi Layout Engine

## Context

Stack: TypeScript 5.x strict, Vitest, esbuild, EPL-2.0.

`lib/twopigen` implements the `twopi` radial layout algorithm (Graham
Wills, GD '97). It places nodes on concentric rings centered on a
selected root node. A node's ring index equals its BFS distance from
the root; its angular position is proportional to its subtree's share
of the 2π span.

Source files:
- `~/git/graphviz/lib/twopigen/circle.c` — core seven-phase algorithm
- `~/git/graphviz/lib/twopigen/twopiinit.c` — lifecycle orchestration

Architecture doc:
`~/git/graphviz/docs/architecture/lib/twopigen.md`

This task depends on T48 (pack) for `ccomps` and `packSubgraphs`.

## Task

Port both twopigen C files to TypeScript:

| C source | TS module |
|---|---|
| `twopiinit.c` | `layout/twopi/init.ts` |
| `circle.c` | `layout/twopi/circle.ts` |
| (engine entry point) | `layout/twopi/index.ts` |

### Critical: rdata freed before spline routing

`twopi_layout` in `twopiinit.c` (from `twopigen.md` §"ND_alg Freed
Mid-Layout"):

> In twopi_layout, the shared rdata array is freed and ND_alg(n) is
> set to NULL before spline_edges and packSubgraphs are called. This
> is deliberate: edge routing (spline_edges) may store its own data in
> ND_alg.

TypeScript layout sequence in `index.ts`:
1. `twopi_init_graph(g)` — allocate rdata, neato_nlist
2. `ccomps(g)` — decompose into components
3. For each component: `circleLayout(sg, center)` + `adjustNodes(sg)`
4. **Free rdata block**: null `NodeInfo.alg` on all nodes (or just the
   first node — see contiguous allocation note below), assign
   `GraphInfo.neato_nlist = null`
5. If multiple components: `packSubgraphs(...)` from T48
6. `spline_edges(g)` — route edge splines
7. `dotneato_postprocess(g)`

Add an assertion comment at step 4:
```typescript
// ORDERING: rdata freed HERE, before spline routing. spline_edges may
// store its own data in NodeInfo.alg. See twopiinit.c twopi_layout().
```

Do NOT reorder steps 4 and 6. This ordering is a stop condition.

### Critical: rdata contiguous allocation

`twopi_init_node_edge` allocates one block for all `rdata` structs:

```c
rdata *data = gv_calloc(agnnodes(g), sizeof(rdata));
for each node n at index i:
    ND_alg(n) = &data[i];
```

TypeScript port: allocate one `RData[]` array, assign each element to
`node.info.alg`. At cleanup, null `alg` on the first node only (the
array is GC'd).

### rdata discriminated union kind

```typescript
interface TwopiRData {
  kind: 'twopi-rdata';
  nStepsToLeaf: number;   // SLEAF: leaf distance for center finding
  subtreeSize: number;    // STSIZE: leaf count in subtree
  nChildren: number;      // NCHILD: BFS children count
  nStepsToCenter: number; // SCENTER: ring index (BFS distance from root)
  parent: Node | null;    // SPARENT: BFS tree parent
  span: number;           // SPAN: angular span in radians
  theta: number;          // THETA: angular midpoint; UNSET = 10.0 sentinel
}
```

The UNSET sentinel is `10.0` (outside `[0, 2π]`). Use the exported
constant `THETA_UNSET = 10.0` — do not inline the literal.

### Seven-phase algorithm (circle.ts)

**Phase 1 — initLayout:**
- `SCENTER` = `n²` (INF sentinel)
- `THETA` = `UNSET` (10.0)
- `SLEAF` = 0 for leaves (≤1 distinct neighbor), `n²` for non-leaves
- Neighbor deduplication: self-loops skip; multi-edges to same neighbor
  count as one neighbor

**Phase 2 — Center selection (findCenterNode):**
- DFS from every leaf node, calling `setNStepsToLeaf`
- `setNStepsToLeaf`: update `SLEAF` only if `current + 1 < neighbor.SLEAF`
  (strict less-than prevents infinite loops on cycles)
- Return node with maximum resulting `SLEAF`

**Phase 3 — BFS tree construction (setNStepsToCenter):**
- BFS from center; assign `SCENTER` and `SPARENT` per node
- Skip edges with `weight = 0`
- Increment `NCHILD(parent)` for each child discovered
- Returns maximum SCENTER found; returns `Number.MAX_SAFE_INTEGER` if
  any node unreachable (weight=0 disconnection)

**Phase 4 — Subtree sizing (setSubtreeSize):**
- For each BFS-leaf (NCHILD == 0), walk SPARENT chain, increment
  `STSIZE` at each ancestor
- Result: `subtreeSize` = count of leaf nodes in each node's subtree

**Phase 5 — Span apportionment (setSubtreeSpans):**
- Root: `SPAN = 2 * Math.PI`
- Each child: `SPAN(child) = SPAN(parent) * STSIZE(child) / STSIZE(parent)`
- Guard against double-processing multi-edges: skip if `SPAN(next) !== 0.0`

**Phase 6 — Angular position assignment (setPositions):**
- Root: `THETA = 0`
- For each node, fan children starting at `THETA(n) - SPAN(n) / 2`
- Each child placed at `fanStart + SPAN(child) / 2`; fan advances by `SPAN(child)`
- Guard against double-processing multi-edges: skip if theta already set
  (`is_set(THETA(next))` checks `theta !== UNSET`)

**Phase 7 — Cartesian conversion (setAbsolutePos):**
- `getRankseps`: parse `ranksep` attribute (colon-separated deltas,
  last value repeats); build cumulative radius array; minimum per-ring
  delta = `MIN_RANKSEP` (0.02)
- `x = ranksep[ring] * Math.cos(theta)`
- `y = ranksep[ring] * Math.sin(theta)`
- Write to `NodeInfo.pos[0]` and `NodeInfo.pos[1]`

**Single-node short-circuit:**
`circleLayout` returns immediately when `agnnodes(sg) === 1`, placing
the node at (0, 0).

### Root selection priority chain

Three mechanisms in priority order:
1. Graph-level `root` attribute names a node by name — use that node
2. If named lookup fails: emit warning, fall back to algorithmic selection
3. Per-node boolean `root` attribute — `findRootNode` returns first match
4. Algorithmic: `findCenterNode` (maximizes `nStepsToLeaf`)

When named root is given but not found, the fallback is mechanism 4 (not
mechanism 3). Emit `console.warn`.

### Multi-component packing

`twopi_layout` flow for multiple components (from `twopiinit.c`):
1. For each component subgraph: `graphviz_node_induce(sg)` to attach edges
2. `circleLayout(sg, center)`
3. `adjustNodes(sg)`
4. Free rdata block (see critical ordering above)
5. `packSubgraphs(ncc, ccs, g, pinfo)` — from T48
6. `spline_edges(g)`

Write the selected center's name back to the graph `root` attribute if
algorithmic selection was used (`setRoot` flag equivalent).

## Write-Set

- `src/layout/twopi/circle.ts`
- `src/layout/twopi/init.ts`
- `src/layout/twopi/index.ts`
- `src/layout/twopi/twopi.test.ts`

## Read-Set

- `~/git/graphviz/lib/twopigen/circle.c`
- `~/git/graphviz/lib/twopigen/twopiinit.c`
- `~/git/graphviz/lib/twopigen/circle.h`
- `~/git/graphviz/docs/architecture/lib/twopigen.md`
- `src/layout/pack/index.ts` — for ccomps, packSubgraphs, getPackInfo
- `src/types/graph.ts` — for Graph, Node, Edge, Box, Point

## Architecture Decisions

**AD-1:** Replace GD_*/ND_*/ED_* macro accessors with typed fields.

**AD-7:** `NodeInfo.alg` discriminated union. twopi uses kind
`'twopi-rdata'`. This is defined in this task; no other task uses this
kind.

**AD-9:** `is_exactly_zero` uses DataView bit comparison. Import from
`src/util/math.ts` for the `weight = 0` edge exclusion check.

## Interface Contracts

Engine registration name: `"twopi"`.

```typescript
export function twopi_layout(g: Graph): void;
export function twopi_cleanup(g: Graph): void;
```

`circleLayout` signature (called from init.ts):
```typescript
export function circleLayout(sg: Graph, center: Node | null): Node;
// Returns: the actual center node used
```

## Acceptance Criteria

1. `rdata` freed before spline routing: the comment
   `// ORDERING: rdata freed HERE, before spline routing` appears
   immediately before the cleanup code in `index.ts`. A unit test
   verifies `NodeInfo.alg === null` for all nodes after the rdata free
   step (before spline routing).

2. Root node at center: given a star graph (center + 5 leaves), the
   center node is placed at `(0, 0)` and all leaf nodes are placed at
   equal radius from the origin. Verified in `twopi.test.ts`.

3. BFS assigns correct ring indices: given a path graph of 5 nodes
   (0—1—2—3—4), the center (node 2) has `SCENTER = 0`, nodes 1 and 3
   have `SCENTER = 1`, nodes 0 and 4 have `SCENTER = 2`. Unit test
   verifies this after `setNStepsToCenter`.

4. Engine registration: `getLayoutEngine('twopi')` returns the
   `twopi_layout` function. Verified in `twopi.test.ts`.

## Observability

N/A

## Rollback

Reversible. `src/layout/twopi/` is a new directory.

## Quality Bar

- `tsc --noEmit` exits 0 for all files in `src/layout/twopi/`
- `vitest run src/layout/twopi/twopi.test.ts` exits 0
- 90% line / branch / function coverage
- No `any` casts
- `THETA_UNSET` exported constant used everywhere; no inline `10.0`
  in comparisons

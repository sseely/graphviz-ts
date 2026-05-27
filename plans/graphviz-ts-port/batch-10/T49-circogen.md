# T49 — circo Layout Engine

## Context

Stack: TypeScript 5.x strict, Vitest, esbuild, EPL-2.0.

`lib/circogen` implements the `circo` circular layout algorithm. It
places biconnected components onto circles and arranges those circles
hierarchically via a block-cutpoint tree. The implementation follows
Six and Tollis (GD '99) and Kaufmann and Wiese (GD '02).

Source files:
- `~/git/graphviz/lib/circogen/circularinit.c` — plugin entry points,
  derived-graph construction
- `~/git/graphviz/lib/circogen/block.c` — block allocation and list ops
- `~/git/graphviz/lib/circogen/blocktree.c` — Tarjan biconnected
  components + block-cutpoint tree construction
- `~/git/graphviz/lib/circogen/blockpath.c` — per-block circle layout
- `~/git/graphviz/lib/circogen/circular.c` — per-component orchestration
- `~/git/graphviz/lib/circogen/circpos.c` — block-tree positioning
- `~/git/graphviz/lib/circogen/nodelist.c` — circular order manipulation
- `~/git/graphviz/lib/circogen/edgelist.c` — open-edge tracking for
  crossing counting

Architecture doc:
`~/git/graphviz/docs/architecture/lib/circogen.md`

This task depends on T48 (pack) being complete, because `circoLayout`
calls `ccomps` and `packSubgraphs` for disconnected graphs.

## Task

Port all eight circogen C files to the TypeScript modules listed in the
write-set. Use the file mapping from `typescript-port.md`:

| C source | TS module |
|---|---|
| `block.c` + `blockpath.c` + `blocktree.c` | `layout/circo/blocks.ts` |
| `circular.c` | `layout/circo/circular.ts` |
| `circpos.c` | `layout/circo/position.ts` |
| `nodelist.c` + `edgelist.c` | `layout/circo/lists.ts` |
| `circularinit.c` | `layout/circo/init.ts` |
| (engine entry point) | `layout/circo/index.ts` |

### Critical: ndata contiguous allocation

In `circularinit.c`, `circular_init_node_edge` allocates all `ndata`
structs as a single contiguous block:

```c
ndata *data = gv_calloc(agnnodes(g), sizeof(ndata));
for each node n at index i:
    ND_alg(n) = &data[i];
```

The block is freed in `circo_layout` by freeing only
`ND_alg(agfstnode(g))` — the first node's pointer, which is the base
of the allocation. Freeing per-node is wrong.

TypeScript port: allocate one `NData[]` array; assign
`node.info.alg = { kind: 'circo-ndata', ...ndataFields }` pointing
at the array entry. In cleanup, null `alg` only on the first node (the
array is garbage-collected). Add a JSDoc comment:

```typescript
// MEMORY: all ndata objects are allocated as one array; only the first
// node's alg reference is nulled in cleanup (matches C single-free pattern).
```

Note: `ndata` is the lightweight Pass 0 struct (`dnode` pointer only).
`cdata` is the richer per-derived-node layout struct used in Passes 1–4.
Both are stored via `NodeInfo.alg` at different phases. Use discriminant
`kind: 'circo-ndata'` and `kind: 'circo-cdata'` in the union.

### ND_alg discriminated union kinds for circo

Per AD-7, `NodeInfo.alg` is a discriminated union. Add these kinds:

```typescript
interface CircoNData {
  kind: 'circo-ndata';
  dnode: Node | null;  // pointer to derived-graph counterpart
}

interface CircoCData {
  kind: 'circo-cdata';
  orig: { g: Graph | null; np: Node | null };
  flags: number;
  parent: Node | null;
  block: Block | null;
  // union fields (one active per pass):
  bc: { next: Node | null; val: number; lowVal: number };
  clone: Node | null;
  t: { tparent: Node | null; first: Node | null; second: Node | null; fdist: number; sdist: number };
  f: { pos: number; psi: number };
}
```

The `kind: 'circo-cdata'` discriminant ensures no cast is needed when
accessing these fields from circo code.

### Algorithm: four-pass pipeline

**Pass 0 — Derived graph (`circomps` equivalent):**
- Build a strict undirected derived graph from the input.
- Drop self-loops and collapse multi-edges (graph is strict).
- Find connected components via `ccomps` (imported from T48).
- Allocate `EdgeInfo.alg` (edata) for all derived edges.

**Pass 1 — Biconnected components (Tarjan's algorithm):**
- DFS from chosen root; assign `VAL` (discovery time) and `LOWVAL`.
- When `LOWVAL(v) >= VAL(u)`, pop edge stack to form a block.
- Articulation points go into the first non-trivial block they would
  join; they are not duplicated.
- VAL = 0 is the "unvisited" sentinel. orderCount starts at 1 so the
  root node gets VAL = 1 (never 0).

**Pass 2 — Block-cutpoint tree (`createBlocktree`):**
- For each non-root block, find the node with minimum VAL; its PARENT
  is the cutpoint linking it to the parent block.
- Wire blocks into a rooted tree via `block.children` lists.

**Pass 3 — Per-block circle layout (`layout_block`):**
- `remove_pair_edges`: skeleton via iterative degree-sorted removal.
- `spanning_tree` + `find_longest_path`: diameter path as initial order.
- `place_residual_nodes`: insert remaining nodes near neighbors.
- `reduce_edge_crossings`: up to CROSS_ITER = 10 rounds of local search.
- Radius formula: `radius = N * (minDist + largestNodeSize) / (2 * Math.PI)`
  Single-node block: `radius = largestNodeSize / 2`.
- Positions: `(radius * cos(2π * k / N), radius * sin(2π * k / N))`.

**Pass 4 — Block-tree positioning (`doBlock` / `circPos`):**
- Post-order traversal: layout children first, then position children
  around the current block's circle.
- `getInfo` / `setInfo`: resolve scale factors to avoid adjacent-parent
  overlap.
- COALESCED optimization: when a block has exactly one child block,
  shift the parent off-center by `-(maxRadius + minDist/2)` and set
  the COALESCED flag. `getRotation` has a special trigonometric path
  for COALESCED blocks.
- `applyDelta`: rotate then translate, recursing into all children.

### Edge routing order (CRITICAL)

`circo_layout` in `circularinit.c`:
1. `circo_init_graph` — allocate ndata, init nodes/edges
2. `circoLayout` — build derived graph, run circular layout passes
3. **Free `ND_alg(agfstnode(g))`** — frees the entire ndata block
4. `spline_edges` — route edge splines (may use ND_alg internally)
5. `dotneato_postprocess`

TypeScript must follow this exact order. Do not call the spline router
before nulling the alg fields.

### Disconnected graphs

For a single component: call `adjustNodes` (overlap removal) then
return. For multiple components: call `packSubgraphs` (from T48) to
arrange the laid-out components.

### oneblock graph attribute

If `oneblock=true` on the graph, bypass biconnected-component
decomposition entirely and place all nodes in one block.

## Write-Set

- `src/layout/circo/blocks.ts`
- `src/layout/circo/circular.ts`
- `src/layout/circo/position.ts`
- `src/layout/circo/lists.ts`
- `src/layout/circo/init.ts`
- `src/layout/circo/index.ts`
- `src/layout/circo/circo.test.ts`

## Read-Set

- `~/git/graphviz/lib/circogen/circularinit.c`
- `~/git/graphviz/lib/circogen/block.c`
- `~/git/graphviz/lib/circogen/blocktree.c`
- `~/git/graphviz/lib/circogen/blockpath.c`
- `~/git/graphviz/lib/circogen/circular.c`
- `~/git/graphviz/lib/circogen/circpos.c`
- `~/git/graphviz/lib/circogen/nodelist.c`
- `~/git/graphviz/lib/circogen/edgelist.c`
- `~/git/graphviz/lib/circogen/circular.h`
- `~/git/graphviz/lib/circogen/block.h`
- `~/git/graphviz/docs/architecture/lib/circogen.md`
- `src/layout/pack/index.ts` — for ccomps, packSubgraphs, getPackInfo
- `src/types/graph.ts` — for Graph, Node, Edge, Box, Point

## Architecture Decisions

**AD-1:** Replace GD_*/ND_*/ED_* macro accessors with plain typed fields.

**AD-7:** `NodeInfo.alg` is a discriminated union. circo uses two kinds:
`kind: 'circo-ndata'` (Pass 0, original graph nodes) and
`kind: 'circo-cdata'` (Passes 1–4, derived graph nodes). Both are
defined in this task. The `kind` field is the sole type discriminant —
no casts to `unknown` or `any`.

## Interface Contracts

The engine must register under the name `"circo"` in the engine
registry. The entry point signature:

```typescript
export function circoLayout(g: Graph): void;
export function circoCleanup(g: Graph): void;
```

`circoLayout` must call `dotneato_postprocess(g)` before returning.

Block objects must expose:
```typescript
interface Block {
  child: Node | null;
  next: Block | null;
  subGraph: Graph;
  radius: number;
  rad0: number;
  circleList: Node[];
  children: Block[];
  parentPos: number;
  flags: number;
}
```

## Acceptance Criteria

1. `ndata` allocation: a JSDoc comment on the allocation site in
   `init.ts` documents that all ndata objects share one array, and
   `circoCleanup` nulls `alg` only on the first node. A unit test
   asserts the alg field is null on all nodes after cleanup.

2. Biconnected components: given a graph with one bridge edge (two
   triangles connected by a single edge), `createBlocktree` identifies
   exactly two blocks and the bridge node is the cutpoint. Verified
   by unit test in `circo.test.ts`.

3. Circular layout output: the engine produces a layout where all nodes
   are placed on circles and no two node bounding boxes overlap (within
   floating-point tolerance), verified against a 6-node cycle graph and
   a 10-node graph with two biconnected components.

4. Engine registration: `getLayoutEngine('circo')` returns the
   `circoLayout` function (not null). Verified in `circo.test.ts`.

## Observability

N/A

## Rollback

Reversible. `src/layout/circo/` is a new directory. Nothing imports it
until the engine registry entry is added in `index.ts`.

## Quality Bar

- `tsc --noEmit` exits 0 for all files in `src/layout/circo/`
- `vitest run src/layout/circo/circo.test.ts` exits 0
- 90% line / branch / function coverage on all non-debug code paths
- No `any` casts
- No `/ 72` or `* 72` — all coordinate conversions use `ps2inch`/`inch2ps`
  from `src/layout/pack/index.ts`

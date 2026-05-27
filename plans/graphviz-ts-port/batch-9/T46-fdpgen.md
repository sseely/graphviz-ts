# T46 — fdp Layout Engine

## Context

fdp implements the Fruchterman-Reingold spring-embedder with hierarchical
cluster support. It lives in `lib/fdpgen/`. The engine is structured as a
two-phase simulation:

- **Phase 1 (`fdp_tLayout`)**: Point-node force iteration — all nodes are
  treated as point masses. Uses either O(n²) all-pairs repulsion or
  grid-accelerated repulsion (spatial hash).
- **Phase 2 (`fdp_xLayout`)**: Node-size expansion — expands the point layout
  to accommodate actual node sizes, resolving overlaps.

**fdp-specific files (not shared with neato):**

- `fdpinit.c`: initialization, cleanup
- `grid.c`: spatial hash grid for O(n)-approximate repulsion
- `clusteredges.c`: compound edge routing that avoids cluster boundaries
- `comp.c`: connected component finder with special port/pinned merging logic

**Shared with neato (already ported in T40–T45):**

- APSP (T40): not used directly by fdp — fdp uses its own force model
- VPSC overlap removal (T43): `fdp_xLayout` calls `removeOverlapAs` for the
  `prism` mode (9 tries of annealing then prism method, the default)
- Spline routing (T44): `fdpSplines` calls `spline_edges1` from T44, or
  `compoundEdges` (from `clusteredges.c`) when `splines=compound`

**Force model:**

Two attractive force variants controlled by `useNew`:
- `useNew=0` (default): `force = weight × d / L(e)` (ratio-based)
- `useNew=1`: `force = weight × (d - L(e)) / d` (Hooke spring)

Repulsion: `force = K² / d²` (default) or `force = K² / d³` (useNew=1).

Temperature schedule: linear cooling `T(t) = T0 × (maxIters - t) / maxIters`.

Default `T0 = Tfact × K × sqrt(n) / 5`. Default `maxIters = 600`.

**Grid spatial hash (`grid.c`):**

Cell size is `3K`. Only nodes within one cell-neighborhood (3×3 cells,
distance ~`3K√2 ≈ 4.2K`) experience repulsion. The C code uses a global
singleton `_grid` because CDT callbacks can't carry user data. In TypeScript,
the Grid class carries its own state — no singleton needed.

**Cluster hierarchy:**

`deriveGraph` collapses each cluster subgraph to a single proxy node in a
derived working graph. Port nodes (synthetic boundary nodes) are placed on
the cluster ellipse perimeter. Layout runs recursively: derived graph first,
then expand each cluster and recurse.

**`ED_to_virt` dual use (section 6.14 of interconnections.md):**

In derived graphs, `ED_to_virt` is repurposed as an `edge_t**` list of all
real edges collapsed into one derived edge. In the real graph, `ED_to_virt`
is used by the spline router for virtual chains. These are disjoint contexts.
In TypeScript: use `EdgeInfo.toVirt` for the spline chain, and a separate
`EdgeInfo.realEdges?: Edge[]` field for the fdp derived-graph list.

**Temperature reset across recursion:**

`init_params` returns a boolean indicating whether it auto-computed `T0`.
After the layout loop, if `T0` was auto-computed, it is reset to `-1` so
recursive sub-cluster layouts compute their own temperature independently.

**Connected components (`comp.c`):**

`findCComp` merges port nodes and pinned nodes into component 0. Component 0
is treated as fixed (immovable) when packing. `bp[0] = true` signals this.

## Task

Port the fdp-specific files in `lib/fdpgen/` to TypeScript. This task builds
on the neato shared infrastructure (T43, T44, T45).

1. **`grid.ts`**: Spatial hash grid. Hash cells keyed by `(i, j)` integer
   coordinates. `addGrid`, `findGrid`, `walkGrid`, `clearGrid`. No CDT
   singleton — the Grid class owns its map internally.

2. **`comp.ts`**: `findCComp` — DFS-based connected component finder that
   merges port nodes and pinned nodes into component 0.

3. **`clusteredges.ts`**: `compoundEdges` — routes edges avoiding cluster
   boundaries. Builds obstacle lists per edge based on cluster hierarchy,
   then calls `makeSpline` (T44) for each edge.

4. **`init.ts`**: `fdpInitNodeEdge`, `fdpInitParams`, `fdpInitGraph`,
   `fdpCleanup`, `fdp_tLayout`, `fdp_xLayout`, `fdpLayout`.

5. **`index.ts`**: `fdpLayout(g, ctx)` — public entry point registered as
   `"fdp"`. Calls: init → layout (recursive) → setClustNodes →
   evalPositions → setBB → fdpSplines → postprocess.

## Write-Set

- `src/layout/fdp/init.ts`
- `src/layout/fdp/grid.ts`
- `src/layout/fdp/clusteredges.ts`
- `src/layout/fdp/comp.ts`
- `src/layout/fdp/index.ts`
- `src/layout/fdp/fdp.test.ts`

## Read-Set

- `~/git/graphviz/lib/fdpgen/fdpinit.c` — initialization, cleanup,
  `init_edge`, `init_node`, `initialPositions`
- `~/git/graphviz/lib/fdpgen/grid.c` — spatial hash implementation,
  `mkGrid`, `adjustGrid`, `clearGrid`, `addGrid`, `walkGrid`, `findGrid`
- `~/git/graphviz/lib/fdpgen/clusteredges.c` — compound edge routing,
  `makeClustObs`, `objectList`, `compoundEdges`
- `~/git/graphviz/lib/fdpgen/comp.c` — `findCComp`, `dfs`
- `~/git/graphviz/docs/architecture/lib/fdpgen.md` — all sections; pay
  particular attention to the non-obvious behavior notes and the
  dependency map

## Architecture Decisions

- **AD-1**: `GD_alg` for cluster derived-graph pointer → `g.info.derivedGraph`;
  `ND_alg` for derived node data → `n.info.alg` with `kind: 'fdp'` discriminant
  per AD-7.
- No CDT singleton for grid — Grid class owns its own `Map<string, Cell>`.
- `ED_to_virt` in derived graphs → `e.info.realEdges?: Edge[]` (separate from
  spline chain `e.info.toVirt`).

## Interface Contracts

```typescript
// src/layout/fdp/index.ts

/** Public entry point. Registered as the "fdp" layout engine. */
export function fdpLayout(
  g: import('../../model/Graph').Graph,
  ctx: import('../../gvc/context').GvcContext,
): void;

// src/layout/fdp/grid.ts

export class Grid {
  add(i: number, j: number, node: import('../../model/Node').Node): void;
  find(i: number, j: number): Cell | undefined;
  walk(fn: (cell: Cell, grid: Grid) => void): void;
  clear(): void;
}
```

## Acceptance Criteria

1. fdp produces a force-directed layout: after layout, node positions are
   non-trivially different from initial positions on a connected 5-node graph.

2. Clusters are treated as super-nodes in the derived graph: layout runs on
   the derived graph first, then recurses into clusters.

3. Grid spatial hash correctly limits repulsion to within-neighborhood pairs:
   nodes outside cell-neighborhood distance do not interact.

## Observability

N/A — layout functions; no external I/O.

## Rollback

Reversible. Writes only new files under `src/layout/fdp/`. Revert by
removing the files.

## Quality Bar

- `tsc --noEmit` exits 0
- `vitest run src/layout/fdp/fdp.test.ts` exits 0
- One commit: `feat(fdp): port fdp layout engine`
- Tests cover: engine registration as `"fdp"`; non-trivial positions after
  layout on 5-node graph; Grid add/find/walk/clear round-trip; `findCComp`
  merges pinned nodes into component 0.

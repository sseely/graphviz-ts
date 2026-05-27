# T51 — osage Layout Engine

## Context

Stack: TypeScript 5.x strict, Vitest, esbuild, EPL-2.0.

`lib/osage` implements the `osage` layout engine. It treats every
cluster and loose node as an opaque rectangle and delegates all geometry
to `lib/pack`. The result is a nested tile map of clusters. Osage does
not use force-directed or rank-based placement.

Source file: `~/git/graphviz/lib/osage/osageinit.c`
Architecture doc: `~/git/graphviz/docs/architecture/lib/osage.md`

This task depends on T48 (pack) for `putRects`, `getPackInfo`,
and related infrastructure.

## Task

Port `osageinit.c` to `src/layout/osage/index.ts`.

### Critical: ND_alg stores cluster ownership tag, not position data

From `osage.md` §"ND_alg is used as a cluster-ownership tag":

> osage repurposes [ND_alg] as an ownership marker during layout():
> when a node is added to a cluster's child list, ND_alg(n) is set to
> the cluster graph pointer. Nodes where ND_alg(n) is non-NULL are
> skipped in all ancestor calls, ensuring each node is counted exactly
> once.

TypeScript discriminated union kind for this:

```typescript
interface OsageAlg {
  kind: 'osage';
  ownerCluster: Graph;  // the innermost cluster that owns this node
}
```

`PARENT(n)` macro in C is `(Agraph_t*)ND_alg(n)`. TypeScript equivalent:
```typescript
function PARENT(n: Node): Graph | null {
  return n.info.alg?.kind === 'osage'
    ? n.info.alg.ownerCluster
    : null;
}
```

All nodes must have `alg.kind === 'osage'` during the layout pass.
Nodes not yet claimed have `alg === null`. A node is claimed by setting
`n.info.alg = { kind: 'osage', ownerCluster: g }` when it is added to
cluster `g`'s child list.

This is a completely different use from dot, neato, circo, or twopi.
The kind discriminant `'osage'` must be distinct from all others.

### Algorithm: recursive cluster packing

**Step 1 — `cluster_init_graph`:**
Initialize all nodes and edges. Force `Ndim = 2`. Call `neato_init_node`
for every node. Bind `EdgeInfo` and call `common_init_edge` for every
out-edge. Default edge type: `EDGETYPE_LINE`.

**Step 2 — `mkClusters`:**
Recursively discover cluster subgraphs (`is_a_cluster`: name starts
with `"cluster"`). For each cluster: bind `GraphInfo`, call
`do_graph_label`, append to parent's cluster list. Non-cluster
subgraphs are transparent — their cluster children are promoted to the
nearest enclosing cluster or root. Build `GD_clust` arrays with a
1-indexed convention (index 0 is always null sentinel).

**Step 3 — `layout(g, depth = 0)` — recursive:**

1. Recurse into each direct subcluster: `layout(subcluster, depth + 1)`.
   After recursion, `GraphInfo.bb` for the subcluster has `ll = (0,0)`.

2. Count `total` = (loose nodes) + (subclusters). If `total === 0` and
   no label: assign `DFLT_SZ × DFLT_SZ` (18 × 18 pt) bounding box
   and return.

3. `getPackInfo(g, PackMode.Array, DFLT_MARGIN, pinfo)`. If resulting
   mode < `PackMode.Graph`, upgrade to `PackMode.Graph` silently.

4. If mode is `l_array` with `PK_USER_VALS`, read `sortv` attributes.

5. Build child lists: bounding boxes `gs[]`, child pointers `children[]`,
   sort values `vals[]`. Loose nodes (where `PARENT(n) === null`) are
   added; set `n.info.alg = { kind: 'osage', ownerCluster: g }` when
   added. Each node box is `{ ll: {x:0,y:0}, ur: {x: ND_xsize(n), y: ND_ysize(n)} }`.

6. `putRects(count, gs, pinfo)` — get translation vectors (from T48).

7. Apply offsets; union all translated boxes into `rootbb`.

8. If graph has label: widen `rootbb` horizontally to fit label width.
   If `total === 0`: set `rootbb` to label dimensions.

9. Non-root clusters (depth > 0): add `pinfo.margin / 2` on all four
   sides. Add `border[BOTTOM_IX]` at bottom, `border[TOP_IX]` at top.

10. Subtract `rootbb.ll` from all child positions (translate to origin).

11. Set `GraphInfo.bb = { ll: {x:0,y:0}, ur: rootbb.ur - rootbb.ll }`.

**Step 4 — `reposition(g, depth = 0)` — recursive:**
- At depth 0 (root): no translation.
- At depth > 0: for each directly owned node (`PARENT(n) === g`), add
  `GraphInfo.bb.ll` to `NodeInfo.coord`. For each subcluster, shift its
  `GraphInfo.bb` by parent's `bb.ll` then recurse.

**Step 5 — Edge routing:**
- If `ratio_kind` is set: convert `NodeInfo.coord` to inches via
  `ps2inch` then call `spline_edges0`.
- Otherwise: call `spline_edges1` if edge type is not `EDGETYPE_NONE`.

**Step 6 — `dotneato_postprocess(g)`.**

### Pack mode floor

Osage silently upgrades any mode below `PackMode.Graph` to
`PackMode.Graph`. Reproduce:

```typescript
if (pinfo.mode < PackMode.Graph) {
  pinfo.mode = PackMode.Graph;
}
```

### Margin halving for non-root clusters

```typescript
const margin = depth > 0 ? pinfo.margin / 2 : 0;
```

### GD_clust 1-indexed convention

`mkClusters` prepends one null sentinel at index 0 so that loops
iterate `i = 1; i <= GD_n_cluster(g)`. TypeScript: use a plain array
where `clusters[0] === null` and `clusters[1..n]` are real clusters.

### Known limitation: cluster labels

The C source opens with `/* FIX: handle cluster labels */`. Label
dimensions affect bounding box width/height via `GD_border`, but the
label text position is not a layout child. Preserve this limitation —
do not implement full label packing.

## Write-Set

- `src/layout/osage/index.ts`
- `src/layout/osage/osage.test.ts`

## Read-Set

- `~/git/graphviz/lib/osage/osageinit.c`
- `~/git/graphviz/lib/osage/osage.h`
- `~/git/graphviz/docs/architecture/lib/osage.md`
- `src/layout/pack/index.ts` — for putRects, getPackInfo, PackMode
- `src/types/graph.ts`

## Architecture Decisions

**AD-1:** Replace GD_*/ND_*/ED_* macro accessors with typed fields.

**AD-7:** `NodeInfo.alg` discriminated union. osage uses kind `'osage'`
to store the owning cluster pointer. This is a completely different
semantic from all other engines — osage does NOT store position or
algorithm-state data in `alg`. The `kind: 'osage'` discriminant makes
this explicit and eliminates the need for any cast.

## Interface Contracts

Engine registration name: `"osage"`.

```typescript
export function osage_layout(g: Graph): void;
export function osage_cleanup(g: Graph): void;
```

`osage_cleanup` iterates all nodes and out-edges, calling
`gv_cleanup_edge` and `gv_cleanup_node`. Then calls `cleanup_graphs(g)`
to free cluster label and `GD_clust` data.

## Acceptance Criteria

1. `NodeInfo.alg.kind === 'osage'` for all nodes during layout: a
   unit test asserts this invariant after `layout()` completes but
   before `reposition()`. Every node in every cluster must have
   `kind === 'osage'`.

2. Clusters packed without overlap: given a graph with two clusters
   each containing 3 nodes, `osage_layout` produces a result where the
   bounding boxes of the two clusters do not intersect. Unit test in
   `osage.test.ts`.

3. Pack mode floor: `getPackInfo` returning `PackMode.Node` is silently
   upgraded to `PackMode.Graph`. Unit test asserts `pinfo.mode ===
   PackMode.Graph` after the upgrade.

4. Engine registration: `getLayoutEngine('osage')` returns
   `osage_layout`. Verified in `osage.test.ts`.

## Observability

N/A

## Rollback

Reversible. `src/layout/osage/` is a new directory.

## Quality Bar

- `tsc --noEmit` exits 0 for all files in `src/layout/osage/`
- `vitest run src/layout/osage/osage.test.ts` exits 0
- 90% line / branch / function coverage
- No `any` casts
- All coordinate conversions use `ps2inch`/`inch2ps` from pack module

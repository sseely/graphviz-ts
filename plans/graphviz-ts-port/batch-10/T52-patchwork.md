# T52 — patchwork Layout Engine (Squarified Treemap)

## Context

Stack: TypeScript 5.x strict, Vitest, esbuild, EPL-2.0.

`lib/patchwork` implements the `patchwork` layout type. Each node
becomes a rectangle whose area is proportional to its `area` attribute.
Subgraphs become nested rectangles. The squarified treemap algorithm
(Bruls, Huizing & van Wijk, 2000) minimizes aspect ratio deviation.

Source files:
- `~/git/graphviz/lib/patchwork/patchwork.c` — tree construction,
  layout orchestration, coordinate assignment
- `~/git/graphviz/lib/patchwork/patchworkinit.c` — lifecycle functions
- `~/git/graphviz/lib/patchwork/tree_map.c` — squarified treemap core

Architecture doc:
`~/git/graphviz/docs/architecture/lib/patchwork.md`

This task depends on T48 (pack) for `ps2inch`/`inch2ps` helpers only
(patchwork does not call component packing functions directly).

## Task

Port all three patchwork C files to `src/layout/patchwork/index.ts`.

### rdata contiguous allocation (same pattern as T50)

`patchwork_init_node_edge` allocates one block for all `rdata` structs.
TypeScript: allocate one `RData[]` array. Cleanup frees via the first
node's `alg` reference.

```typescript
interface PatchworkRData {
  kind: 'patchwork-rdata';
  parent: Graph | null;  // SPARENT: owning cluster; null if not yet claimed
}
```

`SPARENT(n)` checks `n.info.alg?.kind === 'patchwork-rdata'
  ? n.info.alg.parent : null`.

### Critical: rdata freed before any use of ND_alg by downstream code

`patchwork_cleanup` frees the rdata block via `ND_alg(agfstnode(g))`.
The same pattern applies: null `alg` on the first node in cleanup;
the array is GC'd. Add the comment:

```typescript
// MEMORY: rdata block allocated contiguously; first node's alg freed
// in cleanup. Same single-free pattern as circo (T49) and twopi (T50).
```

### Critical: quadratic margin formula — preserve exactly

`layoutTree` computes the inner rectangle margin `m` by solving:

```
(h - m)(w - m) = child_area
```

Expanding and solving for the smaller root:

```
const delta = h - w;
const disc = Math.sqrt(delta * delta + 4 * child_area);
const m = (h + w - disc) / 2;
```

Do NOT simplify, approximate, or substitute an alternative formula.
This is the exact C computation. A unit test must verify that for
`h = 10, w = 8, child_area = 64.0`, the result is `m ≈ 0.9029` (within
1e-6).

### Internal tree: treenode_t

The patchwork algorithm uses an internal tree of `TreeNode` objects
that mirrors the cluster hierarchy but is independent of the Graphviz
graph model.

```typescript
interface TreeNode {
  area: number;
  childArea: number;
  r: Rectangle;
  leftChild: TreeNode | null;
  rightSib: TreeNode | null;
  kind: 'graph' | 'node';
  ref: Graph | Node;  // subgraph or Agnode_t equivalent
  nChildren: number;
}
```

### Rectangle type (center-based coordinates)

```typescript
interface Rectangle {
  x: [number, number];    // [center-x, center-y]
  size: [number, number]; // [width, height]
}
```

The convention is **center-based**: `x[0]` and `x[1]` are the center,
not the lower-left corner. All arithmetic in `squarify` uses this
convention. When corners are needed: `center ± size/2`.

### Algorithm: squarified treemap (tree_map.c)

The squarified algorithm is recursive. Input `area[]` MUST be sorted
descending before calling `squarify`. `layoutTree` enforces this via
`qsort` equivalent before each call to `tree_map`.

```
squarify(n, area, recs, nadded, maxarea, minarea, totalarea, asp, fillrec):
  Base: n === 0 → return
  Bootstrap: nadded === 0
    Set nadded=1, maxarea=minarea=area[0], totalarea=area[0]
    w = min(fillrec.size[0], fillrec.size[1])
    asp = max(area[0]/w², w²/area[0])
    recurse with nadded=1
  nadded >= 1:
    Compute newasp for strip if area[nadded] were added
    if newasp <= asp: add it, recurse
    else: commit strip
      tall fillrec (height >= width):
        h = totalarea / w
        Place items left-to-right: each width = area[i]/h, height = h
        Remaining fillrec: shrink top (y center shifts, height shrinks by h)
      wide fillrec (width > height):
        w_strip = totalarea / w
        Place items top-to-bottom: each width = w_strip, height = area[i]/w_strip
        Remaining fillrec: shrink left (x center shifts, width shrinks by w_strip)
      recurse on remaining items with nadded=0 reset
```

**Aspect ratio criterion** — preserve the exact formula:

```typescript
// asp = worst aspect ratio for current candidate strip of nadded items
// s = totalarea, w = shorter side of fillrec
const h_strip = totalarea / w;
// equivalent: asp = MAX(s²/(w²*minarea), w²*maxarea/s²)
```

The criterion for adding the next item is `newasp <= asp` (improve or
equal). When `newasp > asp`, commit the strip.

**area check in tree_map:**
```typescript
if (total > fillrec.size[0] * fillrec.size[1] + 0.001) return null;
```
The `+0.001` guard matches C exactly and must be preserved.

**Zero-area items:** `getArea` ensures leaf areas are at minimum
`DFLT_SZ = 1.0` after scaling by `SCALE = 1000.0`. The algorithm
itself does not guard against zero-area; rely on the upstream minimum.

### Constants

```typescript
const DFLT_SZ = 1.0;    // minimum node area (before SCALE)
const SCALE = 1000.0;   // area multiplier for numerical stability
```

### walkTree: coordinate assignment

For leaf nodes:
- `NodeInfo.coord = { x: r.x[0], y: r.x[1] }` (center)
- `NodeInfo.width = ps2inch(r.size[0])`
- `NodeInfo.height = ps2inch(r.size[1])`
- Call `gv_nodesize` to canonicalize shape

For subgraph nodes:
- `GraphInfo.bb.ll = { x: r.x[0] - r.size[0]/2, y: r.x[1] - r.size[1]/2 }`
- `GraphInfo.bb.ur = { x: r.x[0] + r.size[0]/2, y: r.x[1] + r.size[1]/2 }`

### Root rectangle sizing

```typescript
const side = Math.sqrt(root.area + 0.1);
const fillrec: Rectangle = { x: [0, 0], size: [side, side] };
```

The `+0.1` ensures the rectangle area strictly exceeds total content
area, preventing `tree_map` from returning null.

### Cluster ownership guard (SPARENT)

`mkTree` skips nodes where `SPARENT(n) !== null` to prevent double-
counting nodes that appear in both a cluster subgraph and its parent.
Set `SPARENT(n) = g` when a node is first claimed by cluster `g`.

### Edge record size note (harmless C bug to preserve)

`patchwork_init_edge` in the C source uses `sizeof(Agnodeinfo_t)` for
the edge record size — a copy-paste error. In TypeScript, simply bind
a standard `EdgeInfo` record. Do not replicate the bug; it is harmless
because patchwork makes no use of edge records after initialization.

The architecture doc calls this out explicitly:
> patchwork makes no use of edges, neither for a notion of connectivity
> nor during drawing. Edge records are created only because downstream
> rendering infrastructure expects them.

### Layout lifecycle

`patchwork_layout` in `patchworkinit.c`:
1. `patchwork_init_graph(g)` — force 2D, set shape to `box`, init
   nodes/edges, discover clusters
2. Skip layout if `agnnodes(g) === 0 && GD_n_cluster(g) === 0`
3. `patchworkLayout(g)` — build tree → squarify → walk → free tree
4. `dotneato_postprocess(g)`

## Write-Set

- `src/layout/patchwork/index.ts`
- `src/layout/patchwork/patchwork.test.ts`

## Read-Set

- `~/git/graphviz/lib/patchwork/patchwork.c`
- `~/git/graphviz/lib/patchwork/patchworkinit.c`
- `~/git/graphviz/lib/patchwork/tree_map.c`
- `~/git/graphviz/lib/patchwork/patchwork.h`
- `~/git/graphviz/lib/patchwork/tree_map.h`
- `~/git/graphviz/docs/architecture/lib/patchwork.md`
- `src/layout/pack/index.ts` — for ps2inch only
- `src/types/graph.ts`

## Architecture Decisions

**AD-1:** Replace GD_*/ND_*/ED_* macro accessors with typed fields.

**AD-7:** `NodeInfo.alg` discriminated union. patchwork uses kind
`'patchwork-rdata'`. This is defined in this task; the `parent` field
serves the same role as osage's `ownerCluster` but is a different kind.

## Interface Contracts

Engine registration name: `"patchwork"`.

```typescript
export function patchwork_layout(g: Graph): void;
export function patchwork_cleanup(g: Graph): void;
export function patchworkLayout(g: Graph): void;  // no init, no postprocess
```

`tree_map` internal signature:
```typescript
function treeMap(n: number, area: number[], fillrec: Rectangle): Rectangle[] | null;
```
Returns `null` if `sum(area) > fillrec.size[0] * fillrec.size[1] + 0.001`.

## Acceptance Criteria

1. Squarified aspect ratios: given 5 equal-area items in a 10×10
   rectangle, all output rectangles have aspect ratio ≤ 2.0. Unit test
   asserts `max(w/h, h/w) <= 2.0` for each rectangle.

2. Quadratic margin formula: unit test verifies that for
   `h = 10, w = 8, childArea = 64.0` the computed `m` is within 1e-6
   of `(18 - sqrt(324 - 4*64)) / 2 ≈ 0.9029`. This guards the exact
   formula against future simplification.

3. Engine registration: `getLayoutEngine('patchwork')` returns
   `patchwork_layout`. Verified in `patchwork.test.ts`.

4. `tree_map` returns null when total area exceeds fill rectangle area:
   unit test calls `treeMap` with `area = [100]` and
   `fillrec = { x:[0,0], size:[9,9] }` (area 81 < 100), asserts null.

## Observability

N/A

## Rollback

Reversible. `src/layout/patchwork/` is a new directory.

## Quality Bar

- `tsc --noEmit` exits 0 for all files in `src/layout/patchwork/`
- `vitest run src/layout/patchwork/patchwork.test.ts` exits 0
- 90% line / branch / function coverage on algorithmic code paths
- No `any` casts
- No simplified alternatives for the quadratic margin formula
- `ps2inch`/`inch2ps` from pack used for all coordinate conversions

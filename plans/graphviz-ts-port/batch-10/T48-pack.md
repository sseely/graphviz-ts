# T48 — Rectangle Packing (lib/pack)

## Context

Stack: TypeScript 5.x strict, Vitest, esbuild, EPL-2.0.

`lib/pack` provides two capabilities: (1) connected-component
decomposition (`ccomps`, `cccomps`, `pccomps`) and (2) packing of
pre-laid-out graphs or bare bounding-box rectangles into a
non-overlapping arrangement. It is a shared dependency of every layout
engine that handles disconnected graphs. circo, twopi, and osage all
call into it; so does any engine when the `pack` graph attribute is set.

Source: `~/git/graphviz/lib/pack/pack.c` (1304 lines), `pack.h`,
`ccomps.c`. Architecture doc: `~/git/graphviz/docs/architecture/lib/pack.md`.

This is a foundational task. T49, T50, T51, and T52 all depend on it.
Write the entire module before any parallel task begins.

## Task

Port `lib/pack/pack.c` and `lib/pack/ccomps.c` to TypeScript.

Implement the public API exactly as described in `pack.h`:

**Packing functions:**
- `putRects(ng: number, bbs: Box[], pinfo: PackInfo): Point[]`
- `packRects(ng: number, bbs: Box[], pinfo: PackInfo): number`
- `putGraphs(ng: number, gs: Graph[], root: Graph, pinfo: PackInfo): Point[]`
- `packGraphs(ng: number, gs: Graph[], root: Graph, pinfo: PackInfo): number`
- `packSubgraphs(ng: number, gs: Graph[], root: Graph, pinfo: PackInfo): number`
- `shiftGraphs(ng: number, gs: Graph[], pp: Point[], root: Graph, doSplines: boolean): number`

**Attribute readers:**
- `parsePackModeInfo(p: string, dflt: PackMode, pinfo: PackInfo): PackMode`
- `getPackModeInfo(g: Graph, dflt: PackMode, pinfo: PackInfo): PackMode`
- `getPackMode(g: Graph, dflt: PackMode): PackMode`
- `getPack(g: Graph, notDef: number, dflt: number): number`
- `getPackInfo(g: Graph, dflt: PackMode, dfltMargin: number, pinfo: PackInfo): PackMode`

**Component decomposition:**
- `ccomps(g: Graph, pfx: string): Graph[]`
- `cccomps(g: Graph, pfx: string): Graph[]`
- `pccomps(g: Graph, pfx: string): { graphs: Graph[]; pinned: boolean }`
- `isConnected(g: Graph): boolean`
- `mapClust(cl: Graph): Graph`

**Constant to export:**
```typescript
export const PS2INCH = 1 / 72;
```

Also export a helper:
```typescript
export function ps2inch(pts: number): number { return pts * PS2INCH; }
export function inch2ps(in_: number): number { return in_ / PS2INCH; }
```

Every site in this module and in callers that converts between point
space and inch space MUST use these helpers. No inline `/ 72` or `* 72`.

### Critical: coordinate space in shiftGraphs

`shiftGraphs` converts point-space delta `(dx, dy)` to inches before
updating `NodeInfo.pos` (equivalent to `ND_pos`), using `PS2INCH`. It
applies the raw point delta to `NodeInfo.coord` (equivalent to
`ND_coord`) and to all edge spline points and label positions via
`MOVEPT`. This split treatment must be preserved exactly.

From `pack.md` §"Coordinate Space":
> Node coordinates in ND_pos are stored in inches; all other
> coordinates (bounding boxes, ND_coord, edge spline points, labels)
> are in points. shiftGraphs converts from points to inches using
> PS2INCH when updating ND_pos.

### Critical: l_aspect is a no-op

The `l_aspect` pack mode is enumerated and parseable but its algorithm
is not implemented in the C source. `putRects` and `putGraphs` fall
through to the default case when `l_aspect` is selected, returning
`null`/`undefined`. Preserve this exact behavior — do NOT implement a
working aspect-ratio algorithm.

```typescript
// l_aspect: enum value exists for future use, algorithm not implemented.
// C source falls through to default (returns null). Preserve the no-op.
case PackMode.Aspect:
  return null;
```

### Critical: l_node and l_clust invalid for putRects

`putRects` and `packRects` operate on bare bounding boxes with no node
geometry. Calling them with `l_node` or `l_clust` mode is illegal and
returns null in the C code. Reproduce this:

```typescript
if (pinfo.mode === PackMode.Node || pinfo.mode === PackMode.Cluster) {
  return null; // no node geometry available for bare rects
}
```

### Packing algorithms to port

**Polyomino packing** (`polyRects`, `polyGraphs`):
1. `computeStep`: solve quadratic `C*ng*l² − (ΣW+ΣH)*l − ΣWH = 0`
   where `C = 100`. Take the positive root; minimum step is 1.
2. Generate polyomino for each component: use `genBox` for `l_graph`
   mode (bounding box rectangle); use `genPoly` for `l_node` / `l_clust`
   (node bounding boxes + Bresenham edge lines).
3. Sort by descending perimeter (largest first).
4. Place each component using concentric square spiral search from
   origin; use `fits()` to test candidate grid positions.

**Array packing** (`arrayRects`):
1. Determine grid dimensions `nc × nr` from `pinfo.sz` or `ceil(sqrt(ng))`.
2. Sort by descending `(width+height)` unless `PK_USER_VALS` or
   `PK_INPUT_ORDER` flags are set.
3. Compute per-column widths and per-row heights (max per column/row).
4. Build cumulative position arrays (prefix sums).
5. Apply alignment flags for final cell placement.

**Component decomposition** (`ccomps`):
- Iterative DFS using a node stack.
- Mark nodes via `NodeInfo.mark`; clear marks before DFS.
- Output subgraphs contain nodes only (no edges) — this is deliberate.
- Caller retrieves edges from the root graph.

### PackMode enum

```typescript
export const enum PackMode {
  Undef = 0,
  Cluster,
  Node,
  Graph,
  Array,
  Aspect,
}
```

### PackInfo interface

```typescript
export interface PackInfo {
  aspect: number;
  sz: number;
  margin: number;
  doSplines: boolean;
  mode: PackMode;
  fixed: boolean[] | null;
  vals: number[] | null;
  flags: number;
}

// Flag bit constants
export const PK_COL_MAJOR   = 1 << 0;
export const PK_USER_VALS   = 1 << 1;
export const PK_LEFT_ALIGN  = 1 << 2;
export const PK_RIGHT_ALIGN = 1 << 3;
export const PK_TOP_ALIGN   = 1 << 4;
export const PK_BOT_ALIGN   = 1 << 5;
export const PK_INPUT_ORDER = 1 << 6;
```

## Write-Set

- `src/layout/pack/index.ts`
- `src/layout/pack/pack.test.ts`

## Read-Set

- `~/git/graphviz/lib/pack/pack.c` — full file (1304 lines)
- `~/git/graphviz/lib/pack/pack.h`
- `~/git/graphviz/lib/pack/ccomps.c`
- `~/git/graphviz/docs/architecture/lib/pack.md`
- `src/types/graph.ts` — for Graph, Node, Edge, Box, Point types
- `src/layout/common/index.ts` — for computeBB and any shared geometry

## Architecture Decisions

**AD-1:** Replace GD_*/ND_*/ED_* macro accessors with plain typed fields
on Graph/Node/Edge TypeScript classes.

**AD-7:** `NodeInfo.alg` is a discriminated union. The pack module does
NOT write to `alg` (it uses `NodeInfo.mark` and `NodeInfo.coord`/`pos`
directly). Do not introduce a pack-specific alg kind.

**AD-9:** `is_exactly_zero` uses DataView bit comparison. Import it from
`src/util/math.ts` — do not inline the implementation.

## Interface Contracts

Callers of `ccomps` expect the returned array to contain subgraphs of
the input graph where each subgraph holds only nodes (no edges). The
root graph is the source for all edge queries. This contract is
identical to the C implementation.

`packSubgraphs` calls `computeBB(root)` after packing succeeds to
update the root graph's bounding box. This must be a side effect on the
root graph, not a return value.

The `PS2INCH` constant and `ps2inch`/`inch2ps` helpers must be exported
from `src/layout/pack/index.ts` because T49, T50, and T51 import them
directly.

## Acceptance Criteria

1. `PS2INCH === 1 / 72` is exported as a named constant, and every
   coordinate conversion in the module uses `ps2inch()` or `inch2ps()`
   — grep for `/ 72` and `* 72` must return zero matches in
   `src/layout/pack/index.ts`.

2. `l_aspect` returns `null` from `putRects` and `putGraphs` with a
   comment citing the C no-op. The unit test asserts `null` is returned
   when `pinfo.mode === PackMode.Aspect`.

3. `arrayRects` produces packed positions where no two bounding boxes
   overlap (after applying the returned translation vectors) — verified
   by a unit test over a 4-component layout with heterogeneous sizes.

4. `ccomps` on a graph with two disconnected components returns two
   subgraphs each containing exactly the correct nodes and no edges.

## Observability

N/A — library function, no runtime metrics needed.

## Rollback

Reversible. `src/layout/pack/` is a new directory with no callers until
T49, T50, T51, T52 import it.

## Quality Bar

- `tsc --noEmit` exits 0 with no errors in `src/layout/pack/index.ts`
- `vitest run src/layout/pack/pack.test.ts` exits 0
- 90% line coverage, 90% branch coverage on `src/layout/pack/index.ts`
- No `any` casts in the module
- No inline `/ 72` or `* 72` numeric literals (use `ps2inch`/`inch2ps`)

# T39 — dot Init and Entry Point

## Context

This is a faithful TypeScript port of the Graphviz `lib/` layer targeting SVG
output (`dot -Tsvg`). The C source is THE SPEC. T39 ports `lib/dotgen/dotinit.c`
and creates `src/layout/dot/index.ts` — the public-facing module for the dot
layout engine.

**dotinit.c pipeline:**

`dot_layout(g)` is the public C entry point. It calls `doDot(g)`, which
handles pack-mode decomposition: if no pack info is set, `dotLayout(g)` is
called directly; otherwise `cccomps` decomposes into components, `dotLayout`
runs on each, and `packSubgraphs + copyClusterInfo` reassemble them.

`dotLayout(g)` sets edge type to SPLINE, calls `setAspect`, then:
1. `dot_init_subg(g)` — recursively initializes subgraphs
2. `dot_init_node_edge(g)` — binds NodeInfo/EdgeInfo, parses DOT attrs
3. `dot_rank(g)` (T33)
4. `dot_mincross(g)` (T34)
5. `dot_position(g)` (T35)
6. `removeFill(g)` — removes placeholder nodes from `_new_rank` subgraph
7. `dot_sameports(g)` (T37)
8. `dot_splines(g)` (T37)
9. `dot_compoundEdges(g)` (T38)

The `maxphase` attribute (integer 1/2/3) is a debugging escape hatch that
stops the pipeline after rank/mincross/position respectively. Implement it.

**dot_init_node(n):**

Calls `common_init_node` (from `lib/common/`) and `gv_nodesize`. Allocates 5
elist arrays: `ND_in`, `ND_out`, `ND_flat_in`, `ND_flat_out`, `ND_other`.
Sets `ND_UF_size = 1` (union-find initial size).

**dot_init_edge(e):**

- `ED_weight` from `E_weight` attr (default 1)
- `ED_count = ED_xpenalty = 1`
- If tail == head and group is non-empty: `ED_xpenalty = CL_CROSS`,
  `ED_weight *= 100` (strongly discourages crossing intra-group edges)
- If `nonconstraint_edge(e)`: `ED_xpenalty = ED_weight = 0`
- `ED_minlen` from `E_minlen` attr (default 1)

The weight×100 multiplier for intra-group edges is NOT in the attr value — it
is computed programmatically. It must be replicated.

**DOT attributes parsed:**

| Attribute | Field | Default |
|-----------|-------|---------|
| `weight` | `EdgeInfo.weight` | 1 |
| `minlen` | `EdgeInfo.minlen` | 1 |
| `constraint` | `nonconstraint_edge` test | true |
| `rankdir` | `GraphInfo.rankdir` | TB |
| `nodesep` | `GraphInfo.nodesep` | default |
| `ranksep` | `GraphInfo.ranksep` | default |
| `newrank` | `GD_flags \| NEW_RANK` | false |
| `maxphase` | pipeline stop point | none |
| `mclimit` | crossing min limit | 1.0 |
| `nslimit` / `nslimit1` | NS iteration caps | none |

**dot_cleanup(g):**

Frees virtual nodes by walking `GD_nlist`; frees all NodeInfo/EdgeInfo/GraphInfo
records. In TypeScript with GC, cleanup releases NodeInfo list references and
clears the fast-graph edge lists to allow GC to collect the virtual nodes. It
does not need to `free` memory but must null out the references so the graph
can be collected.

**removeFill(g):**

Removes placeholder nodes added by `fillRanks` in mincross for `newrank` mode.
These nodes are stored in the `_new_rank` subgraph. Iterate the subgraph,
remove each node from rank arrays and from the fast graph, then delete the
subgraph.

**Engine registration:**

`src/layout/dot/index.ts` exports a `DOT_LAYOUT_ENGINE` constant that
implements the `LayoutEngine` interface from `src/gvc/context.ts`. The engine
name must be exactly `"dot"` (lowercase) — this is the string `gvlayout_select`
uses in the C code.

## Task

Port `lib/dotgen/dotinit.c` to `src/layout/dot/init.ts`. Create
`src/layout/dot/index.ts` that registers the dot engine with `GvcContext` and
exports `dotLayout` as the public entry point. Write integration tests in
`src/layout/dot/dot.test.ts` that run the full pipeline on small graphs.

## Write-Set

```
src/layout/dot/init.ts
src/layout/dot/index.ts
src/layout/dot/dot.test.ts
```

## Read-Set

- `~/git/graphviz/lib/dotgen/dotinit.c` — full source
- `~/git/graphviz/docs/architecture/lib/dotgen.md` — dotinit.c section
  (dot_init_node, dot_init_edge, dotLayout, doDot, dot_layout, dot_cleanup,
  removeFill, attach_phase_attrs)
- `~/git/graphviz/docs/architecture/typescript-port.md` — Layer 4 Renderer
  interface and LayoutEngine registration pattern

## Architecture Decisions

- AD-1: All NodeInfo/EdgeInfo/GraphInfo bindings via typed fields.
- AD-2: Engine registered statically; `DOT_LAYOUT_ENGINE.name === "dot"`.
  No dynamic loading.
- AD-8: `NodeInfo.rank` dual-use documented in JSDoc on `dotLayout`.

## Interface Contracts

```typescript
/**
 * Full dot layout pipeline entry point.
 *
 * Initializes node and edge info records, parses DOT attributes (weight,
 * minlen, nodesep, ranksep, rankdir, newrank, mclimit, nslimit), then runs:
 *   dot_rank → dot_mincross → dot_position → removeFill →
 *   dot_sameports → dot_splines → dot_compoundEdges
 *
 * Respects the 'maxphase' graph attribute (1=stop after rank, 2=after
 * mincross, 3=after position) for debugging.
 *
 * IMPORTANT — ND_rank aliasing (AD-8): NodeInfo.rank is an x-coordinate
 * between create_aux_edges and set_xcoords inside dot_position. Callers
 * must not read NodeInfo.rank during that window.
 */
export function dotLayout(g: Graph, ctx: GvcContext): void;

/**
 * Public pipeline entry point. Handles pack mode via cccomps/packSubgraphs.
 * Calls dotneato_postprocess after layout.
 * Registered as LayoutEngine.layout on DOT_LAYOUT_ENGINE.
 */
export function dotLayoutEntry(g: Graph, ctx: GvcContext): void;

/**
 * The dot layout engine descriptor. Register with ctx.registerLayout().
 * name must be exactly "dot".
 */
export const DOT_LAYOUT_ENGINE: LayoutEngine;
```

### LayoutEngine interface (from src/gvc/context.ts)

```typescript
interface LayoutEngine {
  name: string;   // "dot" for this engine
  layout(g: Graph, ctx: GvcContext): void;
  cleanup(g: Graph): void;
}
```

## Acceptance Criteria

- Given `dotLayout` called on an empty graph (no nodes), then it returns
  cleanly without throwing (the pipeline handles empty graphs via the
  `GD_nlist == null` early exit in `dot_layout`).
- Given a graph with `rankdir=LR`, `nodesep=0.5`, `ranksep=1.0`,
  `weight=2`, `minlen=2` attributes, when `dotLayout` runs, then
  `GraphInfo.rankdir === 'LR'`, `EdgeInfo.weight === 2`,
  `EdgeInfo.minlen === 2` for all edges.
- Given `DOT_LAYOUT_ENGINE` registered with a `GvcContext` via
  `ctx.registerLayout(DOT_LAYOUT_ENGINE)`, when `ctx.selectLayout("dot")`
  is called, then the returned engine is `DOT_LAYOUT_ENGINE` (name lookup
  succeeds with the exact string `"dot"`).
- Given a simple A→B→C chain, when `dotLayout` completes, then
  `nodeA.info.coord.y > nodeB.info.coord.y > nodeC.info.coord.y` for
  `rankdir=TB` (top-to-bottom: higher rank = lower y in SVG space, but
  higher y in dot's coordinate system — verify against C binary output).

## Observability

N/A — pure library.

## Rollback

Reversible — source-only addition.

## Quality Bar

- `tsc --noEmit` exits 0
- `vitest run` exits 0 for `src/layout/dot/dot.test.ts`
- Integration test: run full pipeline on a 3-node chain and verify
  `NodeInfo.coord` values match C reference binary output within ±0.01 pt
- One commit: `feat(dot): add dot init, pipeline entry point, and engine registration`

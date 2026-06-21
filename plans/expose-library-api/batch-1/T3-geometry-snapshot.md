# T3 — getLayout() geometry snapshot

## Context

graphviz-ts (TS port of Graphviz, ESM, strict TS, vitest). After
`ctx.layout(g, engine)` runs, computed geometry is stored on the internal model
but is not readable through any public API. This task exposes it as a plain,
JSON-serializable **snapshot** (ADR-3) with an optional coordinate flip (ADR-4).

Native graphviz coordinates are y-up, origin at lower-left. Screen consumers
want y-down. Default to y-down by flipping about the graph bbox height.

## Task

Implement `getLayout(g, opts?)` walking the laid-out graph and returning typed
plain data. Read geometry from the internal fields; do not mutate the graph.

Fields to surface:
- graph bounds — `Graph.info.bb` (`Box{ll,ur}`)
- per node — name, center `coord` (`Point`), `width`, `height` (inches), `bb`
- per edge — tail/head names, spline as bezier control points
  (`Edge.info.spl: Spline` → `Bezier[]` → points), edge `label` position
  (`Edge.info.label` lp) if present

y-flip (when `yAxis: 'down'`): for every y, `y' = bbHeight - y` where
`bbHeight = bb.ur.y - bb.ll.y` (in the same units). Apply consistently to node
coords/bbox, every spline point, and label positions. `yAxis: 'up'` returns
native values unchanged.

## Write-set

- `src/api/geometry.ts` (create)
- `src/api/geometry.test.ts` (create)

## Read-set

- `src/model/nodeInfo.ts:240-260` — `coord`, `width`, `height`, `bb`
- `src/model/edgeInfo.ts:44-75` — `spl`, `label`, `head_label`, `tail_label`
- `src/model/graphInfo.ts:62-120` — `bb`, `label`
- `src/model/geom.ts:20-100` — `Point`, `Box`, `Bezier`, `Spline`, `Port`
- `src/model/node.ts:27-115` — `Node.info`, `Node.name`
- `src/model/edge.ts:35-90` — `Edge.info`, tail/head access

## Architecture decisions

ADR-3 (snapshot, not lazy), ADR-4 (yAxis option, default 'down'). This task is
the **canonical home** for the shared coordinate types — export them here:
`YAxis`, `GeometryOptions`. T5 imports `GeometryOptions` from this module.

## Interface contract (output)

```ts
export type YAxis = 'up' | 'down';
export type GeometryOptions = { yAxis?: YAxis }; // default { yAxis: 'down' }
export interface BoundsGeometry { x: number; y: number; width: number; height: number; }
export interface NodeGeometry { name: string; x: number; y: number; width: number; height: number; }
export interface EdgeGeometry { tail: string; head: string; points: { x: number; y: number }[]; label?: { x: number; y: number }; }
export interface LayoutSnapshot { bounds: BoundsGeometry; nodes: NodeGeometry[]; edges: EdgeGeometry[]; }
export function getLayout(g: Graph, opts?: GeometryOptions): LayoutSnapshot;
```
(Units: points. Document that `width`/`height` in NodeGeometry are in points,
converted from the inches stored on the model — or state the unit chosen.)

## Acceptance criteria

- Given a laid-out graph + `yAxis:'up'`, then `nodes[i].y` equals native
  `ND_coord.y` (no flip).
- Given the same graph + default (`'down'`), then `nodes[i].y` equals
  `bbHeight - nativeY`, and `bounds` is normalized to origin top-left.
- Given an edge with a routed spline, then `edges[i].points` contains its bezier
  control points (length consistent with `spl.list[k].size`), flipped to match.
- Given an edge with a label, then `edges[i].label` is populated; absent edges
  omit the field.
- Snapshot is JSON-serializable (`JSON.stringify` round-trips without loss).

## Observability / Rollback

N/A. Rollback: Reversible (new files only).

## Quality bar

`npm run typecheck && npm test && npm run build` exit 0. Tests assert concrete
coordinate values (flipped vs native) on a small fixture laid out with `dot`.
One commit: `feat(api): add getLayout geometry snapshot`.

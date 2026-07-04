# Mission: expose-library-api — verified facts (orchestrator)

Shared context for task agents. All verified against the live tree on
2026-06-21 (branch `feature/expose-library-api`). Baseline: typecheck +
build exit 0, 2090 tests pass (156 files).

## Project conventions (agents lack CLAUDE.md — obey these)

- Faithful TS port of C Graphviz (`~/git/graphviz` is the spec). Browser-safe:
  no `fs`/`path`/`process`/`require`. ESM only — **import paths end in `.js`**
  even for `.ts` files (e.g. `import { Graph } from '../model/graph.js'`).
- Strict TS, no `any` except documented C-interop boundaries.
- Every file starts with `// SPDX-License-Identifier: EPL-2.0`.
- Ported symbols carry a JSDoc `@see` to their C origin where one exists.
- snake_case C → camelCase TS. Tests are vitest, colocated `*.test.ts`,
  and must assert concrete values (not just truthiness).
- This mission is ADDITIVE: do not modify the internal model classes.

## Renderer factories (for T1 createDefaultContext)

All in `src/render/`. Register every one of these on the context:
- `createSvgRenderer()`  — `src/render/svg.ts:200`   (type `svg`)
- `createDotRenderer()`  — `src/render/dot.ts:366`    (type `dot`)
- `createXdotRenderer()` — `src/render/dot.ts:371`    (type `xdot`)
- `createJson0Renderer()`— `src/render/json.ts:326`   (type `json0`)
- `createJsonRenderer()` — `src/render/json.ts:331`   (type `json`)
- `createPlainRenderer()`, `createPlainExtRenderer()`, `createImapRenderer()`,
  `createImapNpRenderer()`, `createCmapxRenderer()`, `createCmapxNpRenderer()`
  — `src/render/map.ts:441-456`
  (types `plain`, `plain-ext`, `imap`, `imap-np`, `cmapx`, `cmapx-np`)

`GvcContext.register()` (src/gvc/context.ts:176) is overloaded for renderer
vs engine. `bestRenderer(format)` (ctx:195) matches `r.type.split(':')[0]
=== format`. Engines to register = identical to `src/index.ts:28-40`
`makeContext()` (8 engines).

## Parser edge insertion (for T2 addEdge) — src/parser/builder.ts:233-246

`processEdgePair` does, per (tail,head):
```
const edge = new Edge(tail, head, '');
// (parser also applies attrs/ports here — NOT addEdge's job)
root.edges.push(edge);
edge.graphSeq = root.edges.length;
for (let g = graph; g !== null && g !== root; g = g.parent) {
  g.nodes.set(tail.name, tail); g.nodes.set(head.name, head);
  g.edges.push(edge);
}
```
KEY: the parser does NOT dedup strict-graph edges in this path. So T2's
strict-dedup is NOT a port of the parser — it follows cgraph `agedge`
(`~/git/graphviz/lib/cgraph/edge.c:agedge`): in a strict graph, a matching
(tail,head,name) edge is returned rather than re-created. Read the C to get
the match semantics right (including undirected tail/head symmetry).
Design the round-trip-parity test around what the parser actually does.

## Layout state populated after ctx.layout (for T3 getLayout)

Geometry lives on internal `info` objects; read, do not mutate:
- node: `Node.info.coord` (Point), `.width`/`.height` (INCHES), `.bb` (Box)
- edge: `Edge.info.spl` (Spline → `.list: Bezier[]` → `.list[k].list: Point[]`,
  size `.list[k].size`), `Edge.info.label` (lp for edge label)
- graph: `Graph.info.bb` (Box {ll, ur})
Native coords are y-up, origin lower-left. Confirm field names against the
read-set line ranges before coding.

## Render flow to mirror (for T5) — src/index.ts:99-115 renderSvg

`parse → makeContext → ctx.layout(g, engine) → render(ctx, g, 'svg') →
ctx.freeLayout(g, engine)`, wrapped so unknown throws become
`new RenderError(msg, 'RENDER_ERROR')`; GvError-like throws re-surface.
`render` is the low-level fn from `src/gvc/device.ts`.

## Files that do NOT exist yet (create, don't expect)

`src/render/index.ts` (T8 creates), all of `src/api/` (tasks create).

## Batch 2 facts (T4 builder, T5 render, T6 xdot)

### cgraph-ops (T4) — src/model/cgraph-ops.ts
- `agnode(g, name, create): Node | null` (l.53) — adds to ROOT only; named get-or-create.
- `agsubg(parent, name, create): Graph | null` (l.82) — subgraph inherits `parent.kind`.
- `agsubnode(g, n, create): Node | null` (l.105) — installs node into subgraph AND every enclosing graph up to root. Use this so a builder's `addNode` on a subgraph satisfies "node in subgraph AND root".
- `Graph` ctor: `new Graph(name, kind)` (graph.ts:106). `GraphKind` = `'directed'|'undirected'|'strict-directed'|'strict-undirected'`. Map {directed,strict} per parser builder.ts:272-274.
- T4 builder backs onto: `new Graph` + `agnode`/`agsubg`/`agsubnode` + `addEdge` (T2, `src/api/edge-ops.js`). `GvNode`/`GvEdge` handles wrap internal refs without re-exporting the classes (ADR-1).

### device render (T5) — src/gvc/device.ts
- `render(ctx: GvcContext, g: Graph, format: string): string` (l.422) — the low-level render.
- `EngineName` from `src/gvc/context.js` (BuiltinEngine | string). Default engine `'dot'`.
- T5 flow mirrors renderSvg (index.ts:99-115): createDefaultContext (T1, `src/gvc/default-context.js`) → ctx.layout(g, engine) → render(ctx, g, format) → ctx.freeLayout(g, engine); wrap throws to RenderError('RENDER_ERROR') unless already GvError-like (`isGvErrorLike` is local to index.ts — re-implement the same duck-type or import the structured-error contract from `src/errors.js`: `RenderError`, type `GvError`).

### xdot (T6) — src/xdot/index.ts
- `export { parseXDot } from './parse.js'`; `export type { Xdot, XdotOp, XdotColor } from './types.js'`.
- `createXdotRenderer()` from `src/render/dot.ts:371` (type `xdot`).
- T6 flow: createDefaultContext → layout → render(ctx, g, 'xdot') → freeLayout → parseXDot(xdotString) → return typed ops. Re-export `Xdot`/`XdotOp`/`XdotColor` types.

## HOOK WARNING (caused T3 to stall) — read before writing tests
A Lizard complexity hook runs on edits/commit. It flags: function length > ~30
lines and CCN > 10 and file > 500 lines. It attributes loop-generated `it()`
calls and long `describe(() => { ... })` callbacks as ONE long anonymous
function. So: keep each `describe`/`it` callback short (< ~30 lines); do NOT
generate `it()` calls inside `for`/`forEach` loops; extract shared assertion
logic into small named helper functions. Write small blocks from the start —
do not iterate against the hook. AFTER gates pass, COMMIT immediately (the T3
agent left files uncommitted by stalling on this hook).

## BLOCKER (2026-06-21): xdot renderer integration-incomplete (T6)
`src/render/dot.ts` createXdotRenderer emits per-object `_draw_` but:
1. EDGES get no `_draw_` (native emits `B 4 ...` bezier + `_hdraw_` arrow).
2. Node pen color not applied (color=red → `#000000`; native `#ff0000`).
3. Node `_draw_` ellipse coords swapped between nodes.
Helpers (xdotPenColor/xdotPoint/...) are correct & unit-tested; only the
full-graph emission orchestration is incomplete (begin/end + ellipse/bezier/
polygon/textspan callbacks → per-object xbuf accumulation). SVG renderer
renders the same graph correctly (geometry is computed). Oracle: native
`printf 'digraph{a[color=red];a->b}' | dot -Txdot`. Fix = C-faithful port of
the xdot emission path vs plugin/core/gvrender_core_dot.c, oracle-verified —
a separate mission, not in this brief's write-sets.

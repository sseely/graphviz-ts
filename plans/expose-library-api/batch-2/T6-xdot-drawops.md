# T6 — Structured xdot draw-op access

## Context

graphviz-ts (TS port of Graphviz, ESM, strict TS, vitest). The xdot format
encodes every drawing primitive (ellipses, polygons, polylines, beziers, text,
color/font ops) as a structured op stream — the basis for consumers who render
with their own primitives (canvas/WebGL/PDF/native UI) instead of taking SVG.
`src/xdot/` already parses and emits xdot (`parseXDot`, `sprintXDot`, typed
`Xdot`/`XdotOp`), and `src/render/dot.ts` has an xdot renderer
(`createXdotRenderer`). This task exposes a typed "give me the draw-ops for this
laid-out graph" entry plus the op types.

## Task

Implement `getDrawOps(g, opts?)`: layout the graph (default `dot`), render to
xdot via the default context, and return the structured draw-ops the consumer
needs — parsed into the typed `XdotOp` representation (not the raw xdot string).
Re-export the public xdot op types so consumers can switch on op kinds.

Keep it thin: reuse `createDefaultContext` (T1), the xdot renderer, and
`src/xdot` parsing. Do not re-implement op parsing.

## Write-set

- `src/render/xdot-public.ts` (create)
- `src/render/xdot-public.test.ts` (create)

## Read-set

- `src/xdot/index.ts` — `parseXDot`, `sprintXDot`, `jsonXDot`; types `Xdot`,
  `XdotOp`, `XdotStats`, `XdotColor`
- `src/xdot/types.ts` — `XdotOp` variant shapes (op kinds)
- `src/render/dot.ts:371` — `createXdotRenderer`
- `src/gvc/default-context.ts` — `createDefaultContext` (T1)
- `src/render/public.ts` — render flow to mirror (T5; read its pattern)

## Architecture decisions

ADR-5 family. Decide the return shape: simplest is per-object draw-ops keyed by
node/edge, OR the whole-graph parsed `Xdot` op list. Pick the **least code** path
that lets a consumer draw the graph; document the choice in the journal.

## Interface contract (output)

```ts
export type { Xdot, XdotOp, XdotColor } from '../xdot/index.js';
export interface DrawOpsOptions { engine?: EngineName; }
export function getDrawOps(g: Graph, opts?: DrawOpsOptions): /* parsed xdot ops */;
```

## Acceptance criteria

- Given a laid-out graph, then the result contains shape ops (ellipse/polygon)
  for nodes and bezier/polyline ops for edges.
- Given a node with a label, then a text op with the label string is present.
- Given a colored node, then a color op reflects the color.
- Result is typed (`XdotOp` union), and consumers can discriminate op kinds
  without parsing strings.

## Observability / Rollback

N/A. Rollback: Reversible (new files only).

## Quality bar

`npm run typecheck && npm test && npm run build` exit 0. Tests assert presence of
specific op kinds + a label string. One commit:
`feat(render): expose structured xdot draw-ops`.

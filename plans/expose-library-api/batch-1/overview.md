# Batch 1 — Foundations

Three independent foundation pieces. No shared files → all parallel.
Batches 2–3 depend on these.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T1 | `createDefaultContext()` registering all engines + all renderers | typescript-pro | `src/gvc/default-context.ts`, `src/gvc/default-context.test.ts` | — | [x] |
| T2 | Safe `addEdge` helper (ports builder insertion) | typescript-pro | `src/api/edge-ops.ts`, `src/api/edge-ops.test.ts` | — | [x] |
| T3 | `getLayout()` geometry snapshot + types + y-flip | typescript-pro | `src/api/geometry.ts`, `src/api/geometry.test.ts` | — | [x] |

## Interface outputs (consumed downstream)

- T1 → `createDefaultContext(): GvcContext` (all engines + all renderers).
  Consumed by T5.
- T2 → `addEdge(g: Graph, tail: Node, head: Node, name?: string): Edge`.
  Consumed by T4.
- T3 → `getLayout(g: Graph, opts?: GeometryOptions): LayoutSnapshot`; exported
  types `YAxis`, `GeometryOptions`, `LayoutSnapshot`, `NodeGeometry`,
  `EdgeGeometry`, `BoundsGeometry`. Consumed by T5, T7.

## Gate after batch

`npm run typecheck && npm test && npm run build`, then `git diff --name-only`
must list only the six files above.

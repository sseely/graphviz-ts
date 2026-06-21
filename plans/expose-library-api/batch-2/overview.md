# Batch 2 — Public surfaces

The three consumer-facing capabilities. Independent files → parallel.
Depend on Batch 1 interfaces.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T4 | Graph builder + `GvNode`/`GvEdge` handles | typescript-pro | `src/api/builder.ts`, `src/api/builder.test.ts` | T2 | [x] |
| T5 | `render(graph, format, opts?)` over all formats | typescript-pro | `src/render/public.ts`, `src/render/public.test.ts` | T1, T3 | [x] |
| T6 | Structured xdot draw-op access | typescript-pro | `src/render/xdot-public.ts`, `src/render/xdot-public.test.ts` | T1 | [x] (wrapper done; xdot-renderer fix deferred — see journal) |

## Interface outputs (consumed downstream)

- T4 → `createGraph(opts): GvGraphBuilder`; types `GvNode`, `GvEdge`,
  `GvGraphBuilder`, `CreateGraphOptions`. Consumed by T7.
- T5 → `render(g, format: OutputFormat, opts?): string`; type `OutputFormat`,
  `RenderOptions`. Consumed by T8.
- T6 → `getDrawOps(g, opts?)` (+ re-exported typed xdot op types). Consumed by T8.

## Gate after batch

`npm run typecheck && npm test && npm run build`, then `git diff --name-only`
must list only the six files above.

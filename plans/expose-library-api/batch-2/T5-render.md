# T5 — render(graph, format, opts?)

## Context

graphviz-ts (TS port of Graphviz, ESM, strict TS, vitest). Today `renderSvg`
hardcodes SVG. With T1's `createDefaultContext()` registering every renderer,
this task exposes one ergonomic entry that renders a (parsed or built) graph to
any supported format.

## Task

Implement `render(g, format, opts?)`:
1. Build a context via `createDefaultContext()` (T1).
2. `ctx.layout(g, engine)` — engine defaults to `'dot'`, overridable in opts.
3. `render(ctx, g, format)` (the low-level `gvc/device.ts` render).
4. `ctx.freeLayout(g, engine)` (destructive cleanup, matching `renderSvg`).
5. Return the string.

Mirror `src/index.ts:renderSvg` error handling (normalize throws to the existing
structured error contract). `format='svg'` with default engine MUST produce
output identical to `renderSvg(src,'dot')` for the same graph (parity test).

## Write-set

- `src/render/public.ts` (create)
- `src/render/public.test.ts` (create)

## Read-set

- `src/gvc/default-context.ts` — `createDefaultContext` (T1 output)
- `src/index.ts:99-115` — `renderSvg` flow (layout → render → freeLayout, error
  handling) to mirror exactly
- `src/gvc/device.ts:56+` — low-level `render(ctx, g, format)` signature
- `src/gvc/context.ts:195-205` — `bestRenderer`, `layout`, `freeLayout`
- `src/api/geometry.ts` — import `GeometryOptions`/`YAxis` (T3) if threading
  yAxis; otherwise omit (render formats already carry native coords)

## Architecture decisions

ADR-5 (one render fn, string-union format). yAxis is primarily a `getLayout`
concern; for `render` only thread an option if a format meaningfully supports it
— otherwise keep `RenderOptions` to `{ engine?: EngineName }` and note the
decision in the journal.

## Interface contract (output)

```ts
export type OutputFormat = 'svg' | 'dot' | 'xdot' | 'json' | 'plain' | 'plain-ext' | 'imap' | 'cmapx';
export interface RenderOptions { engine?: EngineName; }
export function render(g: Graph, format: OutputFormat, opts?: RenderOptions): string;
```

## Acceptance criteria

- Given `format:'svg'` default engine, then output is byte-identical to
  `renderSvg(src,'dot')` on the same parsed graph.
- Given `format:'plain'`, then plain text (`graph`/`node`/`edge`/`stop` lines)
  is returned.
- Given `format:'json'`, then valid JSON is returned (`JSON.parse` succeeds).
- Given `format:'dot'`, then attribute-annotated DOT is returned.
- Given an unknown format (cast), then a structured error is thrown matching the
  existing error contract.

## Observability / Rollback

N/A. Rollback: Reversible (new files only).

## Quality bar

`npm run typecheck && npm test && npm run build` exit 0. Tests assert per-format
output shape and SVG parity. One commit:
`feat(render): add multi-format render entry`.

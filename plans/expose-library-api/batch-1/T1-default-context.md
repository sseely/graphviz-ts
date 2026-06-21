# T1 — createDefaultContext()

## Context

graphviz-ts is a TypeScript port of Graphviz (browser-safe, ESM, strict TS,
vitest). Today `src/index.ts:makeContext()` builds a `GvcContext`, registers all
8 layout engines, but registers **only** the SVG renderer. Other renderers
(dot, xdot, json, json0, plain, plain-ext, imap, imap_np, cmapx, cmapx_np) are
fully implemented as factories but never wired into the default context, so
`render(ctx, g, 'dot')` throws "no renderer registered".

## Task

Create `createDefaultContext()`: a single factory that registers all 8 engines
AND every renderer factory. This becomes the shared context for both `renderSvg`
and the new `render()` (T5). Do NOT yet modify `src/index.ts` — that is T9.

## Write-set

- `src/gvc/default-context.ts` (create)
- `src/gvc/default-context.test.ts` (create)

## Read-set

- `src/index.ts:28-40` — current `makeContext()` (the engines to register)
- `src/gvc/context.ts:163-205` — `GvcContext`, `register`, `bestRenderer`
- `src/render/svg.ts:200`, `src/render/dot.ts:366-371`,
  `src/render/json.ts:326-331`, `src/render/map.ts:441-456` — renderer factories
- `src/render/index.ts` if present, else import factories directly

## Architecture decisions

ADR-5 (decisions.md#adr-5): all renderers reachable. Keep the engine list
identical to today's `makeContext`.

## Interface contract (output)

```ts
export function createDefaultContext(): GvcContext // all 8 engines + all renderers
```

## Acceptance criteria

- Given format `'json'`, when `ctx.bestRenderer('json')`, then a renderer is
  returned (no throw).
- Given format `'dot'`, then the dot renderer is returned.
- Given format `'svg'`, then the SVG renderer is returned (parity with today).
- Given the engine list, then `ctx.layout(g, 'dot'|'neato'|'fdp'|'sfdp'|'circo'
  |'twopi'|'osage'|'patchwork')` all resolve.

## Observability / Rollback

N/A — no observable runtime operations. Rollback: Reversible (new files only).

## Quality bar

`npm run typecheck && npm test && npm run build` all exit 0. New tests assert on
specific renderers/engines, not just truthiness. One commit:
`feat(gvc): add createDefaultContext registering all renderers`.

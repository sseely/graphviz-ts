# T9 — Root wiring + package exports + build

## Context

graphviz-ts (TS port of Graphviz, ESM, strict TS, esbuild bundling, vitest).
Final integration. Wire the two new subpath entries into the package, switch the
default context to the all-renderers factory, and guarantee the existing root
import is non-breaking (the single rollback risk per Phase 4).

## Task

1. **`src/index.ts`** (modify):
   - Replace the local `makeContext()` (svg-only) with `createDefaultContext()`
     from `src/gvc/default-context.ts` (T1) so `renderSvg` keeps working through
     the shared context. Keep `renderSvg`/`tryRenderSvg`/`parse`/`render`/error
     exports and signatures **unchanged**.
   - Add convenience re-exports of the api + render surfaces for discoverability
     (root re-exports both per ADR-2), e.g. `export * from './api/index.js'` and
     `export * from './render/index.js'` — resolve any name collisions explicitly
     (e.g. the existing low-level `render` from `gvc/device` vs the new public
     `render`; the public one wins at root, or namespace one — decide and journal).
2. **`package.json`** (modify):
   - Add an `"exports"` map: `"."` → `dist/index.js`, `"./api"` → `dist/api.js`,
     `"./render"` → `dist/render.js`. `"."` MUST keep resolving as today.
   - Update the `build` script to emit all three bundles (esbuild, ESM), e.g.
     three `--outfile` invocations or an esbuild entry list. Outputs:
     `dist/index.js`, `dist/api.js`, `dist/render.js`.
3. **`src/entry.test.ts`** (create): smoke test that imports each entry and
   asserts a representative symbol from each resolves.

## Write-set

- `src/index.ts` (modify)
- `package.json` (modify)
- `src/entry.test.ts` (create)

## Read-set

- `src/index.ts:28-145` — current exports + `makeContext` (preserve the public
  surface verbatim except the context swap + additive re-exports)
- `src/gvc/default-context.ts` (T1), `src/api/index.ts` (T7),
  `src/render/index.ts` (T8)
- `package.json:6-15` — current `build` script + scripts block

## Architecture decisions

ADR-2 (exports map, root re-exports, `"."` preserved), ADR-5 (shared context).

## Interface contract (output)

- `import 'graphviz-ts'` exposes today's symbols + the new surfaces.
- `import 'graphviz-ts/api'`, `import 'graphviz-ts/render'` resolve.

## Acceptance criteria

- Given `import { renderSvg, parse, tryRenderSvg } from 'graphviz-ts'`, then all
  resolve and `renderSvg` output is unchanged vs before this task (parity).
- Given `import { createGraph } from 'graphviz-ts/api'`, then it resolves.
- Given `import { render } from 'graphviz-ts/render'`, then it resolves.
- Given `npm run build`, then `dist/index.js`, `dist/api.js`, `dist/render.js`
  are all produced.
- Given `npm test`, then the full suite (incl. `entry.test.ts`) passes.

## Observability / Rollback

N/A. Rollback: **Reversible** — revert this commit; the `exports` map is the sole
risk and the entry test guards it. If the root import breaks, STOP (Phase 4
constraint).

## Quality bar

`npm run typecheck && npm test && npm run build` exit 0; all 3 bundles emitted;
root import non-breaking. One commit:
`feat(api): wire api + render entry points into package exports`.

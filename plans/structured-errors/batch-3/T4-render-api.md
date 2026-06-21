# T4 — `tryRenderSvg` + classify + render-stage wrap + exports

## Context

graphviz-ts public entry is `src/index.ts`. It exports `renderSvg(dotSource,
engine): string`, which runs `parse → ctx.layout → render → ctx.freeLayout`.
Parse failures throw `ParseError` (now a `GvError` after T2); layout/render
failures throw a **bare `Error`** today. This task adds the structured,
result-style entry point and makes the throwing path carry structure too.

Stack: TypeScript strict, ESM, vitest. EPL-2.0 header present.

## Task

In `src/index.ts` (minimal interpretation — no extra entry points, no engine
default; keep `engine` required to match the existing signature):

1. Add an internal `classifyError(err: unknown): GvError`:
   - If `err` already satisfies `GvError` (duck-type: `err` is an object with a
     string `type` and a string `code`), return a **plain normalized data
     object** `{ type, code, message, friendlyMessage, location?, expected? }`
     (copy only those fields — do **not** return the `Error` instance; the
     `RenderResult.errors` array must be JSON-serializable with no stack). This
     covers `ParseError` (syntax), `HtmlParseError` (semantic), and
     `RenderError` (render).
   - Otherwise wrap: `new RenderError(err instanceof Error ? err.message :
     String(err), 'GENERIC_ERROR')` and normalize that to a plain object.
2. Wrap the render-stage work in `renderSvg` so layout/render throws surface as
   structure: catch around the `ctx.layout / render / freeLayout` section and,
   for any non-`GvError` throw, rethrow `new RenderError(message, 'RENDER_ERROR')`.
   `parse()` stays outside this wrap (its `ParseError` is already a `GvError` and
   propagates as-is). Net: `renderSvg` always throws a value implementing
   `GvError`.
3. Add `export function tryRenderSvg(dotSource: string, engine: EngineName):
   RenderResult` — call `renderSvg` in try/catch; on success return
   `{ svg }`; on failure return `{ errors: [classifyError(err)] }` (length 1,
   first failure, XOR — never both).
4. Exports: add `tryRenderSvg`, `ParseError` (from `./parser/index.js`),
   `RenderError`, and `export type { GvError, GvErrorType, GvErrorCode,
   GvExpectation, RenderResult }` (from `./errors.js`). Keep all existing
   exports.

## Write-set
- `src/index.ts` (modify)
- `src/index.test.ts` (create)

## Read-set
- `src/index.ts:40-66` — `renderSvg` + current exports
- `src/errors.ts` (T1) — `RenderError`, `RenderResult`, `GvError`, types
- `src/parser/index.ts` (T2) — `ParseError` shape
- `src/common/htmltable-types.ts` (T3) — `HtmlParseError` shape
- `decisions.md#final-shape`

## Architecture decisions (locked)
- ADR-2: `tryRenderSvg` returns plain `GvError` **data** objects, not Error
  instances (JSON-serializable for the CI-logging consumer).
- ADR-3: classify by duck-typing `.type`/`.code`; only genuinely-unknown throws
  become `GENERIC_ERROR`.
- ADR-4: render-stage known failures → `RENDER_ERROR`; catch-all → `GENERIC_ERROR`.
- XOR + first-failure: result is `{svg}` or `{errors:[one]}`, never both.
- `engine` stays **required** (do not add a default — out of scope).

## Interface contracts
```ts
export function renderSvg(dotSource: string, engine: EngineName): string; // throws GvError
export function tryRenderSvg(dotSource: string, engine: EngineName): RenderResult;
export type { GvError, GvErrorType, GvErrorCode, GvExpectation, RenderResult };
export { ParseError } from './parser/index.js';
export { RenderError } from './errors.js';
```

## Acceptance criteria
- Given a valid DOT graph, when `tryRenderSvg(dot, 'dot')`, then result has a
  non-empty `svg` string and `errors` is absent/empty (XOR).
- Given `tryRenderSvg('digraph { a ->', 'dot')`, then `svg` absent and
  `errors` is length 1 with `{ type:'syntax', code:'SYNTAX_UNEXPECTED_EOF' }`
  and a `location`.
- Given a render-stage failure (e.g. an unregistered engine name, or a DOT input
  that throws in layout), when `tryRenderSvg`, then `errors[0].type === 'render'`
  and `code === 'RENDER_ERROR'`.
- Given the same render-stage failure, when `renderSvg` is called directly, then
  it throws a value where `(e instanceof Error)` and `e.code` is a `GvErrorCode`
  (not a bare `Error`).
- Given any `tryRenderSvg` failure result, then `errors[0]` is a plain object —
  `JSON.stringify(errors[0])` round-trips `type`/`code`/`message`/
  `friendlyMessage` and there is no `stack` property.

## Observability requirements
N/A — no new observable operations. Gates: tsc + vitest + esbuild bundle.

## Rollback notes
Reversible — additive function + exports + an internal try/catch wrap. Revert
the commit.

## Quality bar
- `npx tsc --noEmit` clean; `npx vitest run` green; `npx esbuild src/index.ts
  --bundle --format=esm --outfile=/tmp/se-bundle.js` succeeds (browser-safe, no
  Node shims); ≥90% coverage on new `src/index.ts` branches.
- One commit:
  `feat(api): add tryRenderSvg and structured render-stage errors`.

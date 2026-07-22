<!-- SPDX-License-Identifier: EPL-2.0 -->
# T4 — TSDoc gap-fill on the public surface

## Context

TypeDoc (T3) generates the reference from TSDoc comments. Coverage is already
solid on `src/api/builder.ts` (~19 doc blocks) and `src/api/geometry.ts` (~21),
so those are **out of scope**. The thinner spots are `src/api/edge-ops.ts`
(~6) and `src/render/xdot-public.ts` (~8), plus the barrel files whose module
comments become the reference landing text.

This task improves the *generated* reference quality. It must not change any
runtime behavior or public signature.

## Task

Add/upgrade TSDoc on the exported symbols of these files only:
1. `src/api/edge-ops.ts` — `addEdge` and its options/return type: purpose,
   params, `@returns`, a short `@example`, `@see` to the C provenance.
2. `src/render/xdot-public.ts` — `getDrawOps`, `DEFAULT_DRAW_ENGINE`,
   `DrawOpsOptions`, and the `Xdot`/`XdotOp`/`XdotColor` types: one clear
   sentence each; document the op union enough that the reference is legible.
3. `src/api/index.ts` and `src/render/index.ts` — improve the top-of-file
   module comment (the barrel doc) so TypeDoc's module page reads as an
   orientation to that entry point. Do **not** change any export.

Match the existing house style (see `src/render/index.ts` header and
`src/api/index.ts` header — they already have good module comments; extend,
don't rewrite). Keep the `@see lib/...` provenance convention.

## Read-set

- `src/api/edge-ops.ts` (full — small)
- `src/render/xdot-public.ts` (full)
- `src/api/index.ts`, `src/render/index.ts` (headers)
- `src/api/builder.ts`, `src/api/geometry.ts` (as the *style reference* — do
  not edit)

## Interface contract

None — comments only. Zero signature/behavior change.

## Acceptance criteria

- Given `npm run typecheck`, then exit 0 (comments don't break types).
- Given `git diff`, then only comments changed — no export list, signature, or
  logic diff in the four files.
- Given `npm run docs:api` (after T3), then `edge-ops`/`xdot-public` symbols
  render with descriptions and at least one `@example` on `addEdge` and
  `getDrawOps`.
- Given `git diff --name-only`, then it lists only the four files above.

## Observability

N/A.

## Rollback

Reversible — revert.

## Quality bar

`npm run typecheck && npm test && npm run build` green. No behavior change.

## Boundaries

- **Always:** comments only; preserve `@see` provenance style.
- **Never:** touch `src/render/public.ts`/`src/index.ts` (T1 owns them) or
  `builder.ts`/`geometry.ts` (already documented).
- **Ask first:** if a symbol's correct description is unclear from the C
  provenance, leave a `// TODO(docs)` and note it — do not guess semantics.

## Commit

`docs(T4): fill TSDoc gaps on edge-ops and xdot-public for the API reference`

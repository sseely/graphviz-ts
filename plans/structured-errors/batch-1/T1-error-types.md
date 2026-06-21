# T1 — Error type system + friendly-message seam

## Context

graphviz-ts is a faithful TypeScript port of C graphviz, consumed as a
browser library (no Node-only APIs). This task creates the **public structured
error contract**. Read `decisions.md` (the whole file is short) — especially
the faithfulness line and the "Final shape" block, which is the literal target.

Stack: TypeScript strict mode, ESM, vitest. Files carry
`// SPDX-License-Identifier: EPL-2.0` as the first line. snake_case C names map
to camelCase; constants UPPER_SNAKE_CASE.

## Task

Create `src/errors.ts` defining the public error contract and the central
i18n seam, plus full tests. **Do the simplest interpretation — no speculative
fields, no extra codes beyond the seven, no abstraction layers.**

Define and export exactly:

1. `GvExpectation` — `export type GvExpectation = Expectation;` where
   `Expectation` is type-only imported: `import type { Expectation } from
   './parser/dot.js';`. (Type-only import is erased at runtime — keep
   `errors.ts` a runtime leaf with no value imports from the project.)
2. `GvErrorType` — union `'syntax' | 'semantic' | 'render'`.
3. `GvErrorCode` — the 7-member closed union from `decisions.md#final-shape`.
4. `GvError` — interface exactly as in `decisions.md#final-shape`
   (`type`, `code`, `message`, `friendlyMessage`, optional `location`,
   optional `expected: GvExpectation[]`).
5. `RenderResult` — `{ svg?: string; errors?: GvError[] }`.
6. `FRIENDLY_MESSAGES: Record<GvErrorCode, string>` — one approachable,
   non-localized English sentence per code. Each must be non-empty. Suggested
   (wording is yours to refine — it is non-localized prose, push-forward):
   - `SYNTAX_ERROR`: "There is a syntax error in the DOT source."
   - `SYNTAX_UNEXPECTED_EOF`: "The DOT source ended unexpectedly — a bracket or
     statement may be unclosed."
   - `EDGE_OP_DIRECTED_IN_UNDIRECTED`: "A directed edge '->' was used in an
     undirected graph; use '--' instead."
   - `EDGE_OP_UNDIRECTED_IN_DIRECTED`: "An undirected edge '--' was used in a
     directed graph; use '->' instead."
   - `HTML_PARSE_ERROR`: "An HTML-like label could not be parsed."
   - `RENDER_ERROR`: "The graph could not be laid out or rendered."
   - `GENERIC_ERROR`: "An unexpected error occurred while rendering the graph."
7. `friendlyMessageFor(code: GvErrorCode): string` — returns
   `FRIENDLY_MESSAGES[code]`. This is the seam a future i18n library replaces.
8. `RenderError extends Error implements GvError` — constructor
   `(message: string, code: GvErrorCode = 'RENDER_ERROR')`. Sets
   `this.name = 'RenderError'`, `this.type = 'render'`, `this.code = code`,
   `this.friendlyMessage = friendlyMessageFor(code)`. No `location`/`expected`.
   Only `RENDER_ERROR` and `GENERIC_ERROR` are valid render-stage codes — do not
   guard against others (closed union; trust the type system).

## Write-set
- `src/errors.ts` (create)
- `src/errors.test.ts` (create)

## Read-set
- `decisions.md#final-shape` and the faithfulness line (this directory)
- `src/parser/dot.d.ts:95-118` — confirm `Expectation` export + member shapes

## Architecture decisions (locked)
- ADR-2: `GvError` is an interface; `RenderError` is a thrown `Error` subclass.
- ADR-4: `code` is the stable i18n key; `friendlyMessage` is non-localized
  approachable prose. `message` is concise technical text we own — it MAY
  diverge from C (owner relaxed message-fidelity); it is the constructor's
  `message` arg, untouched by this file.
- `errors.ts` has **no value imports from the project** (runtime leaf).

## Interface contracts (consumed by T2, T3, T4)
```ts
export type GvExpectation = Expectation;
export type GvErrorType = 'syntax' | 'semantic' | 'render';
export type GvErrorCode = /* 7-member union */;
export interface GvError { type; code; message; friendlyMessage; location?; expected? }
export interface RenderResult { svg?: string; errors?: GvError[] }
export const FRIENDLY_MESSAGES: Record<GvErrorCode, string>;
export function friendlyMessageFor(code: GvErrorCode): string;
export class RenderError extends Error implements GvError { /* type:'render' */ }
```

## Acceptance criteria
- Given `friendlyMessageFor('GENERIC_ERROR')`, when called, then returns a
  non-empty string.
- Given every `GvErrorCode`, when looked up in `FRIENDLY_MESSAGES`, then each
  maps to a non-empty string (test by iterating a literal list of all 7).
- Given `new RenderError('boom')`, when inspected, then
  `{ type:'render', code:'RENDER_ERROR', message:'boom' }` and
  `friendlyMessage === FRIENDLY_MESSAGES.RENDER_ERROR`.
- Given `new RenderError('x', 'GENERIC_ERROR')`, then `code === 'GENERIC_ERROR'`
  and `friendlyMessage === FRIENDLY_MESSAGES.GENERIC_ERROR`.
- Given `new RenderError('x')`, when `(e instanceof Error)`, then `true`.

## Observability requirements
N/A — no new observable operations (browser library; gates are tsc + vitest).

## Rollback notes
Reversible — new files only; deleting them fully reverts. No migration.

## Quality bar
- `npx tsc --noEmit` clean. `npx vitest run` green. ≥90% line/branch/function
  coverage on `src/errors.ts`.
- Return only the implementation — no preamble. One commit:
  `feat(errors): add structured GvError contract and friendly-message seam`.

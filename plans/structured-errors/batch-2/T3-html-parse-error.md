# T3 — `HtmlParseError implements GvError`

## Context

graphviz-ts faithful port; browser library. `HtmlParseError`
(`src/common/htmltable-types.ts`) is thrown when an HTML-like label fails to
parse. Current shape:
```ts
export class HtmlParseError extends Error {
  readonly tag: string;
  constructor(tag: string) {
    super(`Unknown HTML element <${tag}>`);
    this.tag = tag;
    this.name = 'HtmlParseError';
  }
}
```
It is constructed at 4 call sites (`htmltable-lex.ts`, `htmltable-parse.ts`)
as `new HtmlParseError(<string>)`. The constructor signature **must stay
`(tag: string)`** so those call sites do not ripple (a STOP condition if it
can't).

Stack: TypeScript strict, ESM, vitest. EPL-2.0 header present.

## Task

Make `HtmlParseError implement GvError` **additively** — keep the `(tag)`
constructor and the existing `message` exactly; add the contract fields.

1. `import type { GvError } from '../errors.js';`
   `import { friendlyMessageFor } from '../errors.js';`
2. `export class HtmlParseError extends Error implements GvError`. Add:
   - `readonly type = 'semantic'`
   - `readonly code = 'HTML_PARSE_ERROR'`
   - `readonly friendlyMessage = friendlyMessageFor('HTML_PARSE_ERROR')`
   - keep `readonly tag`, the `super(\`Unknown HTML element <${tag}>\`)` message,
     and `this.name = 'HtmlParseError'` unchanged.
   - `location` / `expected` are omitted (HTML labels carry no parser position
     here; `location?` optional in the contract).

Do not touch the 4 call sites — they keep passing a single string.

## Write-set
- `src/common/htmltable-types.ts` (modify — only `HtmlParseError`; leave the
  alignment enums and other types in this file untouched)
- `src/common/htmltable-types.test.ts` (create)

## Read-set
- `src/common/htmltable-types.ts:16-24` — current `HtmlParseError`
- `src/errors.ts` (from T1) — `GvError`, `friendlyMessageFor`
- `decisions.md` ADR-3

## Architecture decisions (locked)
- ADR-3: additive only; `(tag)` constructor unchanged; `message` verbatim.
- ADR-2: thrown `Error` subclass implementing `GvError`.

## Interface contracts (consumed by T4)
```ts
class HtmlParseError extends Error implements GvError {
  readonly type: 'semantic';
  readonly code: 'HTML_PARSE_ERROR';
  readonly friendlyMessage: string;
  readonly tag: string;
}
```

## Acceptance criteria
- Given `new HtmlParseError('TABLE')`, then `{ type:'semantic',
  code:'HTML_PARSE_ERROR', tag:'TABLE', message:'Unknown HTML element <TABLE>' }`
  and `friendlyMessage` non-empty.
- Given `new HtmlParseError('x')`, when `(e instanceof Error)`, then `true`.
- Given the whole project, when `npx tsc --noEmit`, then zero errors (the 4
  existing call sites still type-check with the unchanged `(tag)` ctor).

## Observability requirements
N/A — no new observable operations.

## Rollback notes
Reversible — additive fields on an existing class. Revert the commit.

## Quality bar
- `npx tsc --noEmit` clean; `npx vitest run` green; ≥90% coverage on the new
  test file's target.
- One commit: `feat(common): structure HtmlParseError as semantic GvError`.

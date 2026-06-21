# T2 — `ParseError implements GvError`

## Context

graphviz-ts faithful port; browser library. `src/parser/index.ts` wraps the
peggy-generated parser (`src/parser/dot.js`). Today `ParseError` carries only
`message`/`line`/`column` and is thrown for both peggy syntax errors and
edge-operator violations. peggy already tracks position — the prerequisite is
met; this task **surfaces** what is currently discarded. Error `message` wording
MAY diverge from C (owner relaxed message-fidelity). Keep the current `message`
text as-is anyway — peggy's "Expected X but Y found" and the existing edge-op
strings are informative and there is no reason to rewrite them — but this is a
keep-because-useful choice, not a fidelity mandate. `location` accuracy and
correct `code` classification are what matter.

Stack: TypeScript strict, ESM, vitest. EPL-2.0 header already present.

## Task

Enrich `ParseError` in `src/parser/index.ts` to implement the `GvError`
interface from `../errors.js`, and surface peggy's structured data. Minimal
interpretation — add only what the contract needs.

1. Import the contract:
   `import type { GvError, GvErrorCode, GvExpectation } from '../errors.js';`
   and `import { friendlyMessageFor } from '../errors.js';`
2. `ParseError extends Error implements GvError`. Fields:
   - `type: 'syntax'` (literal).
   - `code: GvErrorCode` — set per source (see below).
   - `message` — keep the current text (peggy's, or the edge-op string);
     wording need not match C.
   - `friendlyMessage` — `friendlyMessageFor(code)`.
   - `location: { line: number; column: number; offset?: number }` — **primary**.
   - `expected?: GvExpectation[]` — peggy's array, passed through unmapped;
     present only for peggy syntax errors.
   - `line`/`column` — convert to **getters** returning `this.location.line` /
     `this.location.column` (preserve the existing read API ergonomically).
   - Constructor: accept `(message, code, location, expected?)`. Keep it simple;
     callers in this file construct it.
3. Widen `isPeggyError` to also expose `expected` (Expectation[]),
   `found` (string | null), and `location.start.offset` (number).
4. In `parse()`'s catch: build the `location` from `err.location.start`
   (line, column, offset), pass `err.expected` through as `expected`, and choose
   `code = err.found === null ? 'SYNTAX_UNEXPECTED_EOF' : 'SYNTAX_ERROR'`.
5. In `validateEdgeOperators`: set `code` to `EDGE_OP_DIRECTED_IN_UNDIRECTED`
   (the `->`-in-undirected case) or `EDGE_OP_UNDIRECTED_IN_DIRECTED` (the
   `--`-in-digraph case). Capture `offset` too: have `findEdgeOp` /
   `offsetToLineCol` also return the `offset` (the raw index) and put it in
   `location.offset`. `expected` stays undefined for these.

> Map the two edge-op cases to codes correctly against the EXISTING messages —
> do not swap them. The message that says `'->' is not allowed in an undirected
> graph` pairs with `EDGE_OP_DIRECTED_IN_UNDIRECTED`.

## Write-set
- `src/parser/index.ts` (modify — only `ParseError`, `isPeggyError`,
  `offsetToLineCol`, `findEdgeOp`, `validateEdgeOperators`, `parse`; leave the
  serializer half of the file untouched)
- `src/parser/parser.test.ts` (modify — extend the existing `ParseError` block)

## Read-set
- `src/parser/index.ts:18-135` — current `ParseError`, validators, `parse`
- `src/errors.ts` (from T1) — the `GvError` contract + `friendlyMessageFor`
- `src/parser/dot.d.ts:95-118` — `Expectation` union; `SyntaxError` shape
  (`expected`, `found`, `location`)
- `decisions.md#final-shape`

## Architecture decisions (locked)
- ADR-1: `location` is primary; `line`/`column` are convenience getters.
- ADR-2: `ParseError` is a thrown `Error` subclass implementing `GvError`.
- Faithfulness (relaxed): `message` wording may diverge from C; `location` and
  `code` are what must be correct. Keep current message text (useful, not
  mandated).
- `expected` is `GvExpectation[]` — pass peggy's array through; do NOT flatten to
  strings.

## Interface contracts (consumed by T4)
```ts
class ParseError extends Error implements GvError {
  readonly type: 'syntax';
  readonly code: GvErrorCode;
  readonly friendlyMessage: string;
  readonly location: { line: number; column: number; offset?: number };
  readonly expected?: GvExpectation[];
  get line(): number; get column(): number;
}
```

## Acceptance criteria
- Given `parse('digraph { a ->')`, when it throws, then a `ParseError` with
  `type:'syntax'`, `code:'SYNTAX_UNEXPECTED_EOF'`, `location.line >= 1`,
  `location.column >= 1`, and `location.offset` a number.
- Given a token-level syntax error (e.g. `parse('digraph { 123abc }')` or
  similar that fails with a found token), then `code === 'SYNTAX_ERROR'` and
  `Array.isArray(err.expected)` with `expected[0].type` a string (peggy
  Expectation, not a flattened string).
- Given `parse('graph g { a -> b }')`, then `code ===
  'EDGE_OP_DIRECTED_IN_UNDIRECTED'` and `location.offset` is set.
- Given `parse('digraph g { a -- b }')`, then `code ===
  'EDGE_OP_UNDIRECTED_IN_DIRECTED'`.
- Given any thrown `ParseError`, then `err.line === err.location.line` and
  `err.column === err.location.column` (getters mirror) and
  `err.friendlyMessage` is non-empty.
- Existing `parser.test.ts` assertions (instanceof, line/column ≥ 1, the two
  edge-op throw cases) still pass unchanged.

## Observability requirements
N/A — no new observable operations.

## Rollback notes
Reversible — additive fields + getters on an existing class. Revert the commit.

## Quality bar
- `npx tsc --noEmit` clean; `npx vitest run` green; new branches covered ≥90%.
- One commit:
  `feat(parser): structure ParseError as GvError with code, location, expected`.

# Architecture Decisions — Structured Errors

## Faithfulness scope (relaxed for error messages)

The seed framed errors as "faithful detection (incl. C-verbatim `message`) +
structured delivery." The owner has **relaxed this for message wording**: error
`message` text MAY diverge from C — fidelity to the C oracle is not required for
error text. What still matters for correctness:

- **Detection / classification** — `type` and `code` correctly identify what is
  wrong, and the error fires on the same conditions a real failure presents.
- **Location** — `location` points at the *real* error position (peggy's tracked
  line/column/offset, or the computed edge-op position). This is the
  highest-value field and must be accurate.

`message` (concise technical/developer text) and `friendlyMessage` (approachable
end-user prose) are both **library-UX text we own**. Roles differ by audience,
not by fidelity: keep peggy's informative `message` because it is *useful*, not
because it must match C. `code` is the stable i18n key.

## ADR-1: `ParseError implements GvError`

- Context: `ParseError` exists in `src/parser/index.ts`. No back-compat
  constraint — plantuml-js will bend to graphviz-ts, not the reverse.
- Decision: `ParseError implements GvError`. Structured `location` is primary;
  `line`/`column` are thin convenience getters delegating to `location`. No new
  class, no deprecation.
- Consequences: One syntax-error class carries the full structured contract;
  free to shape cleanly without fidelity/compat contortion.

## ADR-2: `GvError` interface (contract) + Error subclasses (thrown values)

- Context: the proposal types `GvError` as an interface, but `renderSvg`
  *throws* — a thrown value should be a real `Error`.
- Decision: `GvError` is an `interface`. Thrown values are `Error` subclasses
  implementing it (`ParseError` → syntax, `RenderError` → render).
  `HtmlParseError` also implements it (semantic). `tryRenderSvg` returns plain
  `GvError` data objects in `errors[]`.
- Consequences: `instanceof Error` works for throwers; `RenderResult.errors`
  stays a lean, JSON-serializable data array. Consumers branch on `.code` /
  `.type`, never per-subclass `instanceof`.

## ADR-3: All three error sources implement `GvError` directly

- Context: parser, html-label, and render stages each throw their own error.
- Decision: each error type carries `type` + `code` natively. Modifying the
  htmltable files is allowed (one user — us). `HtmlParseError` gains
  `type:'semantic'`, `code:'HTML_PARSE_ERROR'` **additively** — its `(tag)`
  constructor and existing `message` are unchanged, so its 4 call sites do not
  ripple. The boundary classifier (`classifyError`, T4) then duck-types on
  `.type`/`.code` and only wraps genuinely-unknown throws.
- Consequences: no central mapping table to maintain; engine internals stay
  faithful and unaware of error packaging.

## ADR-4: Stable `code` for i18n + non-localized `friendlyMessage`

- Context: error readability should survive for non-en-US users; a future
  localizable library needs a stable key.
- Decision: every `GvError` carries a closed-union `code` (the i18n key) and a
  required `friendlyMessage` (approachable, non-localized English). `message`
  is concise technical text we own (need not match C). The
  `code → friendlyMessage` map lives centrally in
  `src/errors.ts` (`FRIENDLY_MESSAGES` + `friendlyMessageFor`) — the single seam
  a future i18n library replaces. Fallback code is the idiom-proper
  `GENERIC_ERROR`; known render-stage failures use `RENDER_ERROR`.
- Consequences: consumers localize by switching on `code`; `friendlyMessage`
  gives immediate readable UX with zero i18n infra.

## Final shape

```ts
import type { Expectation } from './parser/dot.js';
export type GvExpectation = Expectation;   // stable public alias of peggy's union

export type GvErrorType = 'syntax' | 'semantic' | 'render';

export type GvErrorCode =
  | 'SYNTAX_ERROR'                    // peggy parse failure (token found)
  | 'SYNTAX_UNEXPECTED_EOF'           // peggy parse failure, found === null
  | 'EDGE_OP_DIRECTED_IN_UNDIRECTED'  // '->' used in an undirected graph
  | 'EDGE_OP_UNDIRECTED_IN_DIRECTED'  // '--' used in a digraph
  | 'HTML_PARSE_ERROR'                // HTML-like label parse failure
  | 'RENDER_ERROR'                    // known layout/render-stage failure
  | 'GENERIC_ERROR';                  // catch-all fallback

export interface GvError {
  type: GvErrorType;
  code: GvErrorCode;
  message: string;            // concise technical text (may diverge from C)
  friendlyMessage: string;    // approachable English, non-localized (delivery)
  location?: { line: number; column: number; offset?: number };
  expected?: GvExpectation[]; // peggy's discriminated union; SYNTAX_* only
}

export interface RenderResult {
  svg?: string;               // present on success
  errors?: GvError[];         // present on failure; XOR with svg for v1
}
```

Resolved open questions (from the seed): **XOR** svg-or-errors for v1;
**first-failure only** (`errors.length` ≤ 1); error `message` wording may
diverge from C (owner decision).

## Rollback

**Reversible** — additive code only, no persisted state or migration. Revert the
merge commit.

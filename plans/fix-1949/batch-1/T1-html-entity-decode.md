# T1 — Decode HTML entities in HTML-label text runs (D1)

## Context
graphviz-ts is a faithful TS port of graphviz C (`~/git/graphviz` is the
spec). HTML-like labels (`label=<...>`) are lexed by
`src/common/htmltable-lex.ts:scanText`, which currently pushes the raw text
run as a `text` token WITHOUT decoding XML/HTML entities. C decodes entities
via expat during tokenization (`lib/common/htmllex.c`), so the decoded UTF-8
text is what native measures and emits. The port measures the raw
`&#91;el...` (9-10 chars) instead of `[el...` (6 chars), inflating the label
vnode and shifting corpus 1949 by +18.7px. Plain-string labels already decode
via `htmlEntityUTF8` (make-label.ts), which is why they match.

## Task
In `scanText`, decode entities in the text-run value (after `cleanText`)
using the existing `htmlEntityUTF8` decoder (exported from
`src/common/make-label.ts`, backed by `html-entities.ts`). Decode ONCE; do
not touch attribute values or tag scanning. Preserve the `cleanText`
whitespace/control-char normalization order that matches C.

## Write-set
- `src/common/htmltable-lex.ts` (modify `scanText`)
- `src/common/htmltable-lex.test.ts` (add tests)

## Read-set
- `src/common/htmltable-lex.ts:83-90` (scanText/cleanText)
- `src/common/make-label.ts:53` (htmlEntityUTF8)
- `.agent-notes/1949-diagnosis.md` (D1 section)

## Interface contract
`tokenize(src)` still returns `Token[]`; `text` tokens' `value` is now
entity-decoded UTF-8. No signature change.

## Acceptance criteria (Given/When/Then)
- Given `<&#91;el...>`, when tokenized, then the `text` token value is
  `[el...` (not `&#91;el...`).
- Given `A->B[label=<&#91;el...>]` in `rankdir=LR`, when laid out, then graph
  width matches the plain-label form `label="[el..."` (native 167pt).
- Given `<a &amp;&lt;&gt; b>`, when tokenized then emitted to SVG, then the
  output escapes back to `&amp;&lt;&gt;` (round-trip preserved).
- Given corpus 1949, when surveyed, then its `maxDelta` drops from 90.68
  toward 0 and no other id regresses.

## Observability
N/A — no new observable operations (pure lexer transform).

## Rollback
Reversible.

## Quality bar
`npx tsc --noEmit` clean; `npx vitest run src/common/` green; new tests
assert exact decoded values (no `toBeTruthy`).

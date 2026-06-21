# Batch 2 — Faithful detection → structured

Make the two existing error sources implement `GvError`. **T2 and T3 run in
parallel** — distinct files, both depend only on T1.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T2 | `ParseError implements GvError`; surface peggy `expected`/`found`/`offset` | typescript-pro | `src/parser/index.ts`, `src/parser/parser.test.ts` | T1 | [x] |
| T3 | `HtmlParseError implements GvError` (additive on `(tag)` ctor) | typescript-pro | `src/common/htmltable-types.ts`, `src/common/htmltable-types.test.ts` | T1 | [x] |

Gate note: `git diff --name-only` after this batch must list only these four
files. On completion, T2 + T3 unblock T4.

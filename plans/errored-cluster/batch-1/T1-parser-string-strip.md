<!-- SPDX-License-Identifier: EPL-2.0 -->
# T1 — RC4: strip `--` inside `\`-continued multi-line strings

## Context
`validateEdgeOperators(src, directed)` (src/parser/index.ts:108) rejects the
wrong edge operator by regexing `/--(?!>)/` (or `/->/`) over `Stripper.strip(src)`
— a pre-parse pass that blanks strings/comments so only *real* operators match.
`Stripper.strip` (index.ts:63-83) currently leaks `--` out of multi-line quoted
strings that use backslash-newline continuation (e.g. `graphs/big.gv`:
`"...ultraviolet radiation -- those\n\"` continued onto the next line), so the
in-string `--` is mistaken for an undirected edge operator and the port throws
`EDGE_OP_UNDIRECTED_IN_DIRECTED`. The peggy grammar parses these files correctly
— this is purely the stripper heuristic.

## Task
1. Read `Stripper.strip` + `validateEdgeOperators` + `findEdgeOp` (index.ts:63-130).
2. Fix `Stripper.strip` so a `"`…`"` quoted string is fully consumed and its
   interior blanked, honoring scan.l semantics: `\"` does NOT end the string;
   `\<newline>` is a continuation (the string spans lines). After stripping, no
   in-string byte (incl. `--`, `->`) may remain visible to the regex.
3. Do NOT change the grammar (`dot.pegjs`) or regenerate `dot.js`.
4. Add `src/parser/index.test.ts` covering the ACs below.

## Write-set
- `src/parser/index.ts` (modify `Stripper.strip`)
- `src/parser/index.test.ts` (create)

## Read-set
- `src/parser/index.ts:63-130` (Stripper, validateEdgeOperators, findEdgeOp)
- `~/git/graphviz/lib/cgraph/scan.l` (qstring rules :137-142 — the two transforms)
- decisions.md#adr-1

## Interface outputs
None (internal heuristic fix). `validateEdgeOperators` behavior is unchanged for
real top-level operators; only in-string false positives are eliminated.

## Acceptance criteria
- Given `digraph{a[label="x -- y\<nl>z"]; a->b}`, when parsed, then no throw and
  the in-string `--` is not treated as an edge operator.
- Given `graphs/big.gv` and `graphs/biglabel.gv`, when `renderSvg(_, 'dot')`,
  then each returns SVG (no `EDGE_OP_UNDIRECTED_IN_DIRECTED`).
- Given `digraph{a -- b}` (real top-level `--`), when parsed, then it still
  throws `EDGE_OP_UNDIRECTED_IN_DIRECTED` (the fix narrows the strip, not the
  check) — with the location pointing at the real operator.
- Given `graph{a [label="p -> q"]; a -- b}` (undirected, `->` only inside a
  string), when parsed, then no throw (symmetric `->`-in-undirected guard).

## Observability / Rollback
N/A — pure parser heuristic. Reversible.

## Quality bar
`npm run typecheck && npm test` green. One commit:
`fix(parser): strip quoted-string content from edge-operator validation (T1)`.

## Boundaries
- Only `Stripper.strip` logic. Do NOT touch `dot.pegjs`/`dot.js`, the AST
  builder, or `validateEdgeOperators`' throw conditions.

<!-- SPDX-License-Identifier: EPL-2.0 -->
# Batch 1 — Parser fix (isolated quick win)

RC4 only. Isolated from the cluster minefield: one parser file, no `dot.js`
regeneration. Ships value early and de-risks the branch/gate flow before B2.

| ID | Description | Writes | Depends On | Done |
|----|-------------|--------|------------|------|
| T1 | RC4: `Stripper.strip` must drop quoted-string content (incl. `\`-continued multi-line strings) so `validateEdgeOperators`' `--`/`->` regex never sees in-string operators | `src/parser/index.ts`, `src/parser/index.test.ts` (new) | — | [x] |

## Methodology
- The bug is in `Stripper.strip` (src/parser/index.ts:63-83), a pre-parse pass
  that blanks strings/comments so the edge-operator regex only matches real
  operators. It currently leaks `--` from `"...radiation -- those\n\"`-style
  multi-line strings (backslash-newline continuation). `dot.js` itself parses
  these fine — do NOT touch the grammar or regenerate dot.js.
- Read `Stripper.strip` + `validateEdgeOperators` (index.ts:108-130) first.
  Reproduce with `graphs/big.gv` / `graphs/biglabel.gv` and a minimal synthetic.
- Match cgraph scan.l string semantics: inside `"`…`"`, `\"`→`"` and
  `\<newline>`→dropped; everything else verbatim. The stripper must consume a
  full quoted string (honoring `\"` so an escaped quote doesn't end it early)
  and blank its interior. @see lib/cgraph/scan.l qstring rules.

## Gate after batch
`npm run typecheck && npm test && npm run build` exit 0; `git diff --name-only`
lists only `src/parser/index.ts` + `src/parser/index.test.ts`.

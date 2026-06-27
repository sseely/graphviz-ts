<!-- SPDX-License-Identifier: EPL-2.0 -->

## Observation: the 5 "errored" parser cases are adversarial fuzz, not port bugs

- **Context**: After the 2646 stack-overflow fix, 5 corpus cases remained in the
  `errored` bucket: `1308_1`, `1474`, `1489`, `1494`, `1676`. All five throw a
  peggy `ParseError` in the port; the survey counted them as port failures.
- **Finding**: They are oss-fuzz / adversarial inputs — random high bytes,
  HTML-injection payloads (`<img onerror=...>`), NEL (U+0085) line terminators,
  invalid UTF-8, broken structure. Native `dot` renders them (rc=1, valid SVG)
  ONLY via two permissive lex/yacc behaviours that the port's PEG grammar does
  not and should not replicate:
  1. **Badly-delimited-number splitting** (`scan.l:135`): `NUMBER` deliberately
     matches one trailing letter, then `chkNum`+`yyless` splits a token like
     `1d0`/`-8p`/`0n`/`.024W` into two atoms. (The port's `NumericLiteral`
     already stops at the first non-digit, so this alone is not the blocker.)
  2. **Yacc mid-graph error recovery**: native emits "syntax error near …" yet
     keeps parsing and renders the partial graph. peggy is all-or-nothing.
- **Decision (2026-06, user-confirmed)**: the PEG grammar (`dot.pegjs`) is the
  authoritative spec; failing to render input that does not match the grammar is
  correct, not a bug. Do NOT add yacc-style error recovery to chase byte-parity
  on adversarial garbage (degenerate output, zero consumer value, high
  PEG-rewrite risk). **Quarantine the 5 as `malformed`**, mirroring the existing
  `2782.dot` precedent.
- **Implementation**: added to `enumerate.ts` `MANUAL_QUARANTINE` (with a
  documenting comment block — the canonical decision record), documented the
  `malformed` reason row in `test/corpus/README.md`, refreshed manifest +
  parity baselines (errored 6→0: 2646 fixed earlier, these 5 quarantined).
- **Confidence**: High (each native render confirmed to come via the documented
  recovery warnings; the port's rejection is grammar-conformant).

## Gotcha: NEL line terminators fool `grep '</svg>'`

`1489.dot` has NEL (U+0085) line terminators. `grep -c '</svg>'` returned 0 on
native's output even though the file ends in a valid `</svg>` — NEL is treated
as a line break by some tools and not others. Use `grep -a` / byte inspection
(`tail -c`) to confirm "did native actually produce a complete SVG", not a
line-oriented grep, on files `file(1)` flags as having NEL terminators.
